import { apiClient } from '../api-client';

export interface ChannelConfig {
  inherit: boolean;
  enabled: boolean;
  recipients?: string[];
  webhookUrl?: string;
}

export interface EventConfig {
  inherit: boolean;
  enabled: boolean;
  channels: string[];
}

export interface NotificationConfigData {
  id: string | null;
  tenantId: string;
  delegationId: string | null;
  channels: Record<string, ChannelConfig>;
  events: Record<string, EventConfig>;
  isDefault?: boolean;
}

export interface NotificationMeta {
  events: Record<string, {
    label: string;
    description: string;
    defaultChannels: string[];
    category: string;
  }>;
  channels: { name: string; label: string }[];
}

export interface NotificationLog {
  id: string;
  eventType: string;
  channel: string;
  recipient: string;
  subject: string;
  success: boolean;
  errorMessage?: string;
  context?: Record<string, any>;
  createdAt: string;
}

export const notificationsApi = {
  getMeta: () =>
    apiClient.get<NotificationMeta>('/api/notifications/meta'),

  getConfig: (delegationId: string | null) =>
    apiClient.get<NotificationConfigData>(`/api/notifications/config/${delegationId || 'global'}`),

  getResolvedConfig: (delegationId?: string) => {
    const qs = new URLSearchParams();
    if (delegationId) qs.set('delegationId', delegationId);
    const query = qs.toString();
    return apiClient.get(`/api/notifications/config/resolved${query ? `?${query}` : ''}`);
  },

  saveConfig: (data: { delegationId: string | null; channels: any; events: any }) =>
    apiClient.put('/api/notifications/config', data),

  deleteConfig: (delegationId: string | null) =>
    apiClient.delete(`/api/notifications/config/${delegationId || 'global'}`),

  getAllConfigs: () =>
    apiClient.get<NotificationConfigData[]>('/api/notifications/configs'),

  testChannel: (channel: string, config: any) =>
    apiClient.post<{ success: boolean; error?: string }>('/api/notifications/test', { channel, config }),

  getLogs: async (params?: { page?: number; pageSize?: number; eventType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.eventType) qs.set('eventType', params.eventType);
    const query = qs.toString();
    return apiClient.get<{ data: NotificationLog[]; meta: any }>(`/api/notifications/logs${query ? `?${query}` : ''}`);
  },
};
