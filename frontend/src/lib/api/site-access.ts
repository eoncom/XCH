import { apiClient } from '../api-client';
import type { DelegationRight } from '@/types';

export type ResourcePermissionLevel = 'NONE' | 'READ' | 'WRITE';

export type OverrideEffect = 'ALLOW' | 'DENY';

export interface UserDelegation {
  id: string;
  tenantId: string;
  userId: string;
  delegationId: string;
  right: DelegationRight;
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

export interface AccessOverride {
  id: string;
  tenantId: string;
  userId: string;
  siteId: string;
  resource: string; // "*" = whole site, or "assets", "racks", "tasks", "plans", "contacts", "expenses", "monitoring"
  effect: OverrideEffect;
  permission: ResourcePermissionLevel | null; // required for ALLOW, null for DENY
  label?: string;
  grantedBy?: string;
  grantedAt: string;
  expiresAt?: string | null;
  site?: { id: string; name: string };
  user?: { id: string; name: string; email: string };
}

export interface MyPermissionsResponse {
  isSuperAdmin: boolean;
  hasDelegation: boolean;
  allSitesAccess: boolean;
  accessibleSiteIds: string[] | null;
  delegations: UserDelegation[];
}

export const siteAccessApi = {
  checkAccess: (siteId: string) =>
    apiClient.get<{ hasAccess: boolean }>(`/api/site-access/check?siteId=${siteId}`),

  myPermissions: () =>
    apiClient.get<MyPermissionsResponse>('/api/auth/my-permissions'),
};

// User delegations API
export const userDelegationsApi = {
  getByUser: (userId: string) =>
    apiClient.get<UserDelegation[]>(`/api/user-delegations/user/${userId}`),

  getByDelegation: (delegationId: string) =>
    apiClient.get<UserDelegation[]>(`/api/user-delegations/delegation/${delegationId}`),

  getMine: () =>
    apiClient.get<UserDelegation[]>('/api/user-delegations/mine'),

  create: (data: { userId: string; delegationId: string; right: DelegationRight }) =>
    apiClient.post<UserDelegation>('/api/user-delegations', data),

  setRight: (userId: string, delegationId: string, right: DelegationRight) =>
    apiClient.patch<UserDelegation>(`/api/user-delegations/${userId}/${delegationId}`, { right }),

  remove: (userId: string, delegationId: string) =>
    apiClient.delete(`/api/user-delegations/${userId}/${delegationId}`),
};

// Access overrides API (replaces access grants)
export const accessOverridesApi = {
  getByUser: (userId: string) =>
    apiClient.get<AccessOverride[]>(`/api/access-overrides/by-user/${userId}`),

  getBySite: (siteId: string) =>
    apiClient.get<AccessOverride[]>(`/api/access-overrides/by-site/${siteId}`),

  getOne: (id: string) =>
    apiClient.get<AccessOverride>(`/api/access-overrides/${id}`),

  create: (data: {
    userId: string;
    siteId: string;
    resource: string;
    effect: OverrideEffect;
    permission?: ResourcePermissionLevel;
    label?: string;
    expiresAt?: string;
  }) =>
    apiClient.post<AccessOverride>('/api/access-overrides', data),

  update: (id: string, data: {
    effect?: OverrideEffect;
    permission?: ResourcePermissionLevel;
    label?: string;
    expiresAt?: string | null;
  }) =>
    apiClient.patch<AccessOverride>(`/api/access-overrides/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/api/access-overrides/${id}`),
};
