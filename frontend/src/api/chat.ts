import { api } from './client';
import type { Citation } from '../types';

export interface ChatSession {
  id: string;
  org_id: string;
  user_id: string;
  company_id: string | null;
  title: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  companies?: { name: string; ticker: string | null } | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateSessionPayload {
  title?: string;
  company_id?: string;
  document_ids?: string[];
}

export const chatApi = {
  createSession: async (payload: CreateSessionPayload): Promise<ChatSession> => {
    const { data } = await api.post('/chat/sessions', payload);
    return data.data;
  },

  listSessions: async (companyId?: string): Promise<ChatSession[]> => {
    const { data } = await api.get('/chat/sessions', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return data.data;
  },

  getSession: async (id: string): Promise<ChatSession> => {
    const { data } = await api.get(`/chat/sessions/${id}`);
    return data.data;
  },

  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const { data } = await api.get(`/chat/sessions/${sessionId}/messages`);
    return data.data;
  },

  sendMessage: async (sessionId: string, content: string): Promise<ChatMessage> => {
    const { data } = await api.post(`/chat/sessions/${sessionId}/messages`, { content });
    return data.data;
  },

  renameSession: async (id: string, title: string): Promise<void> => {
    await api.patch(`/chat/sessions/${id}/rename`, { title });
  },

  archiveSession: async (id: string): Promise<void> => {
    await api.delete(`/chat/sessions/${id}`);
  },

  generateHealthScore: async (companyId: string, companyName: string) => {
    const { data } = await api.post('/chat/analyze/health-score', {
      company_id: companyId,
      company_name: companyName,
    });
    return data.data;
  },

  analyzeRisks: async (companyId: string, companyName: string) => {
    const { data } = await api.post('/chat/analyze/risks', {
      company_id: companyId,
      company_name: companyName,
    });
    return data.data;
  },

  compareCompanies: async (companies: Array<{ id: string; name: string }>) => {
    const { data } = await api.post('/chat/analyze/compare', { companies });
    return data.data;
  },
};
