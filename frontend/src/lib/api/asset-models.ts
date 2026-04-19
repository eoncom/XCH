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
  // WiFi AP template defaults (v1.4.x)
  wifiCoverageRadius?: number | null;
  wifiFrequency?: string | null;
  wifiAntennaType?: string | null;
  wifiTxPowerDbm?: number | null;
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
  wifiCoverageRadius?: number;
  wifiFrequency?: string;
  wifiAntennaType?: string;
  wifiTxPowerDbm?: number;
  notes?: string;
}

export interface ImportVendorResult {
  vendor: string;
  version: string;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ model: string; message: string }>;
  sources: string[];
}

export interface VendorCatalogDescriptor {
  key: string;
  label: string;
  manufacturer: string;
  status: 'available' | 'planned';
  description: string;
  modelCount: number;
  version?: string;
}

/** Stored catalog pack (v1.4.x) — one row per import. */
export interface StoredCatalog {
  id: string;
  vendor: string;
  version: string | null;
  sources: string[];
  itemCount: number;
  builtIn: boolean;
  importedAt: string;
  importedBy: string | null;
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

  /** List available vendor catalogs. */
  listVendors: () =>
    apiClient.get<VendorCatalogDescriptor[]>('/api/asset-models/import/vendors'),

  /** Import a vendor catalog by key (e.g. "fortinet"). */
  importVendor: (vendorKey: string) =>
    apiClient.post<ImportVendorResult>(`/api/asset-models/import/${vendorKey}`, {}),

  /** Upload a raw catalog JSON (generic or Fortinet-native). */
  uploadCatalog: (catalog: Record<string, any>) =>
    apiClient.post<ImportVendorResult>('/api/asset-models/import/upload', catalog),

  /** List stored catalog packs for the current tenant. */
  listCatalogs: () =>
    apiClient.get<StoredCatalog[]>('/api/asset-models/catalogs'),

  /** Download the raw JSON of a stored catalog as a browser download. */
  downloadCatalogUrl: (id: string) => `/api/asset-models/catalogs/${id}/download`,

  /** Delete a catalog pack. `withModels=true` also drops linked AssetModels (those with no asset attached). */
  deleteCatalog: (id: string, withModels = false) =>
    apiClient.delete<{ deleted: true; catalog: { id: string; vendor: string }; deletedModelsCount: number }>(
      `/api/asset-models/catalogs/${id}?withModels=${withModels ? 'true' : 'false'}`,
    ),

  /** URL of the export endpoint — opens in a new tab to trigger a browser download. */
  exportPackUrl: (filter: { manufacturer?: string; type?: string; catalogId?: string }) => {
    const qs = new URLSearchParams();
    if (filter.manufacturer) qs.set('manufacturer', filter.manufacturer);
    if (filter.type) qs.set('type', filter.type);
    if (filter.catalogId) qs.set('catalogId', filter.catalogId);
    const q = qs.toString();
    return `/api/asset-models/export${q ? `?${q}` : ''}`;
  },

};
