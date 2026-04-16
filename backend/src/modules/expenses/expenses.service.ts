import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, AllocationDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';

const EXPENSE_INCLUDE: any = {
  bearer: { select: { id: true, name: true, code: true, type: true } },
  vendorContact: { select: { id: true, name: true, company: true, email: true, phone: true } },
  allocations: {
    include: { target: { select: { id: true, name: true, code: true, type: true } } },
  },
};

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaClient) {}

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

    return this.prisma.expense.create({
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
  }

  async findAll(tenantId: string, filters: FilterExpenseDto = {}) {
    const where: any = { tenantId };
    if (filters.type) where.type = filters.type;
    if (filters.bearerId) where.bearerId = filters.bearerId;
    if (filters.vendorId) where.vendorId = filters.vendorId;

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
    if (allocations !== undefined) {
      this.validateAllocations(allocations);
      await this.validateAllocationTargets(tenantId, allocations);

      const totalAmount = dto.totalAmount || expense.totalAmount;

      return this.prisma.$transaction(async (tx) => {
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
    }

    return this.prisma.expense.update({
      where: { id },
      data,
      include: EXPENSE_INCLUDE,
    });
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

  async reportByBearer(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; delegationId?: string }) {
    const where: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      where.dateIncurred = {};
      if (filters.dateFrom) where.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters?.delegationId) where.delegationId = filters.delegationId;

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

  async reportByTarget(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; delegationId?: string }) {
    const expenseWhere: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      expenseWhere.dateIncurred = {};
      if (filters.dateFrom) expenseWhere.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) expenseWhere.dateIncurred.lte = new Date(filters.dateTo);
    }
    if (filters?.delegationId) expenseWhere.delegationId = filters.delegationId;

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

  async reportChargeback(tenantId: string, filters?: { dateFrom?: string; dateTo?: string }) {
    const dateFilter: any = {};
    if (filters?.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) dateFilter.lte = new Date(filters.dateTo);

    const allocations = await this.prisma.costAllocation.findMany({
      where: {
        expense: {
          tenantId,
          ...(Object.keys(dateFilter).length ? { dateIncurred: dateFilter } : {}),
        },
      },
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
    const from = new Date(dateFrom + '-01');
    const to = new Date(dateTo + '-01');
    to.setMonth(to.getMonth() + 1); // end of last month
    to.setDate(0);

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
}
