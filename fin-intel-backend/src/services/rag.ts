
import { semanticSearch, searchResultsToCitations } from './vector-search';
import { generateWithHistory } from './gemini';
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
}

// ── System prompt ─────────────────────────────────────────

function buildSystemPrompt(_context: RagContext, companyName?: string): string {
  const scope = companyName
    ? `You are analyzing documents related to **${companyName}**.`
    : 'You are analyzing the organization\'s financial document library.';

  return `You are an expert AI Financial Analyst assistant for a financial intelligence platform.
${scope}

CRITICAL RULES:
1. Answer ONLY based on the provided document context below. Do not use outside knowledge.
2. If the context does not contain enough information to answer, say: "I don't have enough information in the indexed documents to answer this. Try uploading more relevant documents."
3. Always cite your sources using [Source: <document title>, Page <number>] format inline.
4. Be precise with numbers, dates, and financial figures — quote them exactly as they appear.
5. For comparisons or trend analysis, structure your answer clearly.
6. Never fabricate data, financials, or quotes.
7. Keep answers concise but complete. Use bullet points for lists of facts.`;
}

// ── Context builder ───────────────────────────────────────

function buildContextBlock(chunks: Awaited<ReturnType<typeof semanticSearch>>): string {
  if (!chunks.length) return 'No relevant document sections found.';

  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: "${c.docTitle}", Page ${c.pageNumber}\n${c.content}`
    )
    .join('\n\n---\n\n');
}

// ── Main RAG function ─────────────────────────────────────

/**
 * Run a RAG query:
 *   1. Embed the user's question
 *   2. Retrieve top-K similar chunks from pgvector (org/company scoped)
 *   3. Build context block with source attribution
 *   4. Send to Gemini with conversation history
 *   5. Return answer + citations
 */
export async function runRag(
  question: string,
  history: RagMessage[],
  context: RagContext,
  companyName?: string
): Promise<RagResult> {
  // 1. Semantic retrieval
  const chunks = await semanticSearch(question, context.orgId, {
    companyId: context.companyId,
    documentIds: context.documentIds,
    topK: 8,
    threshold: 0.60,
  });

  // 2. Build context
  const contextBlock = buildContextBlock(chunks);

  // 3. Build the augmented prompt
  const augmentedQuestion = `DOCUMENT CONTEXT:
${contextBlock}

---

USER QUESTION: ${question}

Answer based on the document context above. Cite sources inline as [Source: "title", Page N].`;

  // 4. Generate with Gemini (passing conversation history for multi-turn)
  const answer = await generateWithHistory(
    history,
    augmentedQuestion,
    {
      systemPrompt: buildSystemPrompt(context, companyName),
      temperature: 0.1, // low temp for factual financial answers
      maxOutputTokens: 2048,
    }
  );

  // 5. Build citations from retrieved chunks
  const citations = searchResultsToCitations(chunks);

  return {
    answer,
    citations,
    contextChunks: chunks.length,
  };
}
