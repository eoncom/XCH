import { apiClient } from '../api-client';

export type ResourcePermissionLevel = 'NONE' | 'READ' | 'WRITE';

export interface ResourcePermissions {
  sites?: ResourcePermissionLevel;
  assets?: ResourcePermissionLevel;
  racks?: ResourcePermissionLevel;
  tasks?: ResourcePermissionLevel;
  floorPlans?: ResourcePermissionLevel;
  contacts?: ResourcePermissionLevel;
  monitoring?: ResourcePermissionLevel;
  netbox?: ResourcePermissionLevel;
}

export type AccessScope = 'ALL_SITES' | 'DELEGATION' | 'SITE';

export interface UserDelegation {
  id: string;
  tenantId: string;
  userId: string;
  delegationId: string;
  role: string;
  grantedBy?: string;
  grantedAt: string;
  delegation?: {
    id: string;
    name: string;
    code: string;
    groupLabel?: string;
    groupColor?: string;
  };
}

export interface AccessGrant {
  id: string;
  tenantId: string;
  userId: string;
  scope: AccessScope;
  scopeId: string | null;
  resourcePermissions: ResourcePermissions;
  label?: string;
  grantedBy?: string;
  grantedAt: string;
  expiresAt?: string | null;
}

export interface MyPermissionsResponse {
  isSuperAdmin: boolean;
  hasDelegation: boolean;
  allSitesAccess: boolean;
  accessibleSiteIds: string[] | null;
  delegations: UserDelegation[];
  accessGrants: AccessGrant[];
}

export const siteAccessApi = {
  // Check if current user has access
  checkAccess: (siteId: string) =>
    apiClient.get<{ hasAccess: boolean }>(`/api/site-access/check?siteId=${siteId}`),

  // Get current user's permissions (delegations + grants)
  myPermissions: () =>
    apiClient.get<MyPermissionsResponse>('/api/site-access/my-permissions'),
};

// User delegations API
export const userDelegationsApi = {
  getByUser: (userId: string) =>
    apiClient.get<UserDelegation[]>(`/api/user-delegations/user/${userId}`),

  getByDelegation: (delegationId: string) =>
    apiClient.get<UserDelegation[]>(`/api/user-delegations/delegation/${delegationId}`),

  getMine: () =>
    apiClient.get<UserDelegation[]>('/api/user-delegations/mine'),

  create: (data: { userId: string; delegationId: string; role: string }) =>
    apiClient.post<UserDelegation>('/api/user-delegations', data),

  setRole: (userId: string, delegationId: string, role: string) =>
    apiClient.patch<UserDelegation>(`/api/user-delegations/${userId}/${delegationId}`, { role }),

  remove: (userId: string, delegationId: string) =>
    apiClient.delete(`/api/user-delegations/${userId}/${delegationId}`),
};

// Access grants API
export const accessGrantsApi = {
  getByUser: (userId: string) =>
    apiClient.get<AccessGrant[]>(`/api/access-grants/user/${userId}`),

  create: (data: {
    userId: string;
    scope: AccessScope;
    scopeId?: string;
    resourcePermissions: ResourcePermissions;
    label?: string;
    expiresAt?: string;
  }) =>
    apiClient.post<AccessGrant>('/api/access-grants', data),

  update: (id: string, data: {
    resourcePermissions?: ResourcePermissions;
    label?: string;
    expiresAt?: string | null;
  }) =>
    apiClient.patch<AccessGrant>(`/api/access-grants/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/api/access-grants/${id}`),
};
