import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Trigger the n8n Cloud ingestion workflow via webhook.
 *
 * n8n workflow responsibilities:
 *   1. Receive document metadata + signed download URL
 *   2. Download the PDF from Supabase Storage
 *   3. Extract text (Default Data Loader / PDF loader)
 *   4. Chunk the text (Character Text Splitter)
 *   5. Generate embeddings (Gemini text-embedding-004)
 *   6. Store chunks in Supabase pgvector (document_chunks table)
 *   7. Call back to POST /api/v1/documents/:id/ingestion-complete
 *
 * The backend does NOT run ingestion itself — it delegates to n8n.
 */
export async function triggerN8nIngestion(payload: {
  documentId: string;
  orgId: string;
  storagePath: string;
  signedUrl: string;
  title: string;
  docType: string;
  companyId: string | null;
}): Promise<void> {
  if (!env.N8N_WEBHOOK_BASE_URL || !env.N8N_INGESTION_WEBHOOK_PATH) {
    logger.warn('n8n ingestion webhook not configured — skipping trigger', {
      documentId: payload.documentId,
    });
    return;
  }

  const webhookUrl = `${env.N8N_WEBHOOK_BASE_URL}/${env.N8N_INGESTION_WEBHOOK_PATH}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // n8n Cloud webhook auth header
      ...(env.N8N_API_KEY ? { 'X-N8N-Api-Key': env.N8N_API_KEY } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.error('n8n ingestion webhook call failed', {
      status: response.status,
      documentId: payload.documentId,
      body: text,
    });
    throw new Error(`n8n webhook failed: HTTP ${response.status}`);
  }

  logger.info('n8n ingestion triggered', { documentId: payload.documentId });
}

/**
 * Called by n8n via POST /api/v1/documents/:id/ingestion-complete
 * to mark a document as ready after the pipeline finishes.
 */
export async function markIngestionComplete(
  documentId: string,
  orgId: string,
  result: {
    totalPages: number;
    totalChunks: number;
    durationMs: number;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({
      status: 'ready',
      page_count: result.totalPages,
      metadata: {
        ingested_at: new Date().toISOString(),
        total_chunks: result.totalChunks,
        duration_ms: result.durationMs,
        ingested_by: 'n8n',
      },
    })
    .eq('id', documentId)
    .eq('org_id', orgId);

  if (error) {
    logger.error('Failed to mark document ready', { documentId, error });
    throw new Error(`Failed to update document status: ${error.message}`);
  }
}

/**
 * Called by n8n via POST /api/v1/documents/:id/ingestion-failed
 */
export async function markIngestionFailed(
  documentId: string,
  orgId: string,
  errorMessage: string
): Promise<void> {
  await supabaseAdmin
    .from('documents')
    .update({ status: 'failed', error_msg: errorMessage })
    .eq('id', documentId)
    .eq('org_id', orgId);
}
