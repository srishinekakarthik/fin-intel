
import { semanticSearch, searchResultsToCitations } from './vector-search';
import { generateWithHistory, generateWithHistoryAndSearch } from './gemini';
import type { ExternalContext } from './external-context';
import type { Citation } from '../types';

export interface RagContext {
  orgId: string;
  companyId?: string;
  documentIds?: string[];
}

export interface RagMessage {
  role: 'user' | 'model';
  content: string;
}

export interface RagResult {
  answer: string;
  citations: Citation[];
  contextChunks: number;
  externalSourcesUsed: number;
}

// ── System prompt ─────────────────────────────────────────

function buildSystemPrompt(
  _context: RagContext,
  companyName?: string,
  hasExternalData = false
): string {
  const scope = companyName
    ? `You are analyzing data related to **${companyName}**.`
    : 'You are a financial intelligence assistant for the organization.';

  const sourceRules = hasExternalData
    ? `SOURCE PRIORITY ORDER (use all that are relevant):
1. **Uploaded Documents** — cite as [Source: "<document title>", Page N]
2. **Live Market Data** (Finnhub) — cite as [Source: Finnhub, <date>]
3. **SEC Filings** (EDGAR) — cite as [Source: SEC EDGAR, <form> <date>]
4. **Yahoo Finance** — cite as [Source: Yahoo Finance]
5. **Web Search** (Gemini Search) — cite as [Source: Web Search]`
    : `SOURCE RULES:
1. Answer based on the provided document context. Cite as [Source: "<document title>", Page N].
2. If documents don't have the answer, say so and offer what you know from general financial knowledge.`;

  return `You are an expert AI Financial Analyst assistant for a financial intelligence platform.
${scope}

${sourceRules}

CRITICAL RULES:
- Be precise with numbers, dates, and financial figures — quote them exactly as provided.
- For comparisons or trend analysis, structure your answer clearly with bullet points.
- Never fabricate data, financials, or quotes.
- Keep answers concise but complete.
- If you have both document context AND live data, synthesize them into a unified answer.
- Always indicate the source of each key fact.`;
}

// ── Context builders ──────────────────────────────────────

function buildDocumentContextBlock(
  chunks: Awaited<ReturnType<typeof semanticSearch>>
): string {
  if (!chunks.length) return '';
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: "${c.docTitle}", Page ${c.pageNumber}\n${c.content}`
    )
    .join('\n\n---\n\n');
}

function buildExternalContextBlock(external: ExternalContext): string {
  if (!external.hasData) return '';
  return external.sources
    .map((s) => `### ${s.label}\n${s.content}`)
    .join('\n\n---\n\n');
}

// ── Main RAG function ─────────────────────────────────────

/**
 * Run a multi-source RAG query:
 *   1. Embed the user's question → retrieve top-K document chunks
 *   2. Merge with external financial context (Finnhub, EDGAR, Yahoo Finance)
 *   3. Build unified context block with source attribution
 *   4. Send to Gemini 2.5-flash with conversation history
 *   5. If no local context found → fall back to Gemini web search grounding
 *   6. Return answer + citations
 */
export async function runRag(
  question: string,
  history: RagMessage[],
  context: RagContext,
  companyName?: string,
  externalContext?: ExternalContext
): Promise<RagResult> {
  // 1. Document semantic retrieval (always runs)
  const chunks = await semanticSearch(question, context.orgId, {
    companyId: context.companyId,
    documentIds: context.documentIds,
    topK: 8,
    threshold: 0.60,
  });

  const docContext    = buildDocumentContextBlock(chunks);
  const extContext    = externalContext ? buildExternalContextBlock(externalContext) : '';
  const hasAnyContext = docContext.length > 0 || extContext.length > 0;
  const hasExternal   = (externalContext?.hasData) ?? false;

  // 2. Build the augmented prompt
  const contextSections: string[] = [];

  if (docContext) {
    contextSections.push(`## UPLOADED DOCUMENT CONTEXT\n${docContext}`);
  }
  if (extContext) {
    contextSections.push(`## LIVE FINANCIAL DATA\n${extContext}`);
  }

  const augmentedQuestion = contextSections.length
    ? `${contextSections.join('\n\n===\n\n')}

---

USER QUESTION: ${question}

Answer based on all context provided above. Cite each source inline as specified in your instructions.`
    : question;

  const systemPrompt = buildSystemPrompt(context, companyName, hasExternal);

  // 3. Generate answer
  let answer: string;

  if (!hasAnyContext) {
    // No document chunks AND no external API data — use Gemini web search grounding
    answer = await generateWithHistoryAndSearch(history, augmentedQuestion, {
      systemPrompt,
      temperature: 0.2,
      maxOutputTokens: 2048,
    });
  } else {
    // We have local context — use standard generation (more controlled)
    answer = await generateWithHistory(history, augmentedQuestion, {
      systemPrompt,
      temperature: 0.1, // low temp for factual financial answers
      maxOutputTokens: 2048,
    });
  }

  // 4. Build citations from document chunks
  const citations = searchResultsToCitations(chunks);

  return {
    answer,
    citations,
    contextChunks: chunks.length,
    externalSourcesUsed: externalContext?.sources.length ?? 0,
  };
}
