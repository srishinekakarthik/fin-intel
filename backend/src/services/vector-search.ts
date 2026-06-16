import { supabaseAdmin } from '../config/supabase';
import { embedText } from './gemini';
import { logger } from '../config/logger';
import type { Citation } from '../types';

export interface ChunkInsert {
  documentId: string;
  orgId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  embedding: number[];
  tokenCount: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  docTitle: string;
  pageNumber: number;
  content: string;
  similarity: number;
}

/**
 * Bulk-insert document chunks with their embedding vectors.
 * Server-side vector search scoped to an organization.
 * Inserts in batches of 50 to keep payload sizes manageable.
 */
export async function insertChunks(chunks: ChunkInsert[]): Promise<void> {
  const BATCH = 50;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);

    const rows = batch.map((c) => ({
      document_id: c.documentId,
      org_id: c.orgId,
      chunk_index: c.chunkIndex,
      page_number: c.pageNumber,
      content: c.content,
      // pgvector expects a string like "[0.1, 0.2, ...]" or an array
      embedding: JSON.stringify(c.embedding),
      token_count: c.tokenCount,
    }));

    const { error } = await supabaseAdmin
      .from('document_chunks')
      .insert(rows);

    if (error) {
      logger.error('Failed to insert chunks batch', { error, batchStart: i });
      throw new Error(`Chunk insertion failed: ${error.message}`);
    }
  }
}

/**
 * Semantic search: embed the query and find the most similar chunks
 * within the org's document corpus using pgvector cosine similarity.
 *
 * @param query      - Natural language question
 * @param orgId      - Tenant scope (enforced at query level)
 * @param companyId  - Optional: restrict to a specific company's documents
 * @param documentIds - Optional: restrict to specific documents
 * @param topK       - Number of results to return (default 8)
 * @param threshold  - Minimum similarity score 0-1 (default 0.65)
 */
export async function semanticSearch(
  query: string,
  orgId: string,
  options: {
    companyId?: string;
    documentIds?: string[];
    topK?: number;
    threshold?: number;
  } = {}
): Promise<SearchResult[]> {
  const { companyId, documentIds, topK = 8, threshold = 0.65 } = options;

  // Embed the query using RETRIEVAL_QUERY task type
  const queryEmbedding = await embedText(query);

  // Call our pgvector similarity search via Supabase RPC
  // The function is defined in migration 003
  const { data, error } = await supabaseAdmin.rpc('search_document_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    org_id_filter: orgId,
    company_id_filter: companyId ?? null,
    document_ids_filter: documentIds ?? null,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    logger.error('Vector search RPC failed', { error });
    throw new Error(`Semantic search failed: ${error.message}`);
  }

  return (data ?? []) as SearchResult[];
}

/**
 * Convert search results into Citation objects for AI responses.
 */
export function searchResultsToCitations(results: SearchResult[]): Citation[] {
  return results.map((r) => ({
    doc_id: r.documentId,
    doc_title: r.docTitle,
    page: r.pageNumber,
    excerpt: r.content.slice(0, 300) + (r.content.length > 300 ? '…' : ''),
  }));
}

/**
 * Delete all chunks belonging to a document (called when document is deleted).
 */
export async function deleteChunksByDocument(documentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    throw new Error(`Failed to delete chunks: ${error.message}`);
  }
}
