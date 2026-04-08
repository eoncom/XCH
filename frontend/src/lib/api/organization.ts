import { apiClient } from '../api-client';

// Types
export interface Delegation {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  notes?: string;
  isActive: boolean;
  groupLabel?: string;
  groupColor?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { sites: number };
  sites?: { id: string; code: string; name: string; status: string; city?: string }[];
}

// DTOs
export interface CreateDelegationDto {
  name: string;
  code: string;
  notes?: string;
  isActive?: boolean;
  groupLabel?: string;
  groupColor?: string;
}

export interface UpdateDelegationDto extends Partial<CreateDelegationDto> {}

// API
export const organizationApi = {
  // Delegations
  getDelegations: (includeInactive = false) => {
    const params = new URLSearchParams();
    if (includeInactive) params.append('includeInactive', 'true');
    const query = params.toString();
    return apiClient.get<Delegation[]>(`/api/delegations${query ? `?${query}` : ''}`);
  },

  getDelegation: (id: string) =>
    apiClient.get<Delegation>(`/api/delegations/${id}`),

  createDelegation: (data: CreateDelegationDto) =>
    apiClient.post<Delegation>('/api/delegations', data),

  updateDelegation: (id: string, data: UpdateDelegationDto) =>
    apiClient.patch<Delegation>(`/api/delegations/${id}`, data),

  deleteDelegation: (id: string) =>
    apiClient.delete(`/api/delegations/${id}`),

  // Tree (flat list of delegations with sites)
  getTree: (includeInactive = false) =>
    apiClient.get<Delegation[]>(`/api/organization/tree${includeInactive ? '?includeInactive=true' : ''}`),
};
