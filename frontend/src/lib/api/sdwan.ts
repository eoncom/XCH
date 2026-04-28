import { apiClient } from '../api-client';

export type SdwanFirewallRole = 'active' | 'passive' | 'peer';

export interface SdwanFirewallAsset {
  id: string;
  name: string | null;
  type: string;
  serialNumber: string | null;
  status: string;
  // ADR-018 — split scalars (formerly networkInfo JSON).
  ip: string | null;
  mac: string | null;
  hostname: string | null;
  vlan: string | null;
  port: string | null;
}

export interface SdwanFirewall {
  id: string;
  sdwanConfigId: string;
  assetId: string;
  role: SdwanFirewallRole | null;
  createdAt: string;
  asset: SdwanFirewallAsset;
}

export interface SdwanConfig {
  id: string;
  tenantId: string;
  siteId: string;
  enabled: boolean;
  provider: string | null;
  monitorName: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  firewalls: SdwanFirewall[];
}

export interface UpsertSdwanConfigData {
  enabled?: boolean;
  provider?: string | null;
  monitorName?: string | null;
  notes?: string | null;
}

export interface AttachFirewallData {
  assetId: string;
  role?: SdwanFirewallRole;
}

export const sdwanApi = {
  get: (siteId: string) =>
    apiClient.get<SdwanConfig | null>(`/api/sdwan/${siteId}`),

  upsert: (siteId: string, data: UpsertSdwanConfigData) =>
    apiClient.put<SdwanConfig>(`/api/sdwan/${siteId}`, data),

  remove: (siteId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/api/sdwan/${siteId}`),

  attachFirewall: (siteId: string, data: AttachFirewallData) =>
    apiClient.post<SdwanConfig>(`/api/sdwan/${siteId}/firewalls`, data),

  detachFirewall: (siteId: string, assetId: string) =>
    apiClient.delete<SdwanConfig>(`/api/sdwan/${siteId}/firewalls/${assetId}`),
};
