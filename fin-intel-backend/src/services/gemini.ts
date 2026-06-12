import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { env } from '../config/env';

const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

const EMBEDDING_MODEL = 'text-embedding-004';   // 768 dims — matches pgvector column
const GENERATION_MODEL = 'gemini-1.5-pro';

// ── Embeddings ────────────────────────────────────────────
// NOTE: Batch embedding (for ingestion) is handled by n8n.
// The backend only needs embedText() for query-time RAG retrieval.

/**
 * Embed a single query string for semantic search (RAG retrieval).
 * Uses RETRIEVAL_QUERY task type — paired with RETRIEVAL_DOCUMENT on the n8n side.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  return result.embedding.values;
}

// ── Text generation ───────────────────────────────────────

export interface GenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Generate text using Gemini 1.5 Pro.
 * Used by the RAG pipeline (Phase 4) and report generation (Phase 5).
 */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: GENERATION_MODEL,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate text with conversation history.
 * Used by the AI chat assistant (Phase 4).
 */
export async function generateWithHistory(
  history: Array<{ role: 'user' | 'model'; content: string }>,
  newMessage: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: GENERATION_MODEL,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  });

  const chat = model.startChat({
    history: history.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    })),
  });

  const result = await chat.sendMessage(newMessage);
  return result.response.text();
}
