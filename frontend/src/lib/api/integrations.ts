import { apiClient } from '../api-client';
import type {
  IntegrationStatus,
  IntegrationTestResult,
  IntegrationMapping,
  SyncResult,
  NetboxPaginatedResponse,
  NetboxContact,
  NetboxContactGroup,
  NetboxSiteRemote,
  NetboxDeviceRemote,
  NetboxRackRemote,
} from '@/types';

export interface IntegrationConfigResponse {
  netbox: {
    url: string;
    tokenSet: boolean;
    tokenHint: string;
  };
  monitoring: {
    type: string;
    url: string;
    username: string;
    apiKeySet: boolean;
    apiKeyHint: string;
    passwordSet: boolean;
    passwordHint: string;
    webhookSecret: string;
    webhookEnabled: boolean;
  };
  /** @deprecated Use monitoring instead */
  uptimeKuma: {
    url: string;
    username: string;
    passwordSet: boolean;
    passwordHint: string;
  };
}

export const integrationsApi = {
  // Status & Connection
  getStatus: () =>
    apiClient.get<{
      netbox: IntegrationStatus;
      uptimeKuma: IntegrationStatus;
    }>('/api/integrations/status'),

  testConnection: (provider: 'netbox' | 'uptime_kuma') =>
    apiClient.post<IntegrationTestResult>(`/api/integrations/test/${provider}`),

  testAll: () =>
    apiClient.post<{
      netbox: IntegrationTestResult;
      uptimeKuma: IntegrationTestResult;
    }>('/api/integrations/test-all'),

  // Config
  getConfig: () =>
    apiClient.get<IntegrationConfigResponse>('/api/integrations/config'),

  saveConfig: (data: Record<string, any>) =>
    apiClient.patch<IntegrationConfigResponse>('/api/integrations/config', data),

  // NetBox proxy
  netbox: {
    getSites: (params?: { limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      const query = searchParams.toString();
      return apiClient.get<NetboxPaginatedResponse<NetboxSiteRemote>>(
        `/api/integrations/netbox/sites${query ? `?${query}` : ''}`
      );
    },

    getDevices: (params?: { limit?: number; offset?: number; site_id?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      if (params?.site_id) searchParams.append('site_id', String(params.site_id));
      const query = searchParams.toString();
      return apiClient.get<NetboxPaginatedResponse<NetboxDeviceRemote>>(
        `/api/integrations/netbox/devices${query ? `?${query}` : ''}`
      );
    },

    getRacks: (params?: { limit?: number; offset?: number; site_id?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      if (params?.site_id) searchParams.append('site_id', String(params.site_id));
      const query = searchParams.toString();
      return apiClient.get<NetboxPaginatedResponse<NetboxRackRemote>>(
        `/api/integrations/netbox/racks${query ? `?${query}` : ''}`
      );
    },

    getContacts: (params?: { limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      const query = searchParams.toString();
      return apiClient.get<NetboxPaginatedResponse<NetboxContact>>(
        `/api/integrations/netbox/contacts${query ? `?${query}` : ''}`
      );
    },

    getContactGroups: (params?: { limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', String(params.limit));
      if (params?.offset) searchParams.append('offset', String(params.offset));
      const query = searchParams.toString();
      return apiClient.get<NetboxPaginatedResponse<NetboxContactGroup>>(
        `/api/integrations/netbox/contact-groups${query ? `?${query}` : ''}`
      );
    },

    syncSites: (options: { autoCreate?: boolean; updateExisting?: boolean }) =>
      apiClient.post<SyncResult>('/api/integrations/netbox/sync/sites', options),

    syncDevices: (options: { siteId: string; netboxSiteId?: string; autoCreate?: boolean }) =>
      apiClient.post<SyncResult>('/api/integrations/netbox/sync/devices', options),

    syncContacts: () =>
      apiClient.post<SyncResult>('/api/integrations/netbox/sync/contacts'),
  },

  // Monitoring (generic — supports Uptime Kuma, Gatus, etc.)
  monitoring: {
    getMonitors: () =>
      apiClient.get<any>('/api/integrations/monitoring/monitors'),

    syncSiteHealth: (siteId: string, monitorName: string) =>
      apiClient.post(`/api/integrations/monitoring/sync/health/${siteId}?monitor=${encodeURIComponent(monitorName)}`),

    syncAllHealth: () =>
      apiClient.post('/api/integrations/monitoring/sync/health-all'),

    mapMonitorToSite: (siteId: string, monitorName: string | null) =>
      apiClient.patch<{ siteId: string; monitorName: string | null; mapped: boolean }>(
        '/api/integrations/monitoring/map-monitor',
        { siteId, monitorName }
      ),

    getMonitorMappings: () =>
      apiClient.get<Record<string, { siteId: string; siteName: string }>>(
        '/api/integrations/monitoring/monitor-mappings'
      ),

    mapMonitorToAsset: (assetId: string, monitorName: string | null) =>
      apiClient.patch<{ assetId: string; monitorName: string | null; mapped: boolean }>(
        '/api/integrations/monitoring/map-monitor-to-asset',
        { assetId, monitorName }
      ),
  },

  /** @deprecated Use monitoring instead */
  uptimeKuma: {
    getMonitors: () =>
      apiClient.get<any>('/api/integrations/monitoring/monitors'),
    syncAllHealth: () =>
      apiClient.post('/api/integrations/monitoring/sync/health-all'),
    mapMonitorToSite: (siteId: string, monitorName: string | null) =>
      apiClient.patch<{ siteId: string; monitorName: string | null; mapped: boolean }>(
        '/api/integrations/monitoring/map-monitor',
        { siteId, monitorName }
      ),
    getMonitorMappings: () =>
      apiClient.get<Record<string, { siteId: string; siteName: string }>>(
        '/api/integrations/monitoring/monitor-mappings'
      ),
    mapMonitorToAsset: (assetId: string, monitorName: string | null) =>
      apiClient.patch<{ assetId: string; monitorName: string | null; mapped: boolean }>(
        '/api/integrations/monitoring/map-monitor-to-asset',
        { assetId, monitorName }
      ),
  },

  // Health
  health: {
    getSiteBreakdown: (siteId: string) =>
      apiClient.get<{
        overall: string;
        timestamp: string;
        components: Array<{
          type: 'link' | 'sdwan' | 'asset';
          id: string;
          name: string;
          status: 'up' | 'down' | 'unknown';
          role?: string;
          impact: 'critical' | 'warning' | 'none';
        }>;
      }>(`/api/integrations/sites/${siteId}/health-breakdown`),
  },

  // Integration Mapping
  mapping: {
    get: (provider: string, entityType: string) =>
      apiClient.get<IntegrationMapping[]>(
        `/api/integrations/mapping/${provider}/${entityType}`
      ),

    save: (
      provider: string,
      entityType: string,
      mappings: Array<{
        externalId: string;
        externalLabel: string;
        targetType: string;
        targetId: string;
      }>
    ) =>
      apiClient.post<IntegrationMapping[]>(
        `/api/integrations/mapping/${provider}/${entityType}`,
        { mappings }
      ),

    deleteAll: (provider: string, entityType: string) =>
      apiClient.delete(
        `/api/integrations/mapping/${provider}/${entityType}`
      ),

    deleteOne: (id: string) =>
      apiClient.delete(`/api/integrations/mapping/single/${id}`),
  },
};
