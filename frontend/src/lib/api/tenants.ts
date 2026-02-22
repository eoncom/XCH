import { apiClient } from '../api-client';

export interface TenantModule {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface TenantModulesResponse {
  modules: TenantModule[];
}

export interface TenantConfig {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  config: Record<string, any> | null;
}

export const tenantsApi = {
  getCurrent: () =>
    apiClient.get('/api/tenants/current'),

  getConfig: () =>
    apiClient.get<TenantConfig>('/api/tenants/current/config'),

  updateCurrent: (data: { name?: string; logoUrl?: string; primaryColor?: string }) =>
    apiClient.patch('/api/tenants/current', data),

  // Modules
  getModules: () =>
    apiClient.get<TenantModulesResponse>('/api/tenants/modules'),

  updateModules: (modules: Record<string, boolean>) =>
    apiClient.patch<TenantModulesResponse>('/api/tenants/modules', { modules }),
};
