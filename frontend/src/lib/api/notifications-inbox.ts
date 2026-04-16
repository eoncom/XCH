import { apiClient } from '../api-client';

export interface UserNotification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export const notificationsInboxApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.unreadOnly) q.set('unreadOnly', 'true');
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiClient.get<UserNotification[]>(
      `/api/notifications/inbox/me${qs ? `?${qs}` : ''}`,
    );
  },
  countUnread: () =>
    apiClient.get<{ count: number }>('/api/notifications/inbox/count-unread'),
  markRead: (id: string) =>
    apiClient.patch<UserNotification>(`/api/notifications/inbox/${id}/read`, {}),
  markAllRead: () =>
    apiClient.post<{ updated: number }>('/api/notifications/inbox/mark-all-read', {}),
  remove: (id: string) =>
    apiClient.delete<{ deleted: number }>(`/api/notifications/inbox/${id}`),
};
