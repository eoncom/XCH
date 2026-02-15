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

  // Uptime Kuma
  uptimeKuma: {
    getMonitors: () =>
      apiClient.get<Array<{
        id: number;
        name: string;
        type: string;
        status: 'up' | 'down' | 'unknown';
        responseTime: number;
        certExpiry?: number;
      }>>('/api/integrations/uptime-kuma/monitors'),

    syncSiteHealth: (siteId: string, monitorName: string) =>
      apiClient.post(`/api/integrations/uptime-kuma/sync/health/${siteId}?monitor=${encodeURIComponent(monitorName)}`),

    syncAllHealth: () =>
      apiClient.post('/api/integrations/uptime-kuma/sync/health-all'),
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
