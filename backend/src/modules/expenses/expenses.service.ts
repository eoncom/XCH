import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, AllocationDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateExpenseDto, createdBy: string) {
    // Validate bearer
    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: dto.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    // Validate allocations
    if (dto.allocations?.length) {
      this.validateAllocations(dto.allocations);
      await this.validateAllocationTargets(tenantId, dto.allocations);
    }

    const { allocations, ...expenseData } = dto;

    return this.prisma.expense.create({
      data: {
        tenantId,
        ...expenseData,
        dateIncurred: new Date(dto.dateIncurred),
        dateStart: dto.dateStart ? new Date(dto.dateStart) : null,
        dateEnd: dto.dateEnd ? new Date(dto.dateEnd) : null,
        frequency: (dto.frequency || 'ONE_TIME') as any,
        type: dto.type as any,
        currency: dto.currency || 'EUR',
        createdBy,
        allocations: allocations?.length
          ? {
              create: allocations.map((a) => ({
                targetId: a.targetId,
                percentage: a.percentage,
                amount: (dto.totalAmount * a.percentage) / 100,
                notes: a.notes,
              })),
            }
          : undefined,
      },
      include: {
        bearer: true,
        allocations: { include: { target: true } },
      },
    });
  }

  async findAll(tenantId: string, filters: FilterExpenseDto = {}) {
    const where: any = { tenantId };
    if (filters.type) where.type = filters.type;
    if (filters.bearerId) where.bearerId = filters.bearerId;
    if (filters.search) {
      where.OR = [
        { label: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
        { externalRef: { contains: filters.search, mode: 'insensitive' } },
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

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const sortField = filters.sortBy || 'dateIncurred';
    const sortOrder = filters.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          bearer: { select: { id: true, name: true, code: true, type: true } },
          allocations: {
            include: { target: { select: { id: true, name: true, code: true, type: true } } },
          },
        },
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
        allocations: { include: { target: true } },
      },
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

    const { allocations, ...updateData } = dto;
    const data: any = { ...updateData };
    if (dto.dateIncurred) data.dateIncurred = new Date(dto.dateIncurred);
    if (dto.dateStart !== undefined) data.dateStart = dto.dateStart ? new Date(dto.dateStart) : null;
    if (dto.dateEnd !== undefined) data.dateEnd = dto.dateEnd ? new Date(dto.dateEnd) : null;

    // If allocations provided, replace them
    if (allocations !== undefined) {
      this.validateAllocations(allocations);
      await this.validateAllocationTargets(tenantId, allocations);

      const totalAmount = dto.totalAmount || expense.totalAmount;

      return this.prisma.$transaction(async (tx) => {
        // Delete existing allocations
        await tx.costAllocation.deleteMany({ where: { expenseId: id } });

        // Update expense + create new allocations
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
          include: {
            bearer: true,
            allocations: { include: { target: true } },
          },
        });
      });
    }

    return this.prisma.expense.update({
      where: { id },
      data,
      include: {
        bearer: true,
        allocations: { include: { target: true } },
      },
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

  /**
   * Report: total by bearer (who paid how much)
   */
  async reportByBearer(tenantId: string, filters?: { dateFrom?: string; dateTo?: string }) {
    const dateFilter: any = {};
    if (filters?.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters?.dateTo) dateFilter.lte = new Date(filters.dateTo);

    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId,
        ...(Object.keys(dateFilter).length ? { dateIncurred: dateFilter } : {}),
      },
      include: {
        bearer: { select: { id: true, name: true, code: true, type: true } },
        allocations: { select: { amount: true, targetId: true } },
      },
    });

    // Aggregate by bearer
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

    // Calculate net
    for (const entry of bearerMap.values()) {
      entry.netBorne = entry.totalBorne - entry.totalRefactured;
    }

    return Array.from(bearerMap.values()).sort((a, b) => b.totalBorne - a.totalBorne);
  }

  /**
   * Report: total by target (who owes how much)
   */
  async reportByTarget(tenantId: string, filters?: { dateFrom?: string; dateTo?: string }) {
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
        target: { select: { id: true, name: true, code: true, type: true } },
        expense: { select: { id: true, label: true, type: true, bearerId: true } },
      },
    });

    // Aggregate by target
    const targetMap = new Map<string, {
      target: { id: string; name: string; code: string; type: string };
      totalImputed: number;
      allocationCount: number;
    }>();

    for (const alloc of allocations) {
      const key = alloc.targetId;
      if (!targetMap.has(key)) {
        targetMap.set(key, {
          target: alloc.target,
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
   * Report: chargeback view — for each target, list of imputed expenses
   */
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
            bearer: { select: { id: true, name: true, code: true } },
          },
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
}
