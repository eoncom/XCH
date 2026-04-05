import { apiClient } from '../api-client';
import type { Asset, AssetMovement, CreateAssetDto, UpdateAssetDto } from '@/types';

export const assetsApi = {
  getAll: (params?: {
    siteId?: string;
    status?: string;
    type?: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.siteId) searchParams.append('siteId', params.siteId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    return apiClient.get<Asset[]>(`/api/assets${query ? `?${query}` : ''}`);
  },

  getAllPaginated: (params?: {
    siteId?: string;
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.siteId) searchParams.append('siteId', params.siteId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.type) searchParams.append('type', params.type);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return apiClient.get<{ data: Asset[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(`/api/assets${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Asset>(`/api/assets/${id}`),

  create: (data: CreateAssetDto) => apiClient.post<Asset>('/api/assets', data),

  update: (id: string, data: UpdateAssetDto) =>
    apiClient.patch<Asset>(`/api/assets/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/assets/${id}`),

  generateQRCode: (id: string) =>
    apiClient.post<{
      assetId: string;
      qrCodeDataUrl: string;
      qrUrl: string;
      token: string;
    }>(`/api/assets/${id}/qr-code`, {}),

  verifyQRCode: (assetId: string, token: string) =>
    apiClient.get<{ valid: boolean; asset?: Asset }>(
      `/api/assets/${assetId}/verify-qr?token=${token}`
    ),

  batchUpdate: async (ids: string[], update: { status?: string; siteId?: string }) => {
    return apiClient.patch<{ updated: number }>('/api/assets/batch', { ids, ...update });
  },

  // Attachments
  uploadAttachment: async (id: string, formData: FormData) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/assets/${id}/attachments`, {
      method: 'POST',
      credentials: 'include', // Send cookies for authentication
      body: formData,
      // No Content-Type header - browser sets it automatically with boundary
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  listAttachments: (id: string) =>
    apiClient.get(`/api/assets/${id}/attachments`),

  deleteAttachment: (id: string, attachmentId: string) =>
    apiClient.delete(`/api/assets/${id}/attachments/${attachmentId}`),

  // Movement history
  getMovements: (id: string) =>
    apiClient.get<AssetMovement[]>(`/api/assets/${id}/movements`),
};
