import { apiClient } from '../api-client';
import type { User } from '@/types';

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    return apiClient.get<User[]>('/api/users');
  },

  getById: async (id: string): Promise<User> => {
    return apiClient.get<User>(`/api/users/${id}`);
  },

  create: async (data: Partial<User>): Promise<User> => {
    return apiClient.post<User>('/api/users', data);
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    return apiClient.patch<User>(`/api/users/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/api/users/${id}`);
  },

  getMe: async (): Promise<User> => {
    return apiClient.get<User>('/api/users/me');
  },
};
