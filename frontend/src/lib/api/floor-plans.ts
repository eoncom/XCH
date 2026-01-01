import { apiClient } from '../api-client';
import type { FloorPlan, Pin } from '@/types';

export const floorPlansApi = {
  getAll: (siteId?: string) => {
    const query = siteId ? `?siteId=${siteId}` : '';
    return apiClient.get<FloorPlan[]>(`/floor-plans${query}`);
  },

  getById: (id: string) => apiClient.get<FloorPlan>(`/floor-plans/${id}`),

  create: (data: FormData) =>
    apiClient.post<FloorPlan>('/floor-plans', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: string, data: Partial<FloorPlan>) =>
    apiClient.patch<FloorPlan>(`/floor-plans/${id}`, data),

  delete: (id: string) => apiClient.delete(`/floor-plans/${id}`),

  // Pins
  createPin: (floorPlanId: string, data: Omit<Pin, 'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'floorPlanId'>) =>
    apiClient.post<Pin>(`/floor-plans/${floorPlanId}/pins`, data),

  updatePin: (floorPlanId: string, pinId: string, data: Partial<Pin>) =>
    apiClient.patch<Pin>(`/floor-plans/${floorPlanId}/pins/${pinId}`, data),

  deletePin: (floorPlanId: string, pinId: string) =>
    apiClient.delete(`/floor-plans/${floorPlanId}/pins/${pinId}`),
};
