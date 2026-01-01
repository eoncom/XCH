import { apiClient } from '../api-client';
import type { Site } from '@/types';

export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    return apiClient.get<Site[]>('/sites');
  },

  getById: async (id: string): Promise<Site> => {
    return apiClient.get<Site>(`/sites/${id}`);
  },

  create: async (data: Partial<Site>): Promise<Site> => {
    return apiClient.post<Site>('/sites', data);
  },

  update: async (id: string, data: Partial<Site>): Promise<Site> => {
    return apiClient.patch<Site>(`/sites/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/sites/${id}`);
  },

  getNearby: async (latitude: number, longitude: number, radiusKm: number): Promise<Site[]> => {
    return apiClient.get<Site[]>(
      `/sites/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radiusKm}`
    );
  },
};
