import { apiClient } from '../api-client';
import type { Task, CreateTaskDto, UpdateTaskDto } from '@/types';

export const tasksApi = {
  getAll: (params?: {
    status?: string;
    priority?: string;
    siteId?: string;
    assignedTo?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.siteId) searchParams.append('siteId', params.siteId);
    if (params?.assignedTo) searchParams.append('assignedTo', params.assignedTo);

    const query = searchParams.toString();
    return apiClient.get<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Task>(`/tasks/${id}`),

  create: (data: CreateTaskDto) => apiClient.post<Task>('/tasks', data),

  update: (id: string, data: UpdateTaskDto) =>
    apiClient.patch<Task>(`/tasks/${id}`, data),

  delete: (id: string) => apiClient.delete(`/tasks/${id}`),

  updateChecklist: (id: string, checklist: any[]) =>
    apiClient.patch<Task>(`/tasks/${id}`, { checklist }),
};
