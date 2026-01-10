import { apiClient } from '../api-client';
import type { Asset, CreateAssetDto, UpdateAssetDto } from '@/types';

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
};
