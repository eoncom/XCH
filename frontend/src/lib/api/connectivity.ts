import { apiClient } from '../api-client';

export type ConnectivityRole = 'PRIMARY' | 'BACKUP' | 'OTHER';

export interface ConnectivityLink {
  id: string;
  tenantId: string;
  siteId: string;
  role: ConnectivityRole;
  provider: string;
  type: string;
  bandwidthDown: number | null;
  bandwidthUp: number | null;
  publicIp: string | null;
  monthlyPrice: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  contractRef: string | null;
  notes: string | null;
  assetId: string | null;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
  site?: { id: string; name: string; code: string; delegationId: string } | null;
  asset?: {
    id: string;
    name: string | null;
    type: string;
    serialNumber: string | null;
  } | null;
  expense?: {
    id: string;
    label: string;
    totalAmount: number;
    frequency: string;
  } | null;
}

export interface CreateConnectivityLinkData {
  siteId: string;
  role: ConnectivityRole;
  provider: string;
  type: string;
  bandwidthDown?: number;
  bandwidthUp?: number;
  publicIp?: string;
  monthlyPrice?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  contractRef?: string;
  notes?: string;
  // Explicit null = detach the currently linked asset on update.
  assetId?: string | null;
}

export type UpdateConnectivityLinkData = Partial<CreateConnectivityLinkData>;

export interface FilterConnectivityLink {
  siteId?: string;
  role?: ConnectivityRole;
  type?: string;
}

function buildParams(filters?: FilterConnectivityLink): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  if (filters.siteId) qs.set('siteId', filters.siteId);
  if (filters.role) qs.set('role', filters.role);
  if (filters.type) qs.set('type', filters.type);
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const connectivityApi = {
  getAll: (filters?: FilterConnectivityLink) =>
    apiClient.get<ConnectivityLink[]>(`/api/connectivity${buildParams(filters)}`),

  getById: (id: string) =>
    apiClient.get<ConnectivityLink>(`/api/connectivity/${id}`),

  create: (data: CreateConnectivityLinkData) =>
    apiClient.post<ConnectivityLink>('/api/connectivity', data),

  update: (id: string, data: UpdateConnectivityLinkData) =>
    apiClient.patch<ConnectivityLink>(`/api/connectivity/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<{ deleted: boolean }>(`/api/connectivity/${id}`),

  generateExpense: (id: string, body: { bearerId: string; label?: string }) =>
    apiClient.post<ConnectivityLink>(`/api/connectivity/${id}/generate-expense`, body),

  // ADR-011 resync linked expense from current monthlyPrice
  resyncExpense: (id: string) =>
    apiClient.patch<{ expense: any; before: number; after: number }>(
      `/api/connectivity/${id}/resync-expense`,
      {},
    ),
};
