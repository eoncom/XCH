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

export interface UserSiteAccess {
  id: string;
  tenantId: string;
  userId: string;
  siteId: string;
  accessLevel: 'READ' | 'WRITE';
  resourcePermissions?: ResourcePermissions | null;
  grantedBy?: string;
  grantedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  site?: {
    id: string;
    name: string;
    code: string;
    status?: string;
  };
}

export type ScopeType = 'TENANT' | 'DIVISION' | 'DELEGATION' | 'SITE';
export type AccessScope = 'ALL_SITES' | 'DIVISION' | 'DELEGATION' | 'SITE';

export interface UserScope {
  id: string;
  tenantId: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string | null;
  scopeLabel?: string;
  grantedBy?: string;
  grantedAt: string;
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
  role: string;
  allSitesAccess: boolean;
  accessibleSiteIds: string[] | null;
  scopes: UserScope[];
  accessGrants: AccessGrant[];
}

export const siteAccessApi = {
  // Get all users with access to a site (legacy)
  listBySite: (siteId: string) =>
    apiClient.get<UserSiteAccess[]>(`/api/site-access/site/${siteId}`),

  // Get all sites a user has access to (legacy)
  listByUser: (userId: string) =>
    apiClient.get<UserSiteAccess[]>(`/api/site-access/user/${userId}`),

  // Get current user's accessible sites (legacy)
  myAccessibleSites: () =>
    apiClient.get<UserSiteAccess[]>('/api/site-access/my-sites'),

  // Grant access (legacy)
  grant: (data: { userId: string; siteId: string; accessLevel?: 'READ' | 'WRITE'; resourcePermissions?: ResourcePermissions }) =>
    apiClient.post<UserSiteAccess>('/api/site-access', data),

  // Bulk grant access (legacy)
  bulkGrant: (data: { userIds: string[]; siteId: string; accessLevel?: 'READ' | 'WRITE' }) =>
    apiClient.post<{ granted: number; skipped: number }>('/api/site-access/bulk', data),

  // Update access level and/or resource permissions (legacy)
  update: (id: string, data: { accessLevel?: 'READ' | 'WRITE'; resourcePermissions?: ResourcePermissions }) =>
    apiClient.patch<UserSiteAccess>(`/api/site-access/${id}`, data),

  // Revoke access (legacy)
  revoke: (id: string) =>
    apiClient.delete(`/api/site-access/${id}`),

  // Check if current user has access
  checkAccess: (siteId: string) =>
    apiClient.get<{ hasAccess: boolean }>(`/api/site-access/check?siteId=${siteId}`),

  // Get current user's permissions (scopes + grants)
  myPermissions: () =>
    apiClient.get<MyPermissionsResponse>('/api/site-access/my-permissions'),
};

// User scopes API
export const userScopesApi = {
  getByUser: (userId: string) =>
    apiClient.get<UserScope[]>(`/api/user-scopes/user/${userId}`),

  create: (data: { userId: string; scopeType: ScopeType; scopeId?: string }) =>
    apiClient.post<UserScope>('/api/user-scopes', data),

  bulkSet: (userId: string, data: { userId: string; scopes: { scopeType: ScopeType; scopeId?: string }[] }) =>
    apiClient.put<UserScope[]>(`/api/user-scopes/user/${userId}`, data),

  remove: (id: string) =>
    apiClient.delete(`/api/user-scopes/${id}`),
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
