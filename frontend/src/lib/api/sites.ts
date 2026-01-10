import { apiClient } from '../api-client';
import type { Site } from '@/types';

export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    return apiClient.get<Site[]>('/api/sites');
  },

  getById: async (id: string): Promise<Site> => {
    return apiClient.get<Site>(`/api/sites/${id}`);
  },

  create: async (data: Partial<Site>): Promise<Site> => {
    return apiClient.post<Site>('/api/sites', data);
  },

  update: async (id: string, data: Partial<Site>): Promise<Site> => {
    return apiClient.patch<Site>(`/api/sites/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/sites/${id}`);
  },

  getNearby: async (latitude: number, longitude: number, radiusKm: number): Promise<Site[]> => {
    return apiClient.get<Site[]>(
      `/api/sites/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radiusKm}`
    );
  },
};
