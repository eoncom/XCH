import { apiClient } from '../api-client';
import type { Provider } from '@/types';

export const providersApi = {
  getAll: async (): Promise<Provider[]> => {
    return apiClient.get<Provider[]>('/api/providers');
  },

  getById: async (id: number): Promise<Provider> => {
    return apiClient.get<Provider>(`/api/providers/${id}`);
  },

  create: async (data: Partial<Provider>): Promise<Provider> => {
    return apiClient.post<Provider>('/api/providers', data);
  },

  update: async (id: number, data: Partial<Provider>): Promise<Provider> => {
    return apiClient.patch<Provider>(`/api/providers/${id}`, data);
  },

  delete: async (id: number): Promise<void> => {
    return apiClient.delete(`/api/providers/${id}`);
  },
};
