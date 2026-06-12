import { api } from './client';

export type AlertType = 'sec_filing' | 'earnings' | 'news' | 'price_move' | 'custom';

export interface Alert {
  id: string;
  alert_type: AlertType;
  title: string;
  summary: string | null;
  source_url: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  companies?: { id: string; name: string; ticker: string | null } | null;
}

export interface SecFiling {
  accessionNumber: string;
  filingDate: string;
  form: string;
  primaryDocument: string;
  description: string;
  url: string;
}

export const alertsApi = {
  list: async (filters?: {
    page?: number; limit?: number;
    alert_type?: AlertType; company_id?: string; is_read?: boolean;
  }) => {
    const { data } = await api.get('/alerts', { params: filters });
    return data;
  },

  getUnreadCount: async (): Promise<number> => {
    const { data } = await api.get('/alerts/unread-count');
    return data.data.count;
  },

  markRead: async (id: string): Promise<void> => {
    await api.patch(`/alerts/${id}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await api.patch('/alerts/read-all');
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/alerts/${id}`);
  },

  generateMemo: async (companyId: string) => {
    const { data } = await api.post('/alerts/intelligence/memo', { company_id: companyId });
    return data.data;
  },

  generateExecutiveSummary: async (companyId: string): Promise<string> => {
    const { data } = await api.post('/alerts/intelligence/executive-summary', { company_id: companyId });
    return data.data.summary as string;
  },

  compareCompanies: async (companies: Array<{ id: string; name: string }>) => {
    const { data } = await api.post('/alerts/intelligence/competitor-analysis', { companies });
    return data.data;
  },

  getSecFilings: async (ticker: string): Promise<SecFiling[]> => {
    const { data } = await api.get(`/alerts/sec/${ticker}`);
    return data.data;
  },
};
