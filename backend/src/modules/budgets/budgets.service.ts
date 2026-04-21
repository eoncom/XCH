import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBudgetDto, UpdateBudgetDto, FilterBudgetDto } from './dto/create-budget.dto';
import { buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { UserNotificationService } from '../notifications/user-notification.service';

const BUDGET_INCLUDE = {
  delegation: { select: { id: true, name: true, code: true } },
  site: { select: { id: true, name: true, code: true } },
  parent: { select: { id: true, label: true, amount: true } },
  _count: { select: { children: true } },
};

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private prisma: PrismaClient,
    private notifications: UserNotificationService,
  ) {}

  async create(tenantId: string, dto: CreateBudgetDto) {
    await this.validateHierarchy(tenantId, null, dto);

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
        parentId: dto.parentId || null,
        alertsEnabled: dto.alertsEnabled ?? true,
        alertThresholdPct: dto.alertThresholdPct ?? 80,
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
    const existing = await this.prisma.budget.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Budget not found');

    // Re-validate hierarchy on any field that can break it.
    if (
      dto.parentId !== undefined ||
      dto.amount !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined
    ) {
      await this.validateHierarchy(tenantId, id, {
        parentId: dto.parentId !== undefined ? dto.parentId : existing.parentId,
        amount: dto.amount ?? Number(existing.amount),
        startDate: dto.startDate ?? existing.startDate.toISOString(),
        endDate: dto.endDate ?? existing.endDate.toISOString(),
      });
    }

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.parentId !== undefined) data.parentId = dto.parentId || null;

    return this.prisma.budget.update({
      where: { id },
      data,
      include: BUDGET_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { children: true } } },
    });
    if (!budget) throw new NotFoundException('Budget not found');

    // onDelete: Restrict in schema — surface the reason clearly.
    if (budget._count.children > 0) {
      throw new BadRequestException(
        `Ce budget a ${budget._count.children} sous-budget(s). Supprimez ou détachez-les d'abord.`,
      );
    }

    await this.prisma.budget.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Compute budget status: how much has been spent vs budgeted.
   * Matches expenses by scope (delegation/site/type) within the budget time window.
   * Also returns the list of matching expenses so the UI can show them inline.
   */
  async getStatus(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: BUDGET_INCLUDE,
    });
    if (!budget) throw new NotFoundException('Budget not found');

    const expenseWhere = this.buildExpenseWhere(budget);

    const [oneTimeAgg, recurringExpenses, allExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { ...expenseWhere, frequency: 'ONE_TIME' },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.findMany({
        where: { ...expenseWhere, frequency: { not: 'ONE_TIME' } },
        select: {
          id: true,
          label: true,
          type: true,
          frequency: true,
          totalAmount: true,
          currency: true,
          dateIncurred: true,
          dateStart: true,
          dateEnd: true,
          bearer: { select: { id: true, name: true, code: true } },
          site: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: {
          id: true,
          label: true,
          type: true,
          frequency: true,
          totalAmount: true,
          currency: true,
          dateIncurred: true,
          dateStart: true,
          dateEnd: true,
          bearer: { select: { id: true, name: true, code: true } },
          site: { select: { id: true, name: true, code: true } },
        },
        orderBy: { dateIncurred: 'desc' },
      }),
    ]);

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
      thresholdReached: budget.alertsEnabled && progressPct >= budget.alertThresholdPct,
      expenses: allExpenses,
    };
  }

  /**
   * After an expense create/update/delete, re-check each budget that matches
   * the expense and emit a threshold-crossing UserNotification when relevant.
   * Fire-and-forget — caller doesn't wait on it.
   */
  async checkThresholdsForExpense(tenantId: string, expense: {
    delegationId?: string | null;
    siteId?: string | null;
    type?: string | null;
    dateIncurred: Date;
  }) {
    const candidateBudgets = await this.prisma.budget.findMany({
      where: {
        tenantId,
        alertsEnabled: true,
        startDate: { lte: expense.dateIncurred },
        endDate: { gte: expense.dateIncurred },
        OR: [
          { delegationId: null },
          { delegationId: expense.delegationId ?? undefined },
        ],
        AND: [
          { OR: [{ siteId: null }, { siteId: expense.siteId ?? undefined }] },
          { OR: [{ expenseType: null }, { expenseType: expense.type ?? undefined }] },
        ],
      },
      include: { delegation: true },
    });

    for (const b of candidateBudgets) {
      try {
        const status = await this.getStatus(tenantId, b.id);
        if (!status.thresholdReached) continue;

        await this.notifyThresholdCrossed(tenantId, b, status.progressPct, status.overBudget);
      } catch (err: any) {
        this.logger.warn(`Budget threshold check failed for ${b.id}: ${err?.message}`);
      }
    }
  }

  /**
   * Recipients = delegation MANAGE users + super-admins. A single notification
   * row per user per budget per day prevents spam when many expenses are
   * imported in bulk.
   */
  private async notifyThresholdCrossed(
    tenantId: string,
    budget: { id: string; label: string; delegationId: string | null },
    progressPct: number,
    overBudget: boolean,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { isSuperAdmin: true },
          budget.delegationId
            ? { userDelegations: { some: { delegationId: budget.delegationId, right: 'MANAGE' } } }
            : { userDelegations: { some: { right: 'MANAGE' } } },
        ],
      },
      select: { id: true },
    });

    const title = overBudget
      ? `⚠️ Budget dépassé : ${budget.label}`
      : `📊 Seuil atteint : ${budget.label} (${progressPct}%)`;
    const body = overBudget
      ? `Les dépenses cumulées dépassent l'enveloppe de ce budget.`
      : `Les dépenses ont atteint ${progressPct}% de l'enveloppe.`;
    const link = `/dashboard/costs/budgets?budget=${budget.id}`;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const r of recipients) {
      const alreadySent = await this.prisma.userNotification.findFirst({
        where: {
          tenantId,
          userId: r.id,
          type: 'BUDGET_THRESHOLD',
          link,
          createdAt: { gte: startOfToday },
        },
        select: { id: true },
      });
      if (alreadySent) continue;
      await this.notifications.create({
        tenantId,
        userId: r.id,
        type: 'BUDGET_THRESHOLD',
        title,
        body,
        link,
      });
    }
  }

  private buildExpenseWhere(budget: {
    delegationId: string | null;
    siteId: string | null;
    expenseType: string | null;
    startDate: Date;
    endDate: Date;
    tenantId: string;
  }) {
    const expenseWhere: any = {
      tenantId: budget.tenantId,
      dateIncurred: { gte: budget.startDate, lte: budget.endDate },
    };
    if (budget.delegationId) expenseWhere.delegationId = budget.delegationId;
    if (budget.siteId) expenseWhere.siteId = budget.siteId;
    if (budget.expenseType) expenseWhere.type = budget.expenseType;
    return expenseWhere;
  }

  /**
   * Sub-budget validation:
   * - No self-parent, no cycle.
   * - Child period must wrap inside parent's period.
   * - Σ(children.amount) ≤ parent.amount — the parent is the capped envelope.
   */
  private async validateHierarchy(
    tenantId: string,
    selfId: string | null,
    dto: { parentId?: string | null; amount: number; startDate: string; endDate: string },
  ) {
    const parentId = dto.parentId;
    if (!parentId) return;
    if (selfId && parentId === selfId) {
      throw new BadRequestException('Un budget ne peut pas être son propre parent.');
    }

    const parent = await this.prisma.budget.findFirst({
      where: { id: parentId, tenantId },
    });
    if (!parent) throw new BadRequestException('Parent budget introuvable.');

    // Cycle check (depth max 6 — deeper is almost certainly a user mistake).
    let cursor = parent;
    for (let depth = 0; depth < 6; depth++) {
      if (selfId && cursor.parentId === selfId) {
        throw new BadRequestException('Cycle détecté dans la hiérarchie de budgets.');
      }
      if (!cursor.parentId) break;
      const next = await this.prisma.budget.findFirst({
        where: { id: cursor.parentId, tenantId },
      });
      if (!next) break;
      cursor = next;
    }

    // Child period must be within parent period.
    const childStart = new Date(dto.startDate);
    const childEnd = new Date(dto.endDate);
    if (childStart < parent.startDate || childEnd > parent.endDate) {
      throw new BadRequestException(
        'La période du sous-budget doit être comprise dans celle du budget parent.',
      );
    }

    // Σ(siblings + self) ≤ parent.amount
    const siblings = await this.prisma.budget.findMany({
      where: { tenantId, parentId, ...(selfId ? { id: { not: selfId } } : {}) },
      select: { amount: true },
    });
    const siblingsTotal = siblings.reduce((acc, s) => acc + Number(s.amount), 0);
    if (siblingsTotal + Number(dto.amount) > Number(parent.amount)) {
      const remaining = Number(parent.amount) - siblingsTotal;
      throw new BadRequestException(
        `Le budget parent n'a plus que ${remaining.toFixed(2)} ${parent.currency} disponibles.`,
      );
    }
  }

  private monthsBetween(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1;
    return Math.max(1, months);
  }
}
