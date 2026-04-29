import { apiClient } from '../api-client';

/**
 * ADR-020 — flat shape mirroring the backend's NotificationChannel +
 * NotificationRule tables. webhookUrl is plaintext over the wire (decrypted
 * at API boundary by NotificationSettingsService).
 */
export type NotificationChannelKind = 'EMAIL' | 'TEAMS';

export type NotificationEventType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'SITE_STATUS_CHANGED'
  | 'ASSET_CRITICAL'
  | 'MONITOR_DOWN'
  | 'MONITOR_UP'
  | 'USER_INVITED'
  | 'PASSWORD_RESET';

export interface NotificationChannelDto {
  id?: string;
  kind: NotificationChannelKind;
  enabled: boolean;
  /** EMAIL only. */
  recipients: string[];
  /** TEAMS only. Plaintext at write, returned as plaintext for the form. */
  webhookUrl: string | null;
  /** Read-only metadata. */
  webhookUrlSet?: boolean;
  webhookUrlHint?: string | null;
}

export interface NotificationRuleDto {
  id?: string;
  eventType: NotificationEventType;
  enabled: boolean;
  channels: NotificationChannelKind[];
}

export interface NotificationSettings {
  scope: { tenantId: string; delegationId: string | null };
  channels: NotificationChannelDto[];
  rules: NotificationRuleDto[];
  isDefault: boolean;
}

export interface ResolvedSettings {
  channels: Array<{
    kind: NotificationChannelKind;
    recipients: string[];
    webhookUrl: string | null;
    enabled: boolean;
  }>;
  rules: Array<{
    eventType: NotificationEventType;
    enabled: boolean;
    channels: NotificationChannelKind[];
    source: 'global' | 'delegation' | 'default';
  }>;
}

export interface NotificationMeta {
  events: Record<NotificationEventType, {
    label: string;
    description: string;
    defaultChannels: NotificationChannelKind[];
    category: 'tasks' | 'sites' | 'assets' | 'monitoring' | 'auth';
  }>;
  channels: { kind: NotificationChannelKind; label: string }[];
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
  getMeta: () => apiClient.get<NotificationMeta>('/api/notifications/meta'),

  getSettings: (delegationId: string | null) =>
    apiClient.get<NotificationSettings>(
      `/api/notifications/config/${delegationId || 'global'}`,
    ),

  getResolvedSettings: (delegationId?: string) => {
    const qs = new URLSearchParams();
    if (delegationId) qs.set('delegationId', delegationId);
    const query = qs.toString();
    return apiClient.get<ResolvedSettings>(
      `/api/notifications/config/resolved${query ? `?${query}` : ''}`,
    );
  },

  saveSettings: (data: {
    delegationId: string | null;
    channels: Array<Pick<NotificationChannelDto, 'kind' | 'enabled' | 'recipients' | 'webhookUrl'>>;
    rules: Array<Pick<NotificationRuleDto, 'eventType' | 'enabled' | 'channels'>>;
  }) => apiClient.put<NotificationSettings>('/api/notifications/config', data),

  deleteSettings: (delegationId: string | null) =>
    apiClient.delete(`/api/notifications/config/${delegationId || 'global'}`),

  getAllSettings: () =>
    apiClient.get<{
      channels: NotificationChannelDto[];
      rules: NotificationRuleDto[];
    }>('/api/notifications/configs'),

  testChannel: (
    kind: NotificationChannelKind,
    config: { recipients?: string[]; webhookUrl?: string | null },
  ) =>
    apiClient.post<{ success: boolean; error?: string }>('/api/notifications/test', {
      kind,
      ...config,
    }),

  getLogs: async (params?: { page?: number; pageSize?: number; eventType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params?.eventType) qs.set('eventType', params.eventType);
    const query = qs.toString();
    return apiClient.get<{ data: NotificationLog[]; meta: any }>(
      `/api/notifications/logs${query ? `?${query}` : ''}`,
    );
  },
};
