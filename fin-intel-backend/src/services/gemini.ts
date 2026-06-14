import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { env } from '../config/env';

// Single client — apiVersion is set per-call via requestOptions.
const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

// text-embedding-004 is no longer available on newer API keys.
// gemini-embedding-001 outputs 3072 dims by default; we truncate to 768
// via outputDimensionality to stay compatible with the existing vector(768) pgvector column.
const EMBEDDING_MODEL = 'gemini-embedding-001';
const GENERATION_MODEL = 'gemini-2.5-flash'; // upgraded from 1.5-pro — better perf, available on current keys

// ── Embeddings ────────────────────────────────────────────
// NOTE: Batch embedding (for ingestion) is handled by n8n.
// The backend only needs embedText() for query-time RAG retrieval.

/**
 * Embed a single query string for semantic search (RAG retrieval).
 * outputDimensionality: 768 truncates gemini-embedding-001's native 3072-dim
 * output to match the vector(768) column in document_chunks.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: 'user', parts: [{ text }] },
    taskType: TaskType.RETRIEVAL_QUERY,
    outputDimensionality: 768,
  } as Parameters<typeof model.embedContent>[0]);
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

/**
 * Generate text with conversation history AND Google Search grounding.
 * Used when neither document chunks nor external API data is available.
 * Gemini will autonomously decide when to invoke web search.
 *
 * Available on gemini-2.0-flash and gemini-2.5-flash (current model).
 */
export async function generateWithHistoryAndSearch(
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
    // Enable Gemini's built-in Google Search grounding
    tools: [{ googleSearch: {} } as unknown as import('@google/generative-ai').Tool],
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

