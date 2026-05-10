import { apiClient } from '../api-client';
import type { PaginationMeta } from '@/components/ui/pagination';

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ========== BILLING ENTITIES ==========

export interface BillingEntity {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  type: string;
  description?: string;
  isActive: boolean;
  delegationId?: string | null;
  siteId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingEntitySummary extends BillingEntity {
  totalBorne: number;
  totalRefactured: number;
  netBorne: number;
  totalImputed: number;
}

export const billingEntitiesApi = {
  getAll: (params?: { type?: string; isActive?: string; search?: string; delegationId?: string; siteId?: string; includeGlobal?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.isActive) qs.set('isActive', params.isActive);
    if (params?.search) qs.set('search', params.search);
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    if (params?.siteId) qs.set('siteId', params.siteId);
    if (params?.includeGlobal !== undefined) qs.set('includeGlobal', String(params.includeGlobal));
    const query = qs.toString();
    return apiClient.get<BillingEntity[]>(`/api/billing-entities${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiClient.get<BillingEntity>(`/api/billing-entities/${id}`),
  getSummary: (id: string) => apiClient.get<BillingEntitySummary>(`/api/billing-entities/${id}/summary`),
  create: (data: Partial<BillingEntity>) => apiClient.post<BillingEntity>('/api/billing-entities', data),
  update: (id: string, data: Partial<BillingEntity>) => apiClient.patch<BillingEntity>(`/api/billing-entities/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/billing-entities/${id}`),
};

// ========== EXPENSES ==========

export interface CostAllocation {
  id: string;
  expenseId: string;
  targetId: string;
  target?: BillingEntity;
  percentage: number;
  amount: number;
  notes?: string;
}

export interface VendorContact {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface Expense {
  id: string;
  tenantId: string;
  label: string;
  description?: string;
  type: string;
  totalAmount: number;
  currency: string;
  frequency: string;
  dateIncurred: string;
  dateStart?: string;
  dateEnd?: string;
  bearerId: string;
  bearer?: BillingEntity;
  delegationId: string;
  siteId?: string | null;
  vendorId?: string | null;
  vendorContact?: VendorContact | null;
  assetId?: string;
  externalRef?: string;
  invoiceRef?: string;
  poNumber?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  allocations: CostAllocation[];
}

export interface CreateExpenseData {
  label: string;
  description?: string;
  type: string;
  totalAmount: number;
  currency?: string;
  frequency?: string;
  dateIncurred: string;
  dateStart?: string;
  dateEnd?: string;
  bearerId: string;
  delegationId: string;
  siteId?: string | null;
  vendorId?: string | null;
  assetId?: string;
  externalRef?: string;
  invoiceRef?: string;
  poNumber?: string;
  notes?: string;
  allocations?: { targetId: string; percentage: number; notes?: string }[];
}

export interface ExpensesSummary {
  totalAmount: number;
  totalAllocated: number;
  count: number;
  byType: Record<string, { count: number; total: number }>;
}

export interface BearerReport {
  bearer: { id: string; name: string; code: string; type: string };
  totalBorne: number;
  totalRefactured: number;
  netBorne: number;
  expenseCount: number;
}

export interface TargetReport {
  target: { id: string; name: string; code: string; type: string };
  totalImputed: number;
  allocationCount: number;
}

function buildExpenseParams(params?: { type?: string; bearerId?: string; vendorId?: string; targetId?: string; dateFrom?: string; dateTo?: string; search?: string; delegationId?: string; siteId?: string; assetId?: string; page?: number; pageSize?: number }) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.bearerId) qs.set('bearerId', params.bearerId);
  if (params?.vendorId) qs.set('vendorId', params.vendorId);
  if (params?.targetId) qs.set('targetId', params.targetId);
  if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params?.dateTo) qs.set('dateTo', params.dateTo);
  if (params?.search) qs.set('search', params.search);
  if (params?.delegationId) qs.set('delegationId', params.delegationId);
  if (params?.siteId) qs.set('siteId', params.siteId);
  if (params?.assetId) qs.set('assetId', params.assetId);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  return qs;
}

export const expensesApi = {
  getAll: async (params?: { type?: string; bearerId?: string; vendorId?: string; targetId?: string; dateFrom?: string; dateTo?: string; search?: string; delegationId?: string; siteId?: string; assetId?: string; page?: number; pageSize?: number }): Promise<Expense[]> => {
    const qs = buildExpenseParams(params);
    const query = qs.toString();
    const res = await apiClient.get<PaginatedResponse<Expense>>(`/api/expenses${query ? `?${query}` : ''}`);
    return res.data;
  },

  getAllPaginated: (params?: { type?: string; bearerId?: string; vendorId?: string; targetId?: string; dateFrom?: string; dateTo?: string; search?: string; delegationId?: string; siteId?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Expense>> => {
    const qs = buildExpenseParams(params);
    const query = qs.toString();
    return apiClient.get<PaginatedResponse<Expense>>(`/api/expenses${query ? `?${query}` : ''}`);
  },

  /**
   * Aggregate over the full filtered set (no pagination slice). Mirrors the
   * filter shape of `getAllPaginated` so the UI can drive both the list and
   * the summary cards from the same query state. Returns sum/count/byType.
   */
  getSummary: (params?: { type?: string; bearerId?: string; vendorId?: string; targetId?: string; dateFrom?: string; dateTo?: string; search?: string; delegationId?: string; siteId?: string }): Promise<ExpensesSummary> => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.bearerId) qs.set('bearerId', params.bearerId);
    if (params?.vendorId) qs.set('vendorId', params.vendorId);
    if (params?.targetId) qs.set('targetId', params.targetId);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.search) qs.set('search', params.search);
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    if (params?.siteId) qs.set('siteId', params.siteId);
    const query = qs.toString();
    return apiClient.get<ExpensesSummary>(`/api/expenses/summary${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiClient.get<Expense>(`/api/expenses/${id}`),
  create: (data: CreateExpenseData) => apiClient.post<Expense>('/api/expenses', data),
  update: (id: string, data: Partial<CreateExpenseData>) => apiClient.patch<Expense>(`/api/expenses/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/expenses/${id}`),

  // Reports
  reportByBearer: (params?: { dateFrom?: string; dateTo?: string; delegationId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    const query = qs.toString();
    return apiClient.get<BearerReport[]>(`/api/expenses/reports/by-bearer${query ? `?${query}` : ''}`);
  },
  reportByTarget: (params?: { dateFrom?: string; dateTo?: string; delegationId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    const query = qs.toString();
    return apiClient.get<TargetReport[]>(`/api/expenses/reports/by-target${query ? `?${query}` : ''}`);
  },
  reportByMonth: (params?: { dateFrom?: string; dateTo?: string; delegationId?: string; expenseType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.delegationId) qs.set('delegationId', params.delegationId);
    if (params?.expenseType) qs.set('expenseType', params.expenseType);
    const query = qs.toString();
    return apiClient.get<Array<{ month: string; total: number; count: number }>>(
      `/api/expenses/reports/by-month${query ? `?${query}` : ''}`,
    );
  },
};
