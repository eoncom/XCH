import { apiClient } from '../api-client';
import type { User } from '@/types';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const usersApi = {
  getAll: async (params?: { page?: number; pageSize?: number; search?: string; role?: string }): Promise<PaginatedResponse<User>> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<User>>(`/api/users${query ? `?${query}` : ''}`);
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
