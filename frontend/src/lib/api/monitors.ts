import { apiClient } from '../api-client';

export type MonitorKind = 'ICMP' | 'HTTP' | 'TCP';
export type MonitorStatus = 'UP' | 'DOWN' | 'UNKNOWN';
export type HttpMethod = 'GET' | 'HEAD' | 'POST';

export interface MonitorHttpConfig {
  id: string;
  checkId: string;
  method: HttpMethod;
  expectedStatus: number;
  expectedBodyContains: string | null;
  followRedirects: boolean;
  timeoutMs: number;
}

export interface MonitorCheck {
  id: string;
  tenantId: string;
  siteId: string | null;
  assetId: string | null;
  linkId: string | null;
  kind: MonitorKind;
  target: string;
  targetPort: number | null;
  intervalSec: number;
  enabled: boolean;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastStatus: MonitorStatus;
  createdAt: string;
  updatedAt: string;
  httpConfig: MonitorHttpConfig | null;
  site?: { id: string; name: string; code: string; delegationId: string } | null;
  asset?: {
    id: string;
    name: string | null;
    type: string;
    siteId: string | null;
    site?: { id: string; name: string; code: string } | null;
  } | null;
  link?: {
    id: string;
    role: string;
    provider: string;
    type?: string | null;
    siteId: string;
    site?: { id: string; name: string; code: string } | null;
  } | null;
}

export interface MonitorResult {
  id: string;
  checkId: string;
  status: MonitorStatus;
  responseMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface MonitorSummaryWindow {
  total: number;
  up: number;
  uptime: number | null; // percentage 0..100, null if total=0
}

export interface MonitorSummary {
  '24h'?: MonitorSummaryWindow;
  '7d'?: MonitorSummaryWindow;
  '30d'?: MonitorSummaryWindow;
}

export interface CreateMonitorHttpConfigData {
  method?: HttpMethod;
  expectedStatus?: number;
  expectedBodyContains?: string;
  followRedirects?: boolean;
  timeoutMs?: number;
}

export interface CreateMonitorCheckData {
  siteId?: string;
  assetId?: string;
  linkId?: string;
  kind: MonitorKind;
  target: string;
  targetPort?: number;
  intervalSec?: number;
  enabled?: boolean;
  httpConfig?: CreateMonitorHttpConfigData;
}

export type UpdateMonitorCheckData = Partial<Omit<CreateMonitorCheckData, 'siteId' | 'assetId' | 'linkId'>>;

export interface FilterMonitorCheck {
  siteId?: string;
  assetId?: string;
  linkId?: string;
  kind?: MonitorKind;
  enabled?: boolean;
}

export interface HistoryQuery {
  limit?: number;
  // S5 PR4 R1 — keyset pagination (remplace offset). Le client passe le
  // cursor opaque renvoyé par la page précédente.
  cursor?: string;
  status?: MonitorStatus;
}

export interface HistoryPage {
  items: MonitorResult[];
  limit: number;
  nextCursor: string | null;
  hasNext: boolean;
}

function buildParams(filters?: Record<string, any>): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const monitorsApi = {
  getAll: (filters?: FilterMonitorCheck) =>
    apiClient.get<MonitorCheck[]>(`/api/monitors${buildParams(filters)}`),

  getById: (id: string) =>
    apiClient.get<MonitorCheck>(`/api/monitors/${id}`),

  create: (data: CreateMonitorCheckData) =>
    apiClient.post<MonitorCheck>('/api/monitors', data),

  update: (id: string, data: UpdateMonitorCheckData) =>
    apiClient.patch<MonitorCheck>(`/api/monitors/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/api/monitors/${id}`),

  history: (id: string, query?: HistoryQuery) =>
    apiClient.get<HistoryPage>(
      `/api/monitors/${id}/history${buildParams(query)}`,
    ),

  summary: (id: string) =>
    apiClient.get<MonitorSummary>(`/api/monitors/${id}/summary`),

  runNow: (id: string) =>
    apiClient.post<{ enqueued: boolean }>(`/api/monitors/${id}/run-now`, {}),
};
