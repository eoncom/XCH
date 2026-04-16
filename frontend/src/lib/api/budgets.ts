import { apiClient } from '../api-client';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Budget {
  id: string;
  tenantId: string;
  label: string;
  delegationId: string | null;
  siteId: string | null;
  expenseType: string | null;
  period: 'MONTH' | 'YEAR';
  startDate: string;
  endDate: string;
  amount: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  delegation?: { id: string; name: string; code: string } | null;
  site?: { id: string; name: string; code: string } | null;
}

export interface BudgetStatus {
  budget: Budget;
  budgeted: number;
  spent: number;
  remaining: number;
  progressPct: number;
  overBudget: boolean;
}

export interface CreateBudgetData {
  label: string;
  delegationId?: string;
  siteId?: string;
  expenseType?: string;
  period: 'MONTH' | 'YEAR';
  startDate: string;
  endDate: string;
  amount: number;
  currency?: string;
  notes?: string;
}

export interface BudgetFilters {
  delegationId?: string;
  siteId?: string;
  expenseType?: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectionResult {
  totals: {
    total: number;
    byType: Record<string, number>;
    byDelegation: Record<string, number>;
    bySite: Record<string, number>;
  };
  byMonth: {
    month: string;
    total: number;
    byType: Record<string, number>;
    byDelegation: Record<string, number>;
    bySite: Record<string, number>;
  }[];
}

function buildParams(filters?: BudgetFilters): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  if (filters.delegationId) qs.set('delegationId', filters.delegationId);
  if (filters.siteId) qs.set('siteId', filters.siteId);
  if (filters.expenseType) qs.set('expenseType', filters.expenseType);
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.pageSize) qs.set('pageSize', String(filters.pageSize));
  const query = qs.toString();
  return query ? `?${query}` : '';
}

export const budgetsApi = {
  getAll: (filters?: BudgetFilters) =>
    apiClient.get<PaginatedResponse<Budget>>(`/api/budgets${buildParams(filters)}`),

  getById: (id: string) =>
    apiClient.get<Budget>(`/api/budgets/${id}`),

  getStatus: (id: string) =>
    apiClient.get<BudgetStatus>(`/api/budgets/${id}/status`),

  create: (data: CreateBudgetData) =>
    apiClient.post<Budget>('/api/budgets', data),

  update: (id: string, data: Partial<CreateBudgetData>) =>
    apiClient.patch<Budget>(`/api/budgets/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/budgets/${id}`),
};

// Add projection to expenses API
export const expenseProjectionApi = {
  getProjection: (from: string, to: string, groupBy?: 'type' | 'delegation' | 'site') => {
    const qs = new URLSearchParams({ from, to });
    if (groupBy) qs.set('groupBy', groupBy);
    return apiClient.get<ProjectionResult>(`/api/expenses/projection?${qs.toString()}`);
  },
};
