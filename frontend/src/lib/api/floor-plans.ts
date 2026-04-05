import { apiClient } from '../api-client';
import type { FloorPlan, Pin, HeatmapData } from '@/types';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PdfInspectResult {
  pageCount: number;
  pages: { page: number; thumbnail: string }[];
}

export const floorPlansApi = {
  getAll: async (params?: { siteId?: string; page?: number; pageSize?: number }): Promise<FloorPlan[]> => {
    const qs = new URLSearchParams();
    if (params?.siteId) qs.set('siteId', params.siteId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    const res = await apiClient.get<PaginatedResponse<FloorPlan>>(`/api/floor-plans${query ? `?${query}` : ''}`);
    return res.data;
  },

  getAllPaginated: (params?: { siteId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<FloorPlan>> => {
    const qs = new URLSearchParams();
    if (params?.siteId) qs.set('siteId', params.siteId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<FloorPlan>>(`/api/floor-plans${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => apiClient.get<FloorPlan>(`/api/floor-plans/${id}`),

  inspectPdf: async (file: File): Promise<PdfInspectResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/floor-plans/inspect-pdf`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) throw new Error('PDF inspection failed');
    return response.json();
  },

  create: async (data: FormData, page?: number) => {
    const pageQuery = page ? `?page=${page}` : '';
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/floor-plans${pageQuery}`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  update: (id: string, data: Partial<FloorPlan>) =>
    apiClient.patch<FloorPlan>(`/api/floor-plans/${id}`, data),

  delete: (id: string) => apiClient.delete(`/api/floor-plans/${id}`),

  // Versioning
  getVersionHistory: (id: string) =>
    apiClient.get<FloorPlan[]>(`/api/floor-plans/${id}/versions`),

  createNewVersion: async (id: string, data: FormData, page?: number) => {
    const pageQuery = page ? `?page=${page}` : '';
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/floor-plans/${id}/new-version${pageQuery}`,
      {
        method: 'POST',
        credentials: 'include',
        body: data,
      },
    );
    if (!response.ok) throw new Error('Failed to create new version');
    return response.json();
  },

  // Pins
  createPin: (floorPlanId: string, data: Omit<Pin, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'floorPlanId'>) =>
    apiClient.post<Pin>(`/api/floor-plans/${floorPlanId}/pins`, data),

  updatePin: (floorPlanId: string, pinId: string, data: Partial<Pin>) =>
    apiClient.patch<Pin>(`/api/floor-plans/${floorPlanId}/pins/${pinId}`, data),

  deletePin: (floorPlanId: string, pinId: string) =>
    apiClient.delete(`/api/floor-plans/${floorPlanId}/pins/${pinId}`),

  // Heatmap
  getHeatmapData: (id: string) =>
    apiClient.get<HeatmapData>(`/api/floor-plans/${id}/heatmap-data`),

  updateScale: (id: string, scaleMetersPerPixel: number, scaleRefLine?: any) =>
    apiClient.patch(`/api/floor-plans/${id}/scale`, { scaleMetersPerPixel, scaleRefLine }),
};
