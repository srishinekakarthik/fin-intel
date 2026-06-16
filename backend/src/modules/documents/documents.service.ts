import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { writeAuditLog } from '../../services/audit';
import {
  uploadDocumentToStorage,
  getSignedUrl,
  deleteDocumentFromStorage,
} from '../../services/storage';
import {
  triggerN8nIngestion,
  markIngestionComplete,
  markIngestionFailed,
} from '../../services/ingestion';
import { deleteChunksByDocument } from '../../services/vector-search';
import { logger } from '../../config/logger';
import type { Document, DocType, AuthContext } from '../../types';

interface UploadDocumentInput {
  file: Express.Multer.File;
  title: string;
  docType: DocType;
  companyId?: string;
}

interface ListDocumentsOptions {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  docType?: DocType;
  status?: string;
}

export class DocumentService {
  /**
   * Upload flow:
   *   1. Validate file
   *   2. Create DB record (status: pending)
   *   3. Upload PDF to Supabase Storage
   *   4. Generate a signed URL for n8n to download
   *   5. Trigger n8n ingestion webhook → n8n handles chunk/embed/store
   *   6. Return immediately — frontend polls /status for progress
   */
  async upload(auth: AuthContext, input: UploadDocumentInput): Promise<Document> {
    const { file, title, docType, companyId } = input;

    if (file.mimetype !== 'application/pdf') {
      throw new AppError('Only PDF files are supported', 400);
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new AppError('File size exceeds 50MB limit', 400);
    }

    // 1. Create document record (status: pending)
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        org_id: auth.orgId,
        company_id: companyId ?? null,
        uploaded_by: auth.userId,
        title: title.trim(),
        doc_type: docType,
        storage_path: 'pending',
        file_size: file.size,
        status: 'pending',
      })
      .select()
      .single();

    if (docError || !doc) {
      throw new AppError('Failed to create document record', 500);
    }

    // 2. Upload to Supabase Storage
    const storagePath = await uploadDocumentToStorage(
      auth.orgId,
      doc.id,
      file.originalname,
      file.buffer,
      file.mimetype
    );

    await supabaseAdmin
      .from('documents')
      .update({ storage_path: storagePath, status: 'processing' })
      .eq('id', doc.id);

    // 3. Generate a 24-hour signed URL for n8n to pull the file
    const signedUrl = await getSignedUrl(storagePath, 86400);

    // 4. Trigger n8n Cloud ingestion webhook (non-blocking)
    triggerN8nIngestion({
      documentId: doc.id,
      orgId: auth.orgId,
      storagePath,
      signedUrl,
      title: title.trim(),
      docType,
      companyId: companyId ?? null,
    }).catch((err) => {
      logger.error('Failed to trigger n8n ingestion', { docId: doc.id, error: err });
      // Mark as failed if webhook call itself fails
      supabaseAdmin
        .from('documents')
        .update({ status: 'failed', error_msg: 'Failed to trigger ingestion pipeline' })
        .eq('id', doc.id)
        .then(() => null, () => null);
    });

    await writeAuditLog(auth, {
      action: 'document.uploaded',
      resourceType: 'document',
      resourceId: doc.id,
      diff: { title, docType, companyId },
    });

    return { ...doc, storage_path: storagePath, status: 'processing' } as unknown as Document;
  }

  /**
   * Called by n8n callback webhook when ingestion succeeds.
   */
  async handleIngestionComplete(
    documentId: string,
    orgId: string,
    result: { totalPages: number; totalChunks: number; durationMs: number }
  ): Promise<void> {
    await markIngestionComplete(documentId, orgId, result);
    logger.info('Document ingestion complete via n8n', { documentId, ...result });
  }

  /**
   * Called by n8n callback webhook when ingestion fails.
   */
  async handleIngestionFailed(
    documentId: string,
    orgId: string,
    errorMessage: string
  ): Promise<void> {
    await markIngestionFailed(documentId, orgId, errorMessage);
    logger.error('Document ingestion failed via n8n', { documentId, errorMessage });
  }

  async list(auth: AuthContext, opts: ListDocumentsOptions = {}) {
    const { page = 1, limit = 20, search, companyId, docType, status } = opts;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('documents')
      .select(
        `id, org_id, company_id, uploaded_by, title, doc_type,
         file_size, page_count, status, error_msg, metadata, created_at, updated_at,
         companies(id, name, ticker)`,
        { count: 'exact' }
      )
      .eq('org_id', auth.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike('title', `%${search}%`);
    if (companyId) query = query.eq('company_id', companyId);
    if (docType) query = query.eq('doc_type', docType);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new AppError('Failed to fetch documents', 500);

    return {
      data: data as unknown as Document[],
      total: count ?? 0,
      page,
      limit,
      hasMore: offset + limit < (count ?? 0),
    };
  }

  async getById(auth: AuthContext, documentId: string): Promise<Document> {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*, companies(id, name, ticker)')
      .eq('id', documentId)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !data) throw new AppError('Document not found', 404);
    return data as unknown as Document;
  }

  async getDownloadUrl(auth: AuthContext, documentId: string): Promise<string> {
    const doc = await this.getById(auth, documentId);
    return getSignedUrl(doc.storage_path);
  }

  async getStatus(auth: AuthContext, documentId: string) {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, status, error_msg, page_count, metadata, updated_at')
      .eq('id', documentId)
      .eq('org_id', auth.orgId)
      .single();

    if (error || !data) throw new AppError('Document not found', 404);
    return data;
  }

  async delete(auth: AuthContext, documentId: string): Promise<void> {
    const doc = await this.getById(auth, documentId);

    if (doc.storage_path && doc.storage_path !== 'pending') {
      await deleteDocumentFromStorage(doc.storage_path).catch((err) =>
        logger.warn('Storage delete failed (continuing)', { err })
      );
    }

    await deleteChunksByDocument(documentId);

    const { error } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('org_id', auth.orgId);

    if (error) throw new AppError('Failed to delete document', 500);

    await writeAuditLog(auth, {
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: documentId,
    });
  }

  async reprocess(auth: AuthContext, documentId: string): Promise<void> {
    const doc = await this.getById(auth, documentId);
    if (doc.status !== 'failed') {
      throw new AppError('Only failed documents can be reprocessed', 400);
    }

    await deleteChunksByDocument(documentId);

    await supabaseAdmin
      .from('documents')
      .update({ status: 'processing', error_msg: null })
      .eq('id', documentId);

    const signedUrl = await getSignedUrl(doc.storage_path, 86400);

    await triggerN8nIngestion({
      documentId,
      orgId: auth.orgId,
      storagePath: doc.storage_path,
      signedUrl,
      title: doc.title,
      docType: doc.doc_type,
      companyId: doc.company_id,
    });
  }
}

export const documentService = new DocumentService();
