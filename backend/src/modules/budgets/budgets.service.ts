import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBudgetDto, UpdateBudgetDto, FilterBudgetDto } from './dto/create-budget.dto';
import { buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

const BUDGET_INCLUDE = {
  delegation: { select: { id: true, name: true, code: true } },
  site: { select: { id: true, name: true, code: true } },
};

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateBudgetDto) {
    return this.prisma.budget.create({
      data: {
        tenantId,
        label: dto.label,
        delegationId: dto.delegationId || null,
        siteId: dto.siteId || null,
        expenseType: dto.expenseType || null,
        period: dto.period,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        amount: dto.amount,
        currency: dto.currency || 'EUR',
        notes: dto.notes || null,
      },
      include: BUDGET_INCLUDE,
    });
  }

  async findAll(tenantId: string, filters: FilterBudgetDto = {}) {
    const where: any = { tenantId };
    if (filters.delegationId) where.delegationId = filters.delegationId;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.expenseType) where.expenseType = filters.expenseType;

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    const [data, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        include: BUDGET_INCLUDE,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.budget.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: BUDGET_INCLUDE,
    });
    if (!budget) throw new NotFoundException('Budget not found');
    return budget;
  }

  async update(tenantId: string, id: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    return this.prisma.budget.update({
      where: { id },
      data,
      include: BUDGET_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    await this.prisma.budget.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Compute budget status: how much has been spent vs budgeted.
   * Matches expenses by scope (delegation/site/type) within the budget time window.
   */
  async getStatus(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: BUDGET_INCLUDE,
    });
    if (!budget) throw new NotFoundException('Budget not found');

    // Build expense filter matching budget scope
    const expenseWhere: any = {
      tenantId,
      dateIncurred: {
        gte: budget.startDate,
        lte: budget.endDate,
      },
    };
    if (budget.delegationId) expenseWhere.delegationId = budget.delegationId;
    if (budget.siteId) expenseWhere.siteId = budget.siteId;
    if (budget.expenseType) expenseWhere.type = budget.expenseType;

    // Sum ONE_TIME expenses in range
    const oneTimeAgg = await this.prisma.expense.aggregate({
      where: { ...expenseWhere, frequency: 'ONE_TIME' },
      _sum: { totalAmount: true },
    });

    // Sum recurring expenses — approximate: for MONTHLY, count months in range
    const recurringExpenses = await this.prisma.expense.findMany({
      where: {
        ...expenseWhere,
        frequency: { not: 'ONE_TIME' },
      },
      select: { totalAmount: true, frequency: true, dateStart: true, dateEnd: true },
    });

    let recurringTotal = 0;
    const budgetStart = budget.startDate;
    const budgetEnd = budget.endDate;

    for (const exp of recurringExpenses) {
      const effectiveStart = exp.dateStart && exp.dateStart > budgetStart ? exp.dateStart : budgetStart;
      const effectiveEnd = exp.dateEnd && exp.dateEnd < budgetEnd ? exp.dateEnd : budgetEnd;

      if (effectiveStart > effectiveEnd) continue;

      const months = this.monthsBetween(effectiveStart, effectiveEnd);

      switch (exp.frequency) {
        case 'MONTHLY':
          recurringTotal += Number(exp.totalAmount) * months;
          break;
        case 'QUARTERLY':
          recurringTotal += Number(exp.totalAmount) * (months / 3);
          break;
        case 'YEARLY':
          recurringTotal += Number(exp.totalAmount) * (months / 12);
          break;
      }
    }

    const spent = Number(oneTimeAgg._sum.totalAmount || 0) + recurringTotal;
    const budgeted = Number(budget.amount);
    const remaining = budgeted - spent;
    const progressPct = budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0;

    return {
      budget,
      budgeted,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      progressPct,
      overBudget: spent > budgeted,
    };
  }

  private monthsBetween(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1; // inclusive
    return Math.max(1, months);
  }
}
