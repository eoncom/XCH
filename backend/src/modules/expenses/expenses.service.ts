import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, AllocationDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';
import { BudgetsService } from '../budgets/budgets.service';

const EXPENSE_INCLUDE: any = {
  bearer: { select: { id: true, name: true, code: true, type: true } },
  vendorContact: { select: { id: true, name: true, company: true, email: true, phone: true } },
  allocations: {
    include: { target: { select: { id: true, name: true, code: true, type: true } } },
  },
};

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private prisma: PrismaClient,
    @Inject(forwardRef(() => BudgetsService))
    private readonly budgets: BudgetsService,
  ) {}

  /**
   * Fire-and-forget: after a mutation on an expense, re-evaluate every budget
   * it matches and emit a threshold-crossing notification if needed. Wrapped
   * in try/catch so an alert failure never breaks the expense mutation.
   */
  private triggerBudgetThresholdCheck(tenantId: string, expense: {
    delegationId?: string | null;
    siteId?: string | null;
    type?: string | null;
    dateIncurred: Date;
  }) {
    // Intentionally not awaited — don't block the HTTP response on alerting.
    this.budgets
      .checkThresholdsForExpense(tenantId, expense)
      .catch((err) => this.logger.warn(`Budget threshold check failed: ${err?.message}`));
  }

  async create(tenantId: string, dto: CreateExpenseDto, createdBy: string) {
    // Validate bearer
    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: dto.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    // Validate delegation/site coherence (R1) — delegationId is mandatory for expenses (R2)
    await validateDelegationSiteCoherence(this.prisma as any, dto.delegationId, dto.siteId);

    // Validate vendorId references a PROVIDER contact
    if (dto.vendorId) {
      await this.validateVendorContact(tenantId, dto.vendorId);
    }

    // Validate allocations
    if (dto.allocations?.length) {
      this.validateAllocations(dto.allocations);
      await this.validateAllocationTargets(tenantId, dto.allocations);
    }

    const { allocations, ...rest } = dto;

    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        label: rest.label,
        description: rest.description,
        type: rest.type as any,
        totalAmount: rest.totalAmount,
        currency: rest.currency || 'EUR',
        frequency: (rest.frequency || 'ONE_TIME') as any,
        dateIncurred: new Date(rest.dateIncurred),
        dateStart: rest.dateStart ? new Date(rest.dateStart) : null,
        dateEnd: rest.dateEnd ? new Date(rest.dateEnd) : null,
        bearerId: rest.bearerId,
        delegationId: rest.delegationId,
        siteId: rest.siteId || null,
        vendorId: rest.vendorId || null,
        assetId: rest.assetId,
        externalRef: rest.externalRef,
        invoiceRef: rest.invoiceRef,
        poNumber: rest.poNumber,
        notes: rest.notes,
        createdBy,
        allocations: allocations?.length
          ? {
              create: allocations.map((a) => ({
                targetId: a.targetId,
                percentage: a.percentage,
                amount: (rest.totalAmount * a.percentage) / 100,
                notes: a.notes,
              })),
            }
          : undefined,
      } as any,
      include: EXPENSE_INCLUDE,
    });

    this.triggerBudgetThresholdCheck(tenantId, {
      delegationId: expense.delegationId,
      siteId: expense.siteId,
      type: expense.type,
      dateIncurred: expense.dateIncurred,
    });

    return expense;
  }

  /**
   * When `scopeDelegationIds` is null, the caller is super-admin — no
   * delegation restriction. When it's an array, every expense must match one
   * of those delegationIds (including merging with an explicit `delegationId`
   * filter, which the controller guarantees is already in-scope).
   */
  async findAll(
    tenantId: string,
    filters: FilterExpenseDto = {},
    scopeDelegationIds: string[] | null = null,
  ) {
    const where: any = { tenantId };
    if (filters.type) where.type = filters.type;
    if (filters.bearerId) where.bearerId = filters.bearerId;
    if (filters.vendorId) where.vendorId = filters.vendorId;
    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) {
        return buildPaginatedResponse([], 0, Number(filters.page) || 1, Number(filters.pageSize) || 25);
      }
      where.delegationId = { in: scopeDelegationIds };
    }

    if (filters.search) {
      where.OR = [
        { label: { contains: filters.search, mode: 'insensitive' } },
        { externalRef: { contains: filters.search, mode: 'insensitive' } },
        { vendorContact: { name: { contains: filters.search, mode: 'insensitive' } } },
        { vendorContact: { company: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    if (filters.dateFrom || filters.dateTo) {
      where.dateIncurred = {};
      if (filters.dateFrom) where.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters.targetId) {
      where.allocations = { some: { targetId: filters.targetId } };
    }

    // Delegation filter
    if (filters.delegationId) where.delegationId = filters.delegationId;

    // Site filter
    if (filters.siteId) where.siteId = filters.siteId;

    // Asset filter (ADR-011 — list expenses linked to a specific asset)
    if ((filters as any).assetId) where.assetId = (filters as any).assetId;

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const sortField = filters.sortBy || 'dateIncurred';
    const sortOrder = filters.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: { [sortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        bearer: true,
        vendorContact: true,
        allocations: { include: { target: true } },
      } as any,
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    if (dto.bearerId) {
      const bearer = await this.prisma.billingEntity.findFirst({
        where: { id: dto.bearerId, tenantId },
      });
      if (!bearer) throw new NotFoundException('Bearer billing entity not found');
    }

    // Validate delegation/site coherence if changing (R1)
    const delegationId = 'delegationId' in dto ? dto.delegationId : (expense as any).delegationId;
    const siteId = 'siteId' in dto ? dto.siteId : (expense as any).siteId;
    await validateDelegationSiteCoherence(this.prisma as any, delegationId, siteId);

    // Validate vendorId if changing
    if (dto.vendorId) {
      await this.validateVendorContact(tenantId, dto.vendorId);
    }

    const { allocations, ...updateData } = dto;
    const data: any = { ...updateData };
    if (dto.dateIncurred) data.dateIncurred = new Date(dto.dateIncurred);
    if (dto.dateStart !== undefined) data.dateStart = dto.dateStart ? new Date(dto.dateStart) : null;
    if (dto.dateEnd !== undefined) data.dateEnd = dto.dateEnd ? new Date(dto.dateEnd) : null;
    if (dto.vendorId === null) data.vendorId = null;
    if ('siteId' in dto && dto.siteId === null) data.siteId = null;

    // If allocations provided, replace them
    let updated: any;
    if (allocations !== undefined) {
      this.validateAllocations(allocations);
      await this.validateAllocationTargets(tenantId, allocations);

      const totalAmount = dto.totalAmount || expense.totalAmount;

      updated = await this.prisma.$transaction(async (tx) => {
        await tx.costAllocation.deleteMany({ where: { expenseId: id } });

        return tx.expense.update({
          where: { id },
          data: {
            ...data,
            allocations: {
              create: allocations.map((a) => ({
                targetId: a.targetId,
                percentage: a.percentage,
                amount: (totalAmount * a.percentage) / 100,
                notes: a.notes,
              })),
            },
          },
          include: EXPENSE_INCLUDE,
        });
      });
    } else {
      updated = await this.prisma.expense.update({
        where: { id },
        data,
        include: EXPENSE_INCLUDE,
      });
    }

    this.triggerBudgetThresholdCheck(tenantId, {
      delegationId: updated.delegationId,
      siteId: updated.siteId,
      type: updated.type,
      dateIncurred: updated.dateIncurred,
    });

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted' };
  }

  // ========== REPORTS ==========

  async reportByBearer(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string; delegationId?: string },
    scopeDelegationIds: string[] | null = null,
  ) {
    const where: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      where.dateIncurred = {};
      if (filters.dateFrom) where.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters?.delegationId) where.delegationId = filters.delegationId;
    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) return [];
      where.delegationId = where.delegationId
        ? where.delegationId
        : { in: scopeDelegationIds };
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        bearer: { select: { id: true, name: true, code: true, type: true } },
        allocations: { select: { amount: true, targetId: true } },
      },
    });

    const bearerMap = new Map<string, {
      bearer: { id: string; name: string; code: string; type: string };
      totalBorne: number;
      totalRefactured: number;
      netBorne: number;
      expenseCount: number;
    }>();

    for (const exp of expenses) {
      const key = exp.bearerId;
      if (!bearerMap.has(key)) {
        bearerMap.set(key, {
          bearer: exp.bearer,
          totalBorne: 0,
          totalRefactured: 0,
          netBorne: 0,
          expenseCount: 0,
        });
      }
      const entry = bearerMap.get(key)!;
      entry.totalBorne += exp.totalAmount;
      entry.totalRefactured += exp.allocations.reduce((sum, a) => sum + a.amount, 0);
      entry.expenseCount++;
    }

    for (const entry of bearerMap.values()) {
      entry.netBorne = entry.totalBorne - entry.totalRefactured;
    }

    return Array.from(bearerMap.values()).sort((a, b) => b.totalBorne - a.totalBorne);
  }

  async reportByTarget(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string; delegationId?: string },
    scopeDelegationIds: string[] | null = null,
  ) {
    const expenseWhere: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      expenseWhere.dateIncurred = {};
      if (filters.dateFrom) expenseWhere.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) expenseWhere.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters?.delegationId) expenseWhere.delegationId = filters.delegationId;
    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) return [];
      expenseWhere.delegationId = expenseWhere.delegationId
        ? expenseWhere.delegationId
        : { in: scopeDelegationIds };
    }

    const allocations = await this.prisma.costAllocation.findMany({
      where: { expense: expenseWhere },
      include: {
        target: { select: { id: true, name: true, code: true, type: true } },
      },
    });

    const targetMap = new Map<string, {
      target: { id: string; name: true; code: string; type: string };
      totalImputed: number;
      allocationCount: number;
    }>();

    for (const alloc of allocations) {
      const key = alloc.targetId;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          target: alloc.target as any,
          totalImputed: 0,
          allocationCount: 0,
        });
      }
      const entry = targetMap.get(key)!;
      entry.totalImputed += alloc.amount;
      entry.allocationCount++;
    }

    return Array.from(targetMap.values()).sort((a, b) => b.totalImputed - a.totalImputed);
  }

  /**
   * Monthly spending evolution — returns totals per YYYY-MM for a date range.
   * Feeds the dashboard chart on /dashboard/costs. Includes ONE_TIME expenses
   * plus expanded MONTHLY/QUARTERLY/YEARLY recurring over their effective
   * window (same logic as BudgetsService.getStatus).
   */
  async reportByMonth(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string; delegationId?: string; expenseType?: string },
    scopeDelegationIds: string[] | null = null,
  ) {
    const where: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      where.dateIncurred = {};
      if (filters.dateFrom) where.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters?.delegationId) where.delegationId = filters.delegationId;
    if (filters?.expenseType) where.type = filters.expenseType;
    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) return [];
      where.delegationId = where.delegationId
        ? where.delegationId
        : { in: scopeDelegationIds };
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        totalAmount: true,
        frequency: true,
        dateIncurred: true,
        dateStart: true,
        dateEnd: true,
        type: true,
        currency: true,
      },
    });

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = new Map<string, { month: string; total: number; count: number }>();

    // Helper to add an amount to a month bucket
    const add = (key: string, amount: number) => {
      if (!bucket.has(key)) bucket.set(key, { month: key, total: 0, count: 0 });
      const b = bucket.get(key)!;
      b.total += amount;
      b.count += 1;
    };

    const windowStart = filters?.dateFrom ? new Date(filters.dateFrom) : null;
    const windowEnd = filters?.dateTo ? new Date(filters.dateTo) : null;

    for (const exp of expenses) {
      if (exp.frequency === 'ONE_TIME') {
        add(monthKey(exp.dateIncurred), Number(exp.totalAmount));
        continue;
      }

      // Expand recurring expenses across their effective window, clipped to
      // the report window.
      const effStart =
        exp.dateStart && (!windowStart || exp.dateStart > windowStart) ? exp.dateStart : windowStart ?? exp.dateIncurred;
      const effEnd =
        exp.dateEnd && (!windowEnd || exp.dateEnd < windowEnd) ? exp.dateEnd : windowEnd ?? new Date();
      if (effStart > effEnd) continue;

      const monthsInPeriod = this.monthsBetweenInclusive(effStart, effEnd);
      const perMonth =
        exp.frequency === 'MONTHLY'
          ? Number(exp.totalAmount)
          : exp.frequency === 'QUARTERLY'
            ? Number(exp.totalAmount) / 3
            : exp.frequency === 'YEARLY'
              ? Number(exp.totalAmount) / 12
              : 0;

      const cursor = new Date(effStart.getFullYear(), effStart.getMonth(), 1);
      for (let i = 0; i < monthsInPeriod; i++) {
        add(monthKey(cursor), perMonth);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    return Array.from(bucket.values())
      .map((b) => ({ ...b, total: Math.round(b.total * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private monthsBetweenInclusive(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;
    return Math.max(0, months);
  }

  async reportChargeback(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string },
    scopeDelegationIds: string[] | null = null,
  ) {
    const dateFilter: any = {};
    if (filters?.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) dateFilter.lte = new Date(filters.dateTo);

    if (scopeDelegationIds !== null && scopeDelegationIds.length === 0) return [];

    const expenseWhere: any = {
      tenantId,
      ...(Object.keys(dateFilter).length ? { dateIncurred: dateFilter } : {}),
      ...(scopeDelegationIds !== null ? { delegationId: { in: scopeDelegationIds } } : {}),
    };

    const allocations = await this.prisma.costAllocation.findMany({
      where: { expense: expenseWhere },
      include: {
        target: { select: { id: true, name: true, code: true } },
        expense: {
          select: {
            id: true,
            label: true,
            type: true,
            totalAmount: true,
            dateIncurred: true,
            delegationId: true,
            bearer: { select: { id: true, name: true, code: true } },
          } as any,
        },
      },
      orderBy: { expense: { dateIncurred: 'desc' } },
    });

    return allocations;
  }

  // ========== PROJECTION ==========

  /**
   * Project expenses over a date range, expanding recurring expenses into monthly tranches.
   * Returns totals and per-month breakdown, optionally grouped by type/delegation/site.
   */
  async projection(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    groupBy?: 'type' | 'delegation' | 'site',
  ) {
    // Accept both "YYYY-MM" and "YYYY-MM-DD" (normalize to first-of-month)
    const toMonthStart = (s: string) => {
      if (!s) throw new BadRequestException('from and to are required');
      const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(s);
      if (!m) throw new BadRequestException(`Invalid date "${s}". Use YYYY-MM or YYYY-MM-DD.`);
      return new Date(`${m[1]}-${m[2]}-01T00:00:00Z`);
    };
    const from = toMonthStart(dateFrom);
    const to = toMonthStart(dateTo);
    to.setUTCMonth(to.getUTCMonth() + 1); // end of last month
    to.setUTCDate(0);

    // Get all expenses that could overlap the projection window
    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId,
        OR: [
          // ONE_TIME within range
          { frequency: 'ONE_TIME', dateIncurred: { gte: from, lte: to } },
          // Recurring: active during range
          {
            frequency: { not: 'ONE_TIME' },
            dateStart: { lte: to },
            OR: [
              { dateEnd: null },
              { dateEnd: { gte: from } },
            ],
          },
        ],
      },
      include: {
        bearer: { select: { id: true, name: true } },
      },
    });

    // Build monthly buckets
    const months: string[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const byMonth: Record<string, { total: number; byType: Record<string, number>; byDelegation: Record<string, number>; bySite: Record<string, number> }> = {};
    for (const m of months) {
      byMonth[m] = { total: 0, byType: {}, byDelegation: {}, bySite: {} };
    }

    let grandTotal = 0;
    const totalByType: Record<string, number> = {};
    const totalByDelegation: Record<string, number> = {};
    const totalBySite: Record<string, number> = {};

    for (const exp of expenses) {
      const type = exp.type || 'OTHER';
      const delegationId = (exp as any).delegationId || 'none';
      const siteId = (exp as any).siteId || 'none';

      if (exp.frequency === 'ONE_TIME') {
        const d = new Date(exp.dateIncurred);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (byMonth[monthKey]) {
          const amt = Number(exp.totalAmount);
          byMonth[monthKey].total += amt;
          byMonth[monthKey].byType[type] = (byMonth[monthKey].byType[type] || 0) + amt;
          byMonth[monthKey].byDelegation[delegationId] = (byMonth[monthKey].byDelegation[delegationId] || 0) + amt;
          byMonth[monthKey].bySite[siteId] = (byMonth[monthKey].bySite[siteId] || 0) + amt;
          grandTotal += amt;
          totalByType[type] = (totalByType[type] || 0) + amt;
          totalByDelegation[delegationId] = (totalByDelegation[delegationId] || 0) + amt;
          totalBySite[siteId] = (totalBySite[siteId] || 0) + amt;
        }
      } else {
        // Recurring: expand into monthly tranches
        const effectiveStart = exp.dateStart && exp.dateStart > from ? exp.dateStart : from;
        const effectiveEnd = exp.dateEnd && exp.dateEnd < to ? exp.dateEnd : to;

        for (const monthKey of months) {
          const [y, m] = monthKey.split('-').map(Number);
          const monthStart = new Date(y, m - 1, 1);
          const monthEnd = new Date(y, m, 0);

          if (monthStart > effectiveEnd || monthEnd < effectiveStart) continue;

          let monthlyAmount = 0;
          switch (exp.frequency) {
            case 'MONTHLY':
              monthlyAmount = Number(exp.totalAmount);
              break;
            case 'QUARTERLY':
              monthlyAmount = Number(exp.totalAmount) / 3;
              break;
            case 'YEARLY':
              monthlyAmount = Number(exp.totalAmount) / 12;
              break;
          }

          byMonth[monthKey].total += monthlyAmount;
          byMonth[monthKey].byType[type] = (byMonth[monthKey].byType[type] || 0) + monthlyAmount;
          byMonth[monthKey].byDelegation[delegationId] = (byMonth[monthKey].byDelegation[delegationId] || 0) + monthlyAmount;
          byMonth[monthKey].bySite[siteId] = (byMonth[monthKey].bySite[siteId] || 0) + monthlyAmount;
          grandTotal += monthlyAmount;
          totalByType[type] = (totalByType[type] || 0) + monthlyAmount;
          totalByDelegation[delegationId] = (totalByDelegation[delegationId] || 0) + monthlyAmount;
          totalBySite[siteId] = (totalBySite[siteId] || 0) + monthlyAmount;
        }
      }
    }

    // Round all amounts
    const roundObj = (obj: Record<string, number>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Math.round(v * 100) / 100]));

    return {
      totals: {
        total: Math.round(grandTotal * 100) / 100,
        byType: roundObj(totalByType),
        byDelegation: roundObj(totalByDelegation),
        bySite: roundObj(totalBySite),
      },
      byMonth: months.map((m) => ({
        month: m,
        total: Math.round(byMonth[m].total * 100) / 100,
        byType: roundObj(byMonth[m].byType),
        byDelegation: roundObj(byMonth[m].byDelegation),
        bySite: roundObj(byMonth[m].bySite),
      })),
    };
  }

  // ========== VALIDATION HELPERS ==========

  private validateAllocations(allocations: AllocationDto[]) {
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage > 100) {
      throw new BadRequestException(`Total allocation percentage (${totalPercentage}%) exceeds 100%`);
    }
  }

  private async validateAllocationTargets(tenantId: string, allocations: AllocationDto[]) {
    for (const alloc of allocations) {
      const target = await this.prisma.billingEntity.findFirst({
        where: { id: alloc.targetId, tenantId },
      });
      if (!target) throw new NotFoundException(`Target billing entity ${alloc.targetId} not found`);
    }
  }

  private async validateVendorContact(tenantId: string, vendorId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: vendorId, tenantId },
      include: { type: true },
    });
    if (!contact) throw new NotFoundException(`Vendor contact "${vendorId}" not found`);
    if (contact.type.category !== 'PROVIDER') {
      throw new BadRequestException(`Contact "${contact.name}" is not a PROVIDER type`);
    }
  }

  // ============================================================================
  // ADR-011 — Inline expense generation from Asset / Task
  // ============================================================================

  /**
   * Generate an Expense from an Asset (purchase or monthly rental).
   * - kind=ACQUISITION → uses asset.acquisitionPrice (or AssetModel.acquisitionPrice)
   *   produces ONE_TIME / EQUIPMENT
   * - kind=MONTHLY → uses asset.monthlyPrice (or AssetModel.monthlyPrice)
   *   produces MONTHLY / LICENSE
   * Multiple expenses can be linked to the same asset (1:N via Expense.assetId).
   */
  async createFromAsset(
    tenantId: string,
    assetId: string,
    body: { kind: 'ACQUISITION' | 'MONTHLY'; bearerId: string; label?: string; type?: string; fallbackDelegationId?: string },
    createdBy: string,
  ) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      include: {
        site: { select: { id: true, name: true, delegationId: true } },
        assetModel: { select: { acquisitionPrice: true, monthlyPrice: true, currency: true } },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const amount =
      body.kind === 'ACQUISITION'
        ? Number((asset as any).acquisitionPrice ?? asset.assetModel?.acquisitionPrice ?? 0)
        : Number((asset as any).monthlyPrice ?? asset.assetModel?.monthlyPrice ?? 0);
    if (!amount || amount <= 0) {
      throw new BadRequestException(
        `No ${body.kind === 'ACQUISITION' ? 'acquisition' : 'monthly'} price set on asset or asset model`,
      );
    }

    // Target delegation: site.delegationId or caller's active delegation (R1)
    const delegationId = asset.site?.delegationId ?? body.fallbackDelegationId ?? null;
    if (!delegationId) {
      throw new BadRequestException(
        'No target delegation: asset has no site and no active delegation in the request',
      );
    }

    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: body.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    const defaultType = body.kind === 'ACQUISITION' ? 'EQUIPMENT' : 'LICENSE';
    const defaultLabel =
      body.kind === 'ACQUISITION'
        ? `Achat ${asset.name || asset.serialNumber || asset.type}`
        : `Location ${asset.name || asset.serialNumber || asset.type}`;

    return this.prisma.expense.create({
      data: {
        tenantId,
        label: body.label || defaultLabel,
        type: (body.type || defaultType) as any,
        totalAmount: amount,
        currency: (asset as any).currency || asset.assetModel?.currency || 'EUR',
        frequency: (body.kind === 'ACQUISITION' ? 'ONE_TIME' : 'MONTHLY') as any,
        dateIncurred: (asset as any).acquisitionDate || new Date(),
        dateStart: body.kind === 'MONTHLY' ? ((asset as any).acquisitionDate || new Date()) : null,
        bearerId: bearer.id,
        delegationId,
        siteId: asset.site?.id ?? null,
        assetId: asset.id,
        createdBy,
      } as any,
      include: EXPENSE_INCLUDE,
    });
  }

  /**
   * Generate an Expense from a completed Task (prestation prestataire).
   * 1:1 — refuses if task already has expenseId.
   * Uses task.actualCost first, falls back to task.estimatedCost if useEstimated=true.
   */
  async createFromTask(
    tenantId: string,
    taskId: string,
    body: { bearerId: string; label?: string; useEstimated?: boolean; fallbackDelegationId?: string },
    createdBy: string,
  ) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
      include: {
        site: { select: { id: true, name: true, delegationId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if ((task as any).expenseId) {
      throw new BadRequestException('An expense is already linked to this task');
    }

    const amountSrc = body.useEstimated
      ? task.estimatedCost ?? task.actualCost
      : task.actualCost ?? task.estimatedCost;
    const amount = amountSrc ? Number(amountSrc) : 0;
    if (!amount || amount <= 0) {
      throw new BadRequestException('Task has no actualCost nor estimatedCost set');
    }

    const delegationId = task.site?.delegationId ?? body.fallbackDelegationId ?? null;
    if (!delegationId) {
      throw new BadRequestException('No target delegation: task site missing and no active delegation');
    }

    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: body.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    const defaultLabel = `Prestation ${task.title}`;

    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        label: body.label || defaultLabel,
        type: 'SERVICE' as any,
        totalAmount: amount,
        currency: task.costCurrency || 'EUR',
        frequency: 'ONE_TIME' as any,
        dateIncurred: task.completedAt || new Date(),
        bearerId: bearer.id,
        delegationId,
        siteId: task.site?.id ?? null,
        createdBy,
      } as any,
      include: EXPENSE_INCLUDE,
    });

    await this.prisma.task.update({
      where: { id: taskId },
      data: { expenseId: expense.id },
    });

    return expense;
  }

  /**
   * Resync the totalAmount of an Expense from its source (Asset / Task /
   * ConnectivityLink). Frozen-by-default policy: this is the explicit
   * opt-in to update an Expense after the source price changed.
   * Returns the updated Expense + a `before/after` diff for the dialog.
   */
  async resyncExpense(
    tenantId: string,
    expenseId: string,
    source: { kind: 'asset' | 'task' | 'connectivity'; sourceId: string; assetExpenseKind?: 'ACQUISITION' | 'MONTHLY' },
  ) {
    const expense = await this.prisma.expense.findFirst({ where: { id: expenseId, tenantId } });
    if (!expense) throw new NotFoundException('Expense not found');

    let newAmount: number | null = null;
    if (source.kind === 'asset') {
      const asset = await this.prisma.asset.findFirst({
        where: { id: source.sourceId, tenantId },
        include: { assetModel: { select: { acquisitionPrice: true, monthlyPrice: true } } },
      });
      if (!asset) throw new NotFoundException('Asset not found');
      newAmount =
        source.assetExpenseKind === 'MONTHLY'
          ? Number((asset as any).monthlyPrice ?? asset.assetModel?.monthlyPrice ?? 0)
          : Number((asset as any).acquisitionPrice ?? asset.assetModel?.acquisitionPrice ?? 0);
    } else if (source.kind === 'task') {
      const task = await this.prisma.task.findFirst({ where: { id: source.sourceId, tenantId } });
      if (!task) throw new NotFoundException('Task not found');
      newAmount = Number(task.actualCost ?? task.estimatedCost ?? 0);
    } else if (source.kind === 'connectivity') {
      const link = await this.prisma.connectivityLink.findFirst({ where: { id: source.sourceId, tenantId } });
      if (!link) throw new NotFoundException('ConnectivityLink not found');
      newAmount = Number(link.monthlyPrice ?? 0);
    }

    if (!newAmount || newAmount <= 0) {
      throw new BadRequestException('Source has no usable price');
    }

    const before = Number(expense.totalAmount);
    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: { totalAmount: newAmount },
      include: EXPENSE_INCLUDE,
    });

    return { expense: updated, before, after: newAmount };
  }
}
