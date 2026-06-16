import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';

// Single client — apiVersion is set per-call via requestOptions.
const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

// (Embedding model is now mistral-embed)
const GENERATION_MODEL = 'gemini-3.5-flash';

// ── Embeddings ────────────────────────────────────────────
// NOTE: Batch embedding (for ingestion) is handled by n8n.
// The backend only needs embedText() for query-time RAG retrieval.

/**
 * Embed a single query string for semantic search (RAG retrieval).
 * outputDimensionality: 768 truncates gemini-embedding-001's native 3072-dim
 * output to match the vector(768) column in document_chunks.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!env.MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY is missing from environment variables');
  }
  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-embed',
      input: [text]
    })
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mistral API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }
  const data = (await response.json()) as any;
  return data.data[0].embedding;
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
 * Available on gemini-2.0-flash and gemini-3.5-flash (current model).
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

