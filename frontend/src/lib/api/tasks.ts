import { apiClient } from '../api-client';
import type { Task, TaskComment, CreateTaskDto, UpdateTaskDto } from '@/types';

export const tasksApi = {
  getAll: async (params?: {
    status?: string;
    priority?: string;
    siteId?: string;
    assignedTo?: string;
  }): Promise<Task[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.siteId) searchParams.append('siteId', params.siteId);
    if (params?.assignedTo) searchParams.append('assignedTo', params.assignedTo);

    const query = searchParams.toString();
    const res = await apiClient.get<{ data: Task[]; meta: any }>(`/api/tasks${query ? `?${query}` : ''}`);
    return res.data;
  },

  getAllPaginated: (params?: {
    status?: string;
    priority?: string;
    siteId?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.siteId) searchParams.append('siteId', params.siteId);
    if (params?.assignedTo) searchParams.append('assignedTo', params.assignedTo);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return apiClient.get<{ data: Task[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(`/api/tasks${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Task>(`/api/tasks/${id}`),

  create: (data: CreateTaskDto) => apiClient.post<Task>('/api/tasks', data),

  update: (id: string, data: UpdateTaskDto) =>
    apiClient.patch<Task>(`/api/tasks/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/tasks/${id}`),

  updateChecklist: (id: string, checklist: any[]) =>
    apiClient.patch<Task>(`/api/tasks/${id}/checklist`, { checklist }),

  // Attachments
  uploadAttachment: async (id: string, formData: FormData) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/tasks/${id}/attachments`, {
      method: 'POST',
      credentials: 'include', // Send cookies for authentication
      body: formData,
      // No Content-Type header - browser sets it automatically with boundary
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  listAttachments: (id: string) =>
    apiClient.get(`/api/tasks/${id}/attachments`),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiClient.delete(`/api/tasks/${id}/attachments/${attachmentId}`),

  // Comments
  getComments: (id: string) =>
    apiClient.get<TaskComment[]>(`/api/tasks/${id}/comments`),

  createComment: (id: string, text: string) =>
    apiClient.post<TaskComment>(`/api/tasks/${id}/comments`, { text }),

  updateComment: (id: string, commentId: string, text: string) =>
    apiClient.patch<TaskComment>(`/api/tasks/${id}/comments/${commentId}`, { text }),

  deleteComment: (id: string, commentId: string) =>
    apiClient.delete(`/api/tasks/${id}/comments/${commentId}`),
};
