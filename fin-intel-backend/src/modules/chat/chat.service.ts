import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { runRag, type RagMessage } from '../../services/rag';
import { buildExternalContext } from '../../services/external-context';
import { logger } from '../../config/logger';

import type { ChatSession, ChatMessage, AuthContext } from '../../types';

interface CreateSessionInput {
  title?: string;
  companyId?: string;
  documentIds?: string[];
}

interface SendMessageInput {
  sessionId: string;
  content: string;
}

export class ChatService {
  // ── Sessions ──────────────────────────────────────────────

  async createSession(auth: AuthContext, input: CreateSessionInput): Promise<ChatSession> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .insert({
        org_id: auth.orgId,
        user_id: auth.userId,
        company_id: input.companyId ?? null,
        title: input.title ?? 'New conversation',
        // Store documentIds scope in metadata for this session
        ...(input.documentIds?.length
          ? { title: input.title ?? `Document Q&A` }
          : {}),
      })
      .select()
      .single();

    if (error || !data) throw new AppError('Failed to create chat session', 500);

    // If document IDs scoped, store them in the first system message
    if (input.documentIds?.length) {
      await supabaseAdmin.from('chat_messages').insert({
        session_id: data.id,
        role: 'system',
        content: JSON.stringify({ documentIds: input.documentIds }),
        citations: [],
      });
    }

    return data as unknown as ChatSession;
  }

  async listSessions(auth: AuthContext, companyId?: string) {
    let query = supabaseAdmin
      .from('chat_sessions')
      .select('*, companies(name, ticker)')
      .eq('org_id', auth.orgId)
      .eq('user_id', auth.userId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) throw new AppError('Failed to fetch sessions', 500);
    return data as unknown as ChatSession[];
  }

  async getSession(auth: AuthContext, sessionId: string): Promise<ChatSession> {
    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*, companies(name, ticker)')
      .eq('id', sessionId)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !data) throw new AppError('Session not found', 404);
    return data as unknown as ChatSession;
  }

  async archiveSession(auth: AuthContext, sessionId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ is_archived: true })
      .eq('id', sessionId)
      .eq('org_id', auth.orgId);

    if (error) throw new AppError('Failed to archive session', 500);
  }

  async renameSession(auth: AuthContext, sessionId: string, title: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update({ title })
      .eq('id', sessionId)
      .eq('org_id', auth.orgId);

    if (error) throw new AppError('Failed to rename session', 500);
  }

  // ── Messages ──────────────────────────────────────────────

  async getMessages(auth: AuthContext, sessionId: string): Promise<ChatMessage[]> {
    // Verify session belongs to org
    await this.getSession(auth, sessionId);

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .neq('role', 'system') // hide system messages from frontend
      .order('created_at', { ascending: true });

    if (error) throw new AppError('Failed to fetch messages', 500);
    return data as unknown as ChatMessage[];
  }

  /**
   * Send a message and get an AI response via RAG.
   *
   * Flow:
   *   1. Load conversation history for context
   *   2. Check session scope (global / company / document)
   *   3. Run RAG pipeline (embed query → retrieve chunks → Gemini)
   *   4. Persist both user message and AI response
   *   5. Auto-title session after first message
   */
  async sendMessage(auth: AuthContext, input: SendMessageInput): Promise<ChatMessage> {
    const session = await this.getSession(auth, input.sessionId);

    // 1. Load existing conversation history
    const { data: existingMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', input.sessionId)
      .neq('role', 'system')
      .order('created_at', { ascending: true })
      .limit(20); // last 20 messages for context window

    const history: RagMessage[] = (existingMessages ?? []).map((m) => ({
      role: m.role as 'user' | 'model',
      content: m.content,
    }));

    // 2. Determine scope: check for system message with documentIds
    const { data: systemMsg } = await supabaseAdmin
      .from('chat_messages')
      .select('content')
      .eq('session_id', input.sessionId)
      .eq('role', 'system')
      .single();

    let documentIds: string[] | undefined;
    if (systemMsg?.content) {
      try {
        const parsed = JSON.parse(systemMsg.content);
        documentIds = parsed.documentIds;
      } catch { /* not a scoped session */ }
    }

    // 3. Get company name if session is company-scoped
    let companyName: string | undefined;
    if (session.company_id) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', session.company_id)
        .single();
      companyName = company?.name;
    }

    // 4. Persist the user message
    await supabaseAdmin.from('chat_messages').insert({
      session_id: input.sessionId,
      role: 'user',
      content: input.content,
      citations: [],
    });

    // 5. Build external financial context in parallel with message persistence
    //    (detect tickers/intent and fetch Finnhub, EDGAR, Yahoo Finance data)
    const sessionTicker = session.company_id
      ? (await supabaseAdmin
          .from('companies')
          .select('ticker')
          .eq('id', session.company_id)
          .single()
        ).data?.ticker ?? null
      : null;

    const externalContext = await buildExternalContext(
      input.content,
      auth.orgId,
      sessionTicker
    );

    if (externalContext.hasData) {
      logger.info('Chat: external context fetched', {
        sessionId: input.sessionId,
        sources: externalContext.sources.map((s) => s.type),
        tickers: externalContext.tickers,
      });
    }

    // 6. Run RAG (document chunks + external context → Gemini)
    const ragResult = await runRag(
      input.content,
      history,
      {
        orgId: auth.orgId,
        companyId: session.company_id ?? undefined,
        documentIds,
      },
      companyName,
      externalContext
    );

    // 7. Persist AI response with citations
    const { data: aiMessage, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: input.sessionId,
        role: 'assistant',
        content: ragResult.answer,
        citations: ragResult.citations,
        metadata: {
          contextChunks: ragResult.contextChunks,
          externalSourcesUsed: ragResult.externalSourcesUsed,
        },
      })
      .select()
      .single();

    if (msgError || !aiMessage) throw new AppError('Failed to save AI response', 500);

    // 7. Update session timestamp
    await supabaseAdmin
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', input.sessionId);

    // 8. Auto-title session after first exchange (async, non-blocking)
    if (!existingMessages?.length) {
      this.autoTitleSession(input.sessionId, auth.orgId, input.content).catch(() => null);
    }

    return aiMessage as unknown as ChatMessage;
  }

  // ── Private helpers ───────────────────────────────────────

  private async autoTitleSession(
    sessionId: string,
    _orgId: string,
    firstQuestion: string
  ): Promise<void> {
    // Generate a short title from the first question (max 60 chars)
    const title = firstQuestion.length > 60
      ? firstQuestion.slice(0, 57) + '…'
      : firstQuestion;

    await supabaseAdmin
      .from('chat_sessions')
      .update({ title })
      .eq('id', sessionId);
  }
}

export const chatService = new ChatService();
