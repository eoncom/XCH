import { apiClient } from '../api-client';
import type { Rack } from '@/types';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const racksApi = {
  getAll: (params?: { siteId?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.siteId) qs.set('siteId', params.siteId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<Rack>>(`/api/racks${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Rack>(`/api/racks/${id}`),

  create: (data: {
    siteId: string;
    name: string;
    heightU: number;
    status: string;
    location?: string;
  }) => apiClient.post<Rack>('/api/racks', data),

  update: (id: string, data: Partial<Rack>) =>
    apiClient.patch<Rack>(`/api/racks/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/racks/${id}`),

  mountEquipment: (
    rackId: string,
    data: {
      assetId: string;
      positionU: number;
      heightU: number;
    }
  ) => apiClient.post(`/api/racks/${rackId}/mount`, data),

  unmountEquipment: (rackId: string, assetId: string) =>
    apiClient.delete(`/api/racks/${rackId}/unmount/${assetId}`),

  // Attachments
  uploadAttachment: async (id: string, formData: FormData) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/racks/${id}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  listAttachments: (id: string) =>
    apiClient.get(`/api/racks/${id}/attachments`),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiClient.delete(`/api/racks/${id}/attachments/${attachmentId}`),
};
