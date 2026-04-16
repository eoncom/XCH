import { apiClient } from '../api-client';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface AssetModel {
  id: string;
  tenantId: string;
  name: string;
  manufacturer: string | null;
  type: string;
  acquisitionPrice: number | null;
  monthlyPrice: number | null;
  currency: string;
  pricingMode: string;
  powerConsumption: number | null;
  weight: number | null;
  defaultUHeight: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { assets: number };
}

export interface CreateAssetModelData {
  name: string;
  manufacturer?: string;
  type: string;
  acquisitionPrice?: number;
  monthlyPrice?: number;
  currency?: string;
  pricingMode?: string;
  powerConsumption?: number;
  weight?: number;
  defaultUHeight?: number;
  notes?: string;
}

export interface AssetModelFilters {
  type?: string;
  manufacturer?: string;
  search?: string;
  isActive?: string;
  page?: number;
  pageSize?: number;
}

function buildParams(filters?: AssetModelFilters): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  if (filters.type) qs.set('type', filters.type);
  if (filters.manufacturer) qs.set('manufacturer', filters.manufacturer);
  if (filters.search) qs.set('search', filters.search);
  if (filters.isActive) qs.set('isActive', filters.isActive);
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.pageSize) qs.set('pageSize', String(filters.pageSize));
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const assetModelsApi = {
  getAll: (filters?: AssetModelFilters) =>
    apiClient.get<PaginatedResponse<AssetModel>>(`/api/asset-models${buildParams(filters)}`),

  getById: (id: string) =>
    apiClient.get<AssetModel>(`/api/asset-models/${id}`),

  create: (data: CreateAssetModelData) =>
    apiClient.post<AssetModel>('/api/asset-models', data),

  update: (id: string, data: Partial<CreateAssetModelData> & { isActive?: boolean }) =>
    apiClient.patch<AssetModel>(`/api/asset-models/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/asset-models/${id}`),
};
