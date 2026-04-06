import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, AllocationDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateScope } from '../../common/utils/scope-validation.util';
import { resolveDescendantScopes } from '../../common/utils/scope-resolution.util';

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

    // Auto-populate scopeType/scopeId from deprecated siteId
    let { scopeType, scopeId } = dto;
    if (!scopeType && !scopeId && dto.siteId) {
      scopeType = 'SITE';
      scopeId = dto.siteId;
    }

    // Validate scope
    if (scopeType && scopeId) {
      await validateScope(this.prisma as any, tenantId, scopeType, scopeId);
    }

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
        scopeType: scopeType || null,
        scopeId: scopeId || null,
        vendorId: rest.vendorId || null,
        siteId: rest.siteId,
        assetId: rest.assetId,
        externalRef: rest.externalRef,
        vendor: rest.vendor,
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
        { vendor: { contains: filters.search, mode: 'insensitive' } },
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

    // Direct scope filter
    if (filters.scopeType) {
      where.scopeType = filters.scopeType;
      if (filters.scopeId) where.scopeId = filters.scopeId;
    }

    // Hierarchical scope filter: include expenses at this scope + all descendants + tenant-wide
    if (filters.forScopeType && filters.forScopeId) {
      const descendants = await resolveDescendantScopes(
        this.prisma as any,
        filters.forScopeType,
        filters.forScopeId,
      );
      const scopeConditions = [
        { scopeType: null }, // Tenant-wide
        ...descendants.map((d) => ({ scopeType: d.scopeType, scopeId: d.scopeId })),
      ];
      if (where.OR) {
        // Merge with existing search OR
        where.AND = [{ OR: where.OR }, { OR: scopeConditions }];
        delete where.OR;
      } else {
        where.OR = scopeConditions;
      }
    }

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

    // Validate scope if changing
    const scopeType = dto.scopeType !== undefined ? dto.scopeType : (expense as any).scopeType;
    const scopeId = dto.scopeId !== undefined ? dto.scopeId : (expense as any).scopeId;
    if (scopeType && scopeId) {
      await validateScope(this.prisma as any, tenantId, scopeType, scopeId);
    }

    // Validate vendorId if changing
    if (dto.vendorId) {
      await this.validateVendorContact(tenantId, dto.vendorId);
    }

    const { allocations, ...updateData } = dto;
    const data: any = { ...updateData };
    if (dto.dateIncurred) data.dateIncurred = new Date(dto.dateIncurred);
    if (dto.dateStart !== undefined) data.dateStart = dto.dateStart ? new Date(dto.dateStart) : null;
    if (dto.dateEnd !== undefined) data.dateEnd = dto.dateEnd ? new Date(dto.dateEnd) : null;
    // Handle explicit null for scope clearing
    if (dto.scopeType === null) {
      data.scopeType = null;
      data.scopeId = null;
    }
    if (dto.vendorId === null) {
      data.vendorId = null;
    }

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

  async reportByBearer(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; scopeType?: string; scopeId?: string }) {
    const where: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      where.dateIncurred = {};
      if (filters.dateFrom) where.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateIncurred.lte = new Date(filters.dateTo);
    }

    // Scope filter for reports
    if (filters?.scopeType && filters?.scopeId) {
      const descendants = await resolveDescendantScopes(this.prisma as any, filters.scopeType, filters.scopeId);
      where.OR = [
        { scopeType: null },
        ...descendants.map((d) => ({ scopeType: d.scopeType, scopeId: d.scopeId })),
      ];
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

  async reportByTarget(tenantId: string, filters?: { dateFrom?: string; dateTo?: string; scopeType?: string; scopeId?: string }) {
    const expenseWhere: any = { tenantId };
    if (filters?.dateFrom || filters?.dateTo) {
      expenseWhere.dateIncurred = {};
      if (filters.dateFrom) expenseWhere.dateIncurred.gte = new Date(filters.dateFrom);
      if (filters.dateTo) expenseWhere.dateIncurred.lte = new Date(filters.dateTo);
    }

    if (filters?.scopeType && filters?.scopeId) {
      const descendants = await resolveDescendantScopes(this.prisma as any, filters.scopeType, filters.scopeId);
      expenseWhere.OR = [
        { scopeType: null },
        ...descendants.map((d) => ({ scopeType: d.scopeType, scopeId: d.scopeId })),
      ];
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
            scopeType: true,
            scopeId: true,
            bearer: { select: { id: true, name: true, code: true } },
          } as any,
        },
      },
      orderBy: { expense: { dateIncurred: 'desc' } },
    });

    return allocations;
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
