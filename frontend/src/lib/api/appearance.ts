import { apiClient } from '../api-client';

export type AppearanceTheme = 'light' | 'dark' | 'system';
export type AppearanceDensity = 'compact' | 'comfortable';

export interface TenantAppearance {
  theme: AppearanceTheme;
  primaryColor: string;
  density: AppearanceDensity;
  allowUserOverride: boolean;
}

export interface UpdateTenantAppearanceInput {
  theme?: AppearanceTheme;
  primaryColor?: string;
  density?: AppearanceDensity;
  allowUserOverride?: boolean;
}

export interface UpdateUserAppearanceInput {
  theme?: AppearanceTheme;
  primaryColor?: string;
  density?: AppearanceDensity;
  source?: 'inherit' | 'custom';
}

export interface MyAppearanceRaw {
  source: 'inherit' | 'custom';
  preference: Partial<TenantAppearance> | null;
}

export interface EffectiveAppearance extends TenantAppearance {
  source: 'inherit' | 'custom';
  tenant: TenantAppearance;
  user: Partial<TenantAppearance> | null;
}

export const appearanceApi = {
  getTenant: () => apiClient.get<TenantAppearance>('/api/tenants/appearance'),
  updateTenant: (body: UpdateTenantAppearanceInput) =>
    apiClient.patch<TenantAppearance>('/api/tenants/appearance', body),

  getMine: () => apiClient.get<MyAppearanceRaw>('/api/users/me/appearance'),
  updateMine: (body: UpdateUserAppearanceInput) =>
    apiClient.patch<EffectiveAppearance>('/api/users/me/appearance', body),

  getEffective: () => apiClient.get<EffectiveAppearance>('/api/users/me/effective-appearance'),
};
