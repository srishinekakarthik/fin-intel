import { api } from './client';
import type { Company } from '../types';

export interface CompanyFilters {
  page?: number;
  limit?: number;
  search?: string;
  is_tracked?: boolean;
}

export interface CreateCompanyPayload {
  name: string;
  ticker?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  website?: string;
  is_public?: boolean;
}

export const companiesApi = {
  list: async (filters?: CompanyFilters) => {
    const { data } = await api.get('/companies', { params: filters });
    return data;
  },

  getById: async (id: string): Promise<Company> => {
    const { data } = await api.get(`/companies/${id}`);
    return data.data;
  },

  create: async (payload: CreateCompanyPayload): Promise<Company> => {
    const { data } = await api.post('/companies', payload);
    return data.data;
  },

  update: async (id: string, payload: Partial<CreateCompanyPayload>): Promise<Company> => {
    const { data } = await api.patch(`/companies/${id}`, payload);
    return data.data;
  },

  toggleTracked: async (id: string): Promise<Company> => {
    const { data } = await api.patch(`/companies/${id}/track`);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/companies/${id}`);
  },
};
