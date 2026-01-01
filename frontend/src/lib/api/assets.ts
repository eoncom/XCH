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
    return apiClient.get<Asset[]>(`/assets${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<Asset>(`/assets/${id}`),

  create: (data: CreateAssetDto) => apiClient.post<Asset>('/assets', data),

  update: (id: string, data: UpdateAssetDto) =>
    apiClient.patch<Asset>(`/assets/${id}`, data),

  delete: (id: string) => apiClient.delete(`/assets/${id}`),

  generateQRCode: (id: string) =>
    apiClient.post<{
      assetId: string;
      qrCodeDataUrl: string;
      qrUrl: string;
      token: string;
    }>(`/assets/${id}/qr-code`, {}),

  verifyQRCode: (assetId: string, token: string) =>
    apiClient.get<{ valid: boolean; asset?: Asset }>(
      `/assets/${assetId}/verify-qr?token=${token}`
    ),
};
