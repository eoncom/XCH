import { apiClient } from '../api-client';
import type { FloorPlan, Pin } from '@/types';

export const floorPlansApi = {
  getAll: (siteId?: string) => {
    const query = siteId ? `?siteId=${siteId}` : '';
    return apiClient.get<FloorPlan[]>(`/api/floor-plans${query}`);
  },

  getById: (id: string) => apiClient.get<FloorPlan>(`/api/floor-plans/${id}`),

  create: async (data: FormData) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/floor-plans`, {
      method: 'POST',
      credentials: 'include', // Send cookies for authentication
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

  createNewVersion: async (id: string, data: FormData) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ''}/api/floor-plans/${id}/new-version`,
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
};
