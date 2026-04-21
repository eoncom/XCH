import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBudgetDto, UpdateBudgetDto, FilterBudgetDto } from './dto/create-budget.dto';
import { buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { UserNotificationService } from '../notifications/user-notification.service';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';

const BUDGET_INCLUDE = {
  delegation: { select: { id: true, name: true, code: true } },
  site: { select: { id: true, name: true, code: true } },
  billingEntity: { select: { id: true, name: true, code: true, delegationId: true } },
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
    await this.validateBillingEntity(tenantId, dto.billingEntityId, dto.delegationId);
    // Bug fix 2026-04-21: a budget scoped to a site must share the same
    // delegation (R1). Reuses the same helper as the expenses module so the
    // rule stays consistent across the whole cost domain.
    await validateDelegationSiteCoherence(this.prisma as any, dto.delegationId, dto.siteId);

    return this.prisma.budget.create({
      data: {
        tenantId,
        label: dto.label,
        delegationId: dto.delegationId || null,
        siteId: dto.siteId || null,
        expenseType: dto.expenseType || null,
        billingEntityId: dto.billingEntityId || null,
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

  async findAll(
    tenantId: string,
    filters: FilterBudgetDto = {},
    scopeDelegationIds: string[] | null = null,
  ) {
    const where: any = { tenantId };
    if (filters.delegationId) where.delegationId = filters.delegationId;
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.expenseType) where.expenseType = filters.expenseType;

    const page = Number(filters.page) || 1;
    const pageSize = Number(filters.pageSize) || 25;

    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) {
        return buildPaginatedResponse([], 0, page, pageSize);
      }
      // A budget with delegationId=null is global — visible if no scope filter.
      // Managers only see budgets strictly in their managed delegations.
      where.delegationId = { in: scopeDelegationIds };
    }

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

    // Re-validate the billingEntity if it changed, or if the delegation
    // changed (since a CdC must belong to the budget's delegation or be global).
    if (dto.billingEntityId !== undefined || dto.delegationId !== undefined) {
      await this.validateBillingEntity(
        tenantId,
        dto.billingEntityId !== undefined ? dto.billingEntityId : existing.billingEntityId,
        dto.delegationId !== undefined ? dto.delegationId : existing.delegationId,
      );
    }

    // Re-check site coherence if delegation or site changed.
    if (dto.delegationId !== undefined || dto.siteId !== undefined) {
      await validateDelegationSiteCoherence(
        this.prisma as any,
        dto.delegationId !== undefined ? dto.delegationId : existing.delegationId,
        dto.siteId !== undefined ? dto.siteId : existing.siteId,
      );
    }

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.parentId !== undefined) data.parentId = dto.parentId || null;
    if (dto.billingEntityId !== undefined) data.billingEntityId = dto.billingEntityId || null;

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
   *
   * The math differs depending on whether the budget is CdC-scoped:
   * - Non-CdC (delegation-level): sum of raw totalAmount across matching
   *   expenses. The delegation is the "ultimate buyer" — what it purchases,
   *   before any internal refacturation.
   * - CdC-scoped (billingEntityId=X): the REAL net money flowing through X.
   *     • When X is the bearer  → contribution = totalAmount × (1 - Σ outgoing allocation %)
   *     • When X is a target of an allocation → contribution = allocation.amount
   *   This is the accounting-correct figure the user expects for "Budget IT
   *   2026 = 40k": if IT pays 1000 € but refactures 300 € to BU Lyon, only
   *   700 € should count against the IT budget.
   */
  async getStatus(tenantId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, tenantId },
      include: BUDGET_INCLUDE,
    });
    if (!budget) throw new NotFoundException('Budget not found');

    const isCdcBudget = !!budget.billingEntityId;
    const spent = isCdcBudget
      ? await this.computeCdcSpent(tenantId, budget)
      : await this.computeDelegationSpent(tenantId, budget);

    const allExpenses = await this.listMatchingExpenses(tenantId, budget);

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
   * Non-CdC budget (delegation / site / type): legacy raw-total logic. The
   * refacturation math doesn't apply at the delegation level — a delegation
   * "bought" the thing regardless of who is later invoiced for it.
   */
  private async computeDelegationSpent(
    tenantId: string,
    budget: any,
  ): Promise<number> {
    const expenseWhere = this.buildExpenseWhere(budget);

    const [oneTimeAgg, recurringExpenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { ...expenseWhere, frequency: 'ONE_TIME' },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.findMany({
        where: { ...expenseWhere, frequency: { not: 'ONE_TIME' } },
        select: { totalAmount: true, frequency: true, dateStart: true, dateEnd: true },
      }),
    ]);

    let recurringTotal = 0;
    for (const exp of recurringExpenses) {
      const months = this.monthsForRecurring(exp, budget.startDate, budget.endDate);
      if (months === 0) continue;
      recurringTotal += Number(exp.totalAmount) * this.frequencyFactor(exp.frequency) * months;
    }
    return Number(oneTimeAgg._sum.totalAmount || 0) + recurringTotal;
  }

  /**
   * CdC budget — bearer net + incoming refacturation. Fetches every expense
   * where the CdC is either the bearer or a target of an allocation within
   * the budget window, then sums the real contribution.
   */
  private async computeCdcSpent(tenantId: string, budget: any): Promise<number> {
    const X = budget.billingEntityId as string;
    const where: any = {
      tenantId,
      dateIncurred: { gte: budget.startDate, lte: budget.endDate },
      OR: [
        { bearerId: X },
        { allocations: { some: { targetId: X } } },
      ],
    };
    // A CdC budget still honours optional delegation/site/type filters.
    if (budget.delegationId) where.delegationId = budget.delegationId;
    if (budget.siteId) where.siteId = budget.siteId;
    if (budget.expenseType) where.type = budget.expenseType;

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        frequency: true,
        dateStart: true,
        dateEnd: true,
        dateIncurred: true,
        bearerId: true,
        allocations: { select: { targetId: true, percentage: true, amount: true } },
      },
    });

    let total = 0;
    for (const exp of expenses) {
      const contribution = this.expenseContributionForCdc(exp, X);
      if (contribution === 0) continue;

      if (exp.frequency === 'ONE_TIME') {
        total += contribution;
      } else {
        const months = this.monthsForRecurring(exp, budget.startDate, budget.endDate);
        if (months === 0) continue;
        total += contribution * this.frequencyFactor(exp.frequency) * months;
      }
    }
    return total;
  }

  /**
   * Contribution of a single expense to a CdC X:
   * - If bearer=X: totalAmount * (1 - Σ outgoingPct/100)   [net after refact out]
   * - Plus:        Σ allocation.amount where target=X       [refact received]
   * The two branches are additive — in practice an expense is rarely both
   * (the service already blocks bearer=target in validateAllocationTargets).
   */
  private expenseContributionForCdc(
    exp: {
      totalAmount: any;
      bearerId: string;
      allocations: Array<{ targetId: string; percentage: number; amount: any }>;
    },
    X: string,
  ): number {
    let contribution = 0;
    if (exp.bearerId === X) {
      const totalOutPct = exp.allocations.reduce((s, a) => s + Number(a.percentage), 0);
      contribution += Number(exp.totalAmount) * Math.max(0, (100 - totalOutPct) / 100);
    }
    for (const a of exp.allocations) {
      if (a.targetId === X) contribution += Number(a.amount);
    }
    return contribution;
  }

  /**
   * Expenses list shown in the "Voir les dépenses" dialog. For a non-CdC
   * budget, uses the classic scope filter. For a CdC budget, returns every
   * expense that touches the CdC (as bearer or as allocation target).
   */
  private async listMatchingExpenses(tenantId: string, budget: any) {
    const select = {
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
    };
    if (budget.billingEntityId) {
      const X = budget.billingEntityId;
      const where: any = {
        tenantId,
        dateIncurred: { gte: budget.startDate, lte: budget.endDate },
        OR: [
          { bearerId: X },
          { allocations: { some: { targetId: X } } },
        ],
      };
      if (budget.delegationId) where.delegationId = budget.delegationId;
      if (budget.siteId) where.siteId = budget.siteId;
      if (budget.expenseType) where.type = budget.expenseType;
      return this.prisma.expense.findMany({
        where,
        select,
        orderBy: { dateIncurred: 'desc' },
      });
    }
    return this.prisma.expense.findMany({
      where: this.buildExpenseWhere(budget),
      select,
      orderBy: { dateIncurred: 'desc' },
    });
  }

  /** Shared helper: months a recurring expense overlaps with the budget window. */
  private monthsForRecurring(
    exp: { dateStart: Date | null; dateEnd: Date | null },
    budgetStart: Date,
    budgetEnd: Date,
  ): number {
    const effectiveStart =
      exp.dateStart && exp.dateStart > budgetStart ? exp.dateStart : budgetStart;
    const effectiveEnd =
      exp.dateEnd && exp.dateEnd < budgetEnd ? exp.dateEnd : budgetEnd;
    if (effectiveStart > effectiveEnd) return 0;
    return this.monthsBetween(effectiveStart, effectiveEnd);
  }

  /** Per-month fraction of the totalAmount for a given frequency. */
  private frequencyFactor(freq: string): number {
    if (freq === 'MONTHLY') return 1;
    if (freq === 'QUARTERLY') return 1 / 3;
    if (freq === 'YEARLY') return 1 / 12;
    return 0;
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
    bearerId?: string | null;
    allocationTargetIds?: string[];
    dateIncurred: Date;
  }) {
    // CdC budget candidates: the bearer's CdC budget AND any allocation
    // target's CdC budget (since their incoming refact counts too since D1
    // bugfix 2026-04-21).
    const affectedCdcIds = [
      ...(expense.bearerId ? [expense.bearerId] : []),
      ...(expense.allocationTargetIds ?? []),
    ];

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
          {
            OR: [
              { billingEntityId: null },
              ...(affectedCdcIds.length > 0
                ? [{ billingEntityId: { in: affectedCdcIds } }]
                : []),
            ],
          },
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
    billingEntityId: string | null;
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
    // Phase 6.7 (D1): a CdC-scoped budget only matches expenses where this
    // BillingEntity is the bearer (the raw invoiced owner — the refacturation
    // math doesn't change what goes against the budget envelope).
    if (budget.billingEntityId) expenseWhere.bearerId = budget.billingEntityId;
    return expenseWhere;
  }

  /**
   * Validate that a budget's billingEntity (CdC) is coherent with its scope.
   * Rules:
   * - The BillingEntity must exist in the same tenant.
   * - If the budget has a delegation, the BillingEntity must either be global
   *   (delegationId=null) or belong to the same delegation.
   *   → a "Budget CdC Direction IT" doesn't make sense if it's supposed to
   *   track IDF-Ouest expenses but the CdC actually belongs to Lyon.
   */
  private async validateBillingEntity(
    tenantId: string,
    billingEntityId: string | null | undefined,
    delegationId: string | null | undefined,
  ) {
    if (!billingEntityId) return;
    const cdc = await this.prisma.billingEntity.findFirst({
      where: { id: billingEntityId, tenantId },
      select: { id: true, delegationId: true, name: true, isActive: true },
    });
    if (!cdc) {
      throw new BadRequestException('Centre de coût introuvable.');
    }
    if (!cdc.isActive) {
      throw new BadRequestException(`Centre de coût « ${cdc.name} » désactivé.`);
    }
    if (delegationId && cdc.delegationId && cdc.delegationId !== delegationId) {
      throw new BadRequestException(
        `Le centre de coût « ${cdc.name} » n'appartient pas à cette délégation.`,
      );
    }
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
