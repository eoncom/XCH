import { apiClient } from '../api-client';

export interface AuditEntry {
  id: string;
  tenantId: string;
  userId?: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId?: string | null;
  changes?: { before?: Record<string, any>; after?: Record<string, any> } | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: string;
  user?: { id: string; name: string; email: string } | null;
}

export interface AuditQueryParams {
  entity?: string;
  entityId?: string;
  userId?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResult {
  data: AuditEntry[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export const auditApi = {
  query: (params: AuditQueryParams = {}) => {
    const q = new URLSearchParams();
    if (params.entity) q.set('entity', params.entity);
    if (params.entityId) q.set('entityId', params.entityId);
    if (params.userId) q.set('userId', params.userId);
    if (params.action) q.set('action', params.action);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return apiClient.get<AuditQueryResult>(`/api/audit${qs ? `?${qs}` : ''}`);
  },
  forEntity: (type: string, id: string, limit = 50) =>
    apiClient.get<AuditQueryResult>(
      `/api/audit/entity/${encodeURIComponent(type)}/${encodeURIComponent(id)}?limit=${limit}`,
    ),
};
