import { apiClient } from '../api-client';

export type ResourcePermissionLevel = 'NONE' | 'READ' | 'WRITE';

export interface ResourcePermissions {
  sites?: ResourcePermissionLevel;
  assets?: ResourcePermissionLevel;
  racks?: ResourcePermissionLevel;
  tasks?: ResourcePermissionLevel;
  floorPlans?: ResourcePermissionLevel;
  contacts?: ResourcePermissionLevel;
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

export const siteAccessApi = {
  // Get all users with access to a site
  listBySite: (siteId: string) =>
    apiClient.get<UserSiteAccess[]>(`/api/site-access/site/${siteId}`),

  // Get all sites a user has access to
  listByUser: (userId: string) =>
    apiClient.get<UserSiteAccess[]>(`/api/site-access/user/${userId}`),

  // Get current user's accessible sites
  myAccessibleSites: () =>
    apiClient.get<UserSiteAccess[]>('/api/site-access/my-sites'),

  // Grant access
  grant: (data: { userId: string; siteId: string; accessLevel?: 'READ' | 'WRITE'; resourcePermissions?: ResourcePermissions }) =>
    apiClient.post<UserSiteAccess>('/api/site-access', data),

  // Bulk grant access
  bulkGrant: (data: { userIds: string[]; siteId: string; accessLevel?: 'READ' | 'WRITE' }) =>
    apiClient.post<{ granted: number; skipped: number }>('/api/site-access/bulk', data),

  // Update access level and/or resource permissions
  update: (id: string, data: { accessLevel?: 'READ' | 'WRITE'; resourcePermissions?: ResourcePermissions }) =>
    apiClient.patch<UserSiteAccess>(`/api/site-access/${id}`, data),

  // Revoke access
  revoke: (id: string) =>
    apiClient.delete(`/api/site-access/${id}`),

  // Check if current user has access
  checkAccess: (siteId: string) =>
    apiClient.get<{ hasAccess: boolean }>(`/api/site-access/check?siteId=${siteId}`),

  // Get current user's permissions
  myPermissions: () =>
    apiClient.get<{
      role: string;
      allSitesAccess: boolean;
      accessibleSiteIds: string[] | null;
      siteAccess: UserSiteAccess[];
    }>('/api/site-access/my-permissions'),
};
