import { apiClient } from '../api-client';

// Types
export interface Division {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  color?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { delegations: number };
  delegations?: Delegation[];
}

export interface Delegation {
  id: string;
  tenantId: string;
  divisionId: string;
  name: string;
  code: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  division?: { id: string; name: string; code: string; color?: string };
  _count?: { sites: number };
  sites?: { id: string; code: string; name: string; status: string }[];
}

export interface OrganizationTree extends Division {
  delegations: (Delegation & {
    sites: { id: string; code: string; name: string; status: string; city?: string }[];
  })[];
}

// DTOs
export interface CreateDivisionDto {
  name: string;
  code: string;
  color?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateDivisionDto extends Partial<CreateDivisionDto> {}

export interface CreateDelegationDto {
  divisionId: string;
  name: string;
  code: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateDelegationDto extends Partial<CreateDelegationDto> {}

// API
export const organizationApi = {
  // Divisions
  getDivisions: (includeInactive = false) =>
    apiClient.get<Division[]>(`/api/divisions${includeInactive ? '?includeInactive=true' : ''}`),

  getDivision: (id: string) =>
    apiClient.get<Division>(`/api/divisions/${id}`),

  createDivision: (data: CreateDivisionDto) =>
    apiClient.post<Division>('/api/divisions', data),

  updateDivision: (id: string, data: UpdateDivisionDto) =>
    apiClient.patch<Division>(`/api/divisions/${id}`, data),

  deleteDivision: (id: string) =>
    apiClient.delete(`/api/divisions/${id}`),

  // Delegations
  getDelegations: (divisionId?: string, includeInactive = false) => {
    const params = new URLSearchParams();
    if (divisionId) params.append('divisionId', divisionId);
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

  // Tree
  getTree: (includeInactive = false) =>
    apiClient.get<OrganizationTree[]>(`/api/organization/tree${includeInactive ? '?includeInactive=true' : ''}`),
};
