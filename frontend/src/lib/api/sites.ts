import { apiClient } from '../api-client';
import type { Site } from '@/types';

export const sitesApi = {
  getAll: async (): Promise<Site[]> => {
    return apiClient.get<Site[]>('/api/sites');
  },

  getAllPaginated: async (params?: {
    search?: string;
    divisionId?: string;
    delegationId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Site[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.divisionId) searchParams.append('divisionId', params.divisionId);
    if (params?.delegationId) searchParams.append('delegationId', params.delegationId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    const query = searchParams.toString();
    return apiClient.get<{ data: Site[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(`/api/sites${query ? `?${query}` : ''}`);
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

  // Attachments
  uploadAttachment: async (id: string, formData: FormData) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/sites/${id}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  listAttachments: (id: string) =>
    apiClient.get(`/api/sites/${id}/attachments`),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiClient.delete(`/api/sites/${id}/attachments/${attachmentId}`),

  // Aggregated documents (site + assets + racks + tasks)
  listAllDocuments: (id: string) =>
    apiClient.get(`/api/sites/${id}/documents`),

  // Audit history
  getHistory: (id: string) =>
    apiClient.get<AuditLogEntry[]>(`/api/sites/${id}/history`),
};

export interface AuditLogEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  } | null;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}
