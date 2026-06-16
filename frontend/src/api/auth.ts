import { api } from './client';
import type { Organization, User } from '../types';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
}

export interface AuthResponse {
  organization: Organization;
  user: User;
  session: { access_token: string; refresh_token: string };
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password });
    return data.data;
  },

  refresh: async (refreshToken: string) => {
    const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
    return data.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  me: async () => {
    const { data } = await api.get('/auth/me');
    return data.data;
  },
};
