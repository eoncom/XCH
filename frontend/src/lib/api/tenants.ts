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

export interface SsoConfig {
  enabled: boolean;
  provider: string;
  issuer: string;
  clientId: string;
  clientSecretSet: boolean;
  clientSecretHint: string;
  callbackUrl: string;
  roleMapping: Record<string, string>;
}

export interface UpdateSsoConfigData {
  enabled?: boolean;
  provider?: string;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  roleMapping?: Record<string, string>;
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

  // SSO Configuration
  getSsoConfig: () =>
    apiClient.get<SsoConfig>('/api/tenants/sso-config'),

  updateSsoConfig: (data: UpdateSsoConfigData) =>
    apiClient.patch<SsoConfig>('/api/tenants/sso-config', data),
};
