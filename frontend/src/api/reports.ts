import { api } from './client';
import type { Report, ReportType } from '../types';

export const reportsApi = {
  list: async (filters?: { page?: number; limit?: number; report_type?: ReportType; company_id?: string }) => {
    const { data } = await api.get('/reports', { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Report> => {
    const { data } = await api.get(`/reports/${id}`);
    return data.data;
  },

  generate: async (payload: { report_type: ReportType; company_id?: string }): Promise<{ reportId: string }> => {
    const { data } = await api.post('/reports/generate', payload);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/reports/${id}`);
  },
};

export const marketApi = {
  getQuote: async (ticker: string) => {
    const { data } = await api.get(`/market/quote/${ticker}`);
    return data.data;
  },

  getFinancials: async (ticker: string) => {
    const { data } = await api.get(`/market/financials/${ticker}`);
    return data.data;
  },

  getNews: async (ticker: string) => {
    const { data } = await api.get(`/market/news/${ticker}`);
    return data.data;
  },

  refreshSnapshot: async (companyId: string) => {
    const { data } = await api.post(`/market/refresh/${companyId}`);
    return data;
  },

  getSnapshots: async (companyId: string) => {
    const { data } = await api.get(`/market/snapshots/${companyId}`);
    return data.data;
  },
};
