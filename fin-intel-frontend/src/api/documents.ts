import { api } from './client';
import type { Document, DocType, PaginatedResponse } from '../types';

export interface DocumentFilters {
  page?: number;
  limit?: number;
  search?: string;
  company_id?: string;
  doc_type?: DocType;
  status?: string;
}

export interface UploadDocumentPayload {
  file: File;
  title: string;
  doc_type: DocType;
  company_id?: string;
}

export interface DocumentStatus {
  id: string;
  status: string;
  error_msg: string | null;
  page_count: number | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export const documentsApi = {
  upload: async (payload: UploadDocumentPayload): Promise<Document> => {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('title', payload.title);
    form.append('doc_type', payload.doc_type);
    if (payload.company_id) form.append('company_id', payload.company_id);

    const { data } = await api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  list: async (filters?: DocumentFilters): Promise<PaginatedResponse<Document>> => {
    const { data } = await api.get('/documents', { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Document> => {
    const { data } = await api.get(`/documents/${id}`);
    return data.data;
  },

  getStatus: async (id: string): Promise<DocumentStatus> => {
    const { data } = await api.get(`/documents/${id}/status`);
    return data.data;
  },

  getDownloadUrl: async (id: string): Promise<string> => {
    const { data } = await api.get(`/documents/${id}/download`);
    return data.data.url;
  },

  reprocess: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/reprocess`);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
};
