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
  scopeType: string;
  scopeId: string;
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

  getConfig: (scopeType: string, scopeId: string) =>
    apiClient.get<NotificationConfigData>(`/api/notifications/config/${scopeType}/${scopeId}`),

  getResolvedConfig: (params?: { delegationId?: string; divisionId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    if (params?.divisionId) qs.set('divisionId', params.divisionId);
    const query = qs.toString();
    return apiClient.get(`/api/notifications/config/resolved${query ? `?${query}` : ''}`);
  },

  saveConfig: (data: { scopeType: string; scopeId: string; channels: any; events: any }) =>
    apiClient.put('/api/notifications/config', data),

  deleteConfig: (scopeType: string, scopeId: string) =>
    apiClient.delete(`/api/notifications/config/${scopeType}/${scopeId}`),

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
