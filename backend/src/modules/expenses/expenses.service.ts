import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateExpenseDto, UpdateExpenseDto, AllocationDto } from './dto/create-expense.dto';
import { FilterExpenseDto } from './dto/filter-expense.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
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
    private perm: PermissionService,
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
    bearerId?: string | null;
    allocationTargetIds?: string[];
    dateIncurred: Date;
  }) {
    // Intentionally not awaited — don't block the HTTP response on alerting.
    this.budgets
      .checkThresholdsForExpense(tenantId, expense)
      .catch((err) => this.logger.warn(`Budget threshold check failed: ${err?.message}`));
  }

  async create(
    tenantId: string,
    dto: CreateExpenseDto,
    createdBy: string,
    scopeDelegationIds: string[] | null = null,
  ) {
    // Validate bearer
    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: dto.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    // D4 — reconcile siteId with the linked asset (if any):
    // - Asset's site must match the expense site when both are set.
    // - When siteId is left empty and the asset has a site, auto-inherit it.
    const effectiveSiteId = await this.reconcileAssetSiteOrFail(
      tenantId,
      dto.assetId,
      dto.siteId,
    );
    // Use the reconciled value for the rest of the create flow.
    dto = { ...dto, siteId: effectiveSiteId ?? undefined };

    // Validate delegation/site coherence (R1) — delegationId is mandatory for expenses (R2)
    await validateDelegationSiteCoherence(this.prisma as any, dto.delegationId, dto.siteId);

    // Validate vendorId references a PROVIDER contact
    if (dto.vendorId) {
      await this.validateVendorContact(tenantId, dto.vendorId);
    }

    // Validate allocations (including D2 scope check on targets)
    if (dto.allocations?.length) {
      this.validateAllocations(dto.allocations);
      await this.validateAllocationTargets(tenantId, dto.allocations, scopeDelegationIds);
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
      bearerId: expense.bearerId,
      allocationTargetIds: (expense as any).allocations?.map((a: any) => a.targetId) ?? [],
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

  async findOne(tenantId: string, id: string, callerCtx?: CallerCtx) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        bearer: true,
        vendorContact: true,
        allocations: { include: { target: true } },
      } as any,
    });
    if (!expense) throw new NotFoundException('Expense not found');

    // ADR-021 — guess-by-id defense. Expense.delegationId=null = global readable
    // (cf. ADR-021 §6 catégorie A : Contact / Expense / TenantSecurityReminder).
    if (callerCtx) {
      await this.perm.assertCanReadDelegation(callerCtx, (expense as any).delegationId, {
        allowGlobal: true,
      });
    }

    return expense;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateExpenseDto,
    scopeDelegationIds: string[] | null = null,
    callerCtx?: CallerCtx,
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    // ADR-021 — write access on the CURRENT scope (before any move).
    // A global expense (delegationId=null) can only be edited by super admin.
    if (callerCtx) {
      await this.perm.assertCanWriteDelegation(callerCtx, (expense as any).delegationId);
    }

    if (dto.bearerId) {
      const bearer = await this.prisma.billingEntity.findFirst({
        where: { id: dto.bearerId, tenantId },
      });
      if (!bearer) throw new NotFoundException('Bearer billing entity not found');
    }

    // D4 — reconcile asset/site on update as well. Use dto values when
    // provided, fall back to existing values.
    const assetIdAfter = 'assetId' in dto ? dto.assetId : (expense as any).assetId;
    const siteIdBefore = 'siteId' in dto ? dto.siteId : (expense as any).siteId;
    const reconciledSiteId = await this.reconcileAssetSiteOrFail(
      tenantId,
      assetIdAfter,
      siteIdBefore,
    );
    if (reconciledSiteId !== siteIdBefore) {
      dto = { ...dto, siteId: reconciledSiteId ?? null };
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

    // If allocations provided, replace them (D2 scope check included)
    let updated: any;
    if (allocations !== undefined) {
      this.validateAllocations(allocations);
      await this.validateAllocationTargets(tenantId, allocations, scopeDelegationIds);

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
      bearerId: updated.bearerId,
      allocationTargetIds: (updated as any).allocations?.map((a: any) => a.targetId) ?? [],
      dateIncurred: updated.dateIncurred,
    });

    return updated;
  }

  async remove(tenantId: string, id: string, callerCtx?: CallerCtx) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    // ADR-021 — write access required to delete.
    if (callerCtx) {
      await this.perm.assertCanWriteDelegation(callerCtx, (expense as any).delegationId);
    }

    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted' };
  }

  // ========== REPORTS ==========

  /**
   * S5b PR2 — replaces a `findMany + reduce JS` group-by with a single
   * `$queryRaw` group-by SQL natif. `totalRefactured` is computed via
   * `LEFT JOIN LATERAL` on `cost_allocations` so each expense contributes
   * exactly its own allocation sum (avoiding the row-multiplication
   * problem of a direct JOIN on a 1-N relation). `netBorne` is computed
   * post-fetch (one subtraction per row, ~10 rows max). Wire shape
   * preserved : `{bearer:{id,name,code,type}, totalBorne, totalRefactured,
   * netBorne, expenseCount}[]` sorted desc by totalBorne.
   */
  async reportByBearer(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string; delegationId?: string },
    scopeDelegationIds: string[] | null = null,
  ): Promise<Array<{
    bearer: { id: string; name: string; code: string; type: string };
    totalBorne: number;
    totalRefactured: number;
    netBorne: number;
    expenseCount: number;
  }>> {
    if (scopeDelegationIds !== null && scopeDelegationIds.length === 0) return [];

    const conditions: Prisma.Sql[] = [Prisma.sql`e."tenantId" = ${tenantId}`];
    if (filters?.dateFrom) {
      conditions.push(Prisma.sql`e."dateIncurred" >= ${new Date(filters.dateFrom)}`);
    }
    if (filters?.dateTo) {
      conditions.push(Prisma.sql`e."dateIncurred" <= ${new Date(filters.dateTo)}`);
    }
    if (filters?.delegationId) {
      conditions.push(Prisma.sql`e."delegationId" = ${filters.delegationId}`);
    } else if (scopeDelegationIds !== null) {
      conditions.push(Prisma.sql`e."delegationId" IN (${Prisma.join(scopeDelegationIds)})`);
    }
    const whereClause = Prisma.join(conditions, ` AND `);

    type Row = {
      bearer_id: string;
      bearer_name: string;
      bearer_code: string;
      bearer_type: string;
      total_borne: number;
      total_refactured: number;
      expense_count: number;
    };
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        be.id           AS bearer_id,
        be.name         AS bearer_name,
        be.code         AS bearer_code,
        be."type"       AS bearer_type,
        COALESCE(SUM(e."totalAmount"), 0)::float8 AS total_borne,
        COALESCE(SUM(alloc.allocated), 0)::float8 AS total_refactured,
        COUNT(e.id)::int                          AS expense_count
      FROM expenses e
      JOIN billing_entities be ON be.id = e."bearerId"
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS allocated
        FROM cost_allocations ca
        WHERE ca."expenseId" = e.id
      ) alloc ON TRUE
      WHERE ${whereClause}
      GROUP BY be.id, be.name, be.code, be."type"
      ORDER BY total_borne DESC
    `);

    return rows.map((r) => ({
      bearer: {
        id: r.bearer_id,
        name: r.bearer_name,
        code: r.bearer_code,
        type: r.bearer_type,
      },
      totalBorne: Number(r.total_borne),
      totalRefactured: Number(r.total_refactured),
      netBorne: Number(r.total_borne) - Number(r.total_refactured),
      expenseCount: Number(r.expense_count),
    }));
  }

  /**
   * S5b PR2 — replaces a `findMany + reduce JS` group-by with a single
   * `$queryRaw` group-by SQL natif. Joins `cost_allocations → expenses`
   * for the tenant/date/scope filters (which apply to the parent
   * expense), groups by target, and returns the aggregated impute totals.
   * Wire shape preserved : `{target:{id,name,code,type}, totalImputed,
   * allocationCount}[]` sorted desc by totalImputed.
   */
  async reportByTarget(
    tenantId: string,
    filters?: { dateFrom?: string; dateTo?: string; delegationId?: string },
    scopeDelegationIds: string[] | null = null,
  ): Promise<Array<{
    target: { id: string; name: string; code: string; type: string };
    totalImputed: number;
    allocationCount: number;
  }>> {
    if (scopeDelegationIds !== null && scopeDelegationIds.length === 0) return [];

    const conditions: Prisma.Sql[] = [Prisma.sql`e."tenantId" = ${tenantId}`];
    if (filters?.dateFrom) {
      conditions.push(Prisma.sql`e."dateIncurred" >= ${new Date(filters.dateFrom)}`);
    }
    if (filters?.dateTo) {
      conditions.push(Prisma.sql`e."dateIncurred" <= ${new Date(filters.dateTo)}`);
    }
    if (filters?.delegationId) {
      conditions.push(Prisma.sql`e."delegationId" = ${filters.delegationId}`);
    } else if (scopeDelegationIds !== null) {
      conditions.push(Prisma.sql`e."delegationId" IN (${Prisma.join(scopeDelegationIds)})`);
    }
    const whereClause = Prisma.join(conditions, ` AND `);

    type Row = {
      target_id: string;
      target_name: string;
      target_code: string;
      target_type: string;
      total_imputed: number;
      allocation_count: number;
    };
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        bt.id             AS target_id,
        bt.name           AS target_name,
        bt.code           AS target_code,
        bt."type"         AS target_type,
        COALESCE(SUM(ca.amount), 0)::float8 AS total_imputed,
        COUNT(ca.id)::int                   AS allocation_count
      FROM cost_allocations ca
      JOIN expenses e        ON e.id = ca."expenseId"
      JOIN billing_entities bt ON bt.id = ca."targetId"
      WHERE ${whereClause}
      GROUP BY bt.id, bt.name, bt.code, bt."type"
      ORDER BY total_imputed DESC
    `);

    return rows.map((r) => ({
      target: {
        id: r.target_id,
        name: r.target_name,
        code: r.target_code,
        type: r.target_type,
      },
      totalImputed: Number(r.total_imputed),
      allocationCount: Number(r.allocation_count),
    }));
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
  ): Promise<Array<{ month: string; total: number; count: number }>> {
    // S5b — single SQL query (CTE GENERATE_SERIES + INNER JOIN). Replaces a
    // findMany + JS expansion loop. Buckets with total=0 are filtered via
    // HAVING to preserve the original wire-shape (compact array, only months
    // with at least one contribution). Recurring expenses (MONTHLY / QUARTERLY
    // / YEARLY) are amortized across each active month: total/1, total/3 and
    // total/12 respectively.
    if (!filters?.dateFrom || !filters?.dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required (YYYY-MM-DD)');
    }
    if (scopeDelegationIds !== null && scopeDelegationIds.length === 0) return [];

    const dateFrom = new Date(filters.dateFrom);
    const dateTo = new Date(filters.dateTo);
    if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
      throw new BadRequestException('Invalid dateFrom / dateTo (YYYY-MM-DD expected)');
    }

    // Compose WHERE fragments as Prisma.Sql (parameterized — no string interp).
    // Preserves the legacy filter `dateIncurred BETWEEN gte AND lte` for ALL
    // expenses (recurring included). The contribution clause inside the JOIN
    // separately constrains which (month, expense) pairs are emitted.
    const conditions: Prisma.Sql[] = [
      Prisma.sql`e."tenantId" = ${tenantId}`,
      Prisma.sql`e."dateIncurred" >= ${dateFrom}`,
      Prisma.sql`e."dateIncurred" <= ${dateTo}`,
    ];
    if (filters.delegationId) {
      conditions.push(Prisma.sql`e."delegationId" = ${filters.delegationId}`);
    }
    if (filters.expenseType) {
      conditions.push(Prisma.sql`e."type" = ${filters.expenseType}::"ExpenseType"`);
    }
    if (scopeDelegationIds !== null) {
      conditions.push(Prisma.sql`e."delegationId" IN (${Prisma.join(scopeDelegationIds)})`);
    }
    const whereClause = Prisma.join(conditions, ` AND `);

    const rows = await this.prisma.$queryRaw<
      Array<{ month: string; total: number; count: number }>
    >(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${dateFrom}::timestamp),
          date_trunc('month', ${dateTo}::timestamp),
          '1 month'::interval
        ) AS month_start
      ),
      contributions AS (
        SELECT
          m.month_start,
          CASE e."frequency"
            WHEN 'ONE_TIME'  THEN e."totalAmount"
            WHEN 'MONTHLY'   THEN e."totalAmount"
            WHEN 'QUARTERLY' THEN e."totalAmount" / 3.0
            WHEN 'YEARLY'    THEN e."totalAmount" / 12.0
            ELSE 0
          END AS amount,
          e.id AS expense_id
        FROM months m
        JOIN expenses e ON
          (e."frequency" = 'ONE_TIME'
            AND date_trunc('month', e."dateIncurred") = m.month_start)
          OR
          (e."frequency" <> 'ONE_TIME'
            AND m.month_start >= GREATEST(
                  date_trunc('month', COALESCE(e."dateStart", e."dateIncurred")),
                  date_trunc('month', ${dateFrom}::timestamp))
            AND m.month_start <= LEAST(
                  date_trunc('month', COALESCE(e."dateEnd", '9999-12-31'::timestamp)),
                  date_trunc('month', ${dateTo}::timestamp)))
        WHERE ${whereClause}
      )
      SELECT
        to_char(month_start, 'YYYY-MM') AS month,
        ROUND(SUM(amount)::numeric, 2)::float8 AS total,
        COUNT(expense_id)::int AS count
      FROM contributions
      GROUP BY month_start
      HAVING SUM(amount) > 0
      ORDER BY month_start
    `);

    return rows;
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
   * Returns totals and per-month breakdown, grouped by type/delegation/site.
   *
   * S5b — single SQL query (CTE GENERATE_SERIES + INNER JOIN + GROUP BY
   * (month, type, delegationId, siteId)). The post-fetch reshape (1 linear
   * pass) builds the multi-axis structure expected by the API. The full
   * window of months is always represented in `byMonth` (empty months have
   * total=0). Wire shape strictly preserved.
   */
  async projection(
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    // groupBy is accepted for forward-compat with the controller signature
    // but the response always carries every axis (byType / byDelegation /
    // bySite). The frontend selects the relevant axis.
    _groupBy?: 'type' | 'delegation' | 'site',
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

    type Row = {
      month: string;
      type: string | null;
      delegation_id: string | null;
      site_id: string | null;
      total: number;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', ${from}::timestamp),
          date_trunc('month', ${to}::timestamp),
          '1 month'::interval
        ) AS month_start
      ),
      contributions AS (
        SELECT
          m.month_start,
          COALESCE(e."type"::text, 'OTHER') AS type,
          COALESCE(e."delegationId", 'none') AS delegation_id,
          COALESCE(e."siteId", 'none') AS site_id,
          CASE e."frequency"
            WHEN 'ONE_TIME'  THEN e."totalAmount"
            WHEN 'MONTHLY'   THEN e."totalAmount"
            WHEN 'QUARTERLY' THEN e."totalAmount" / 3.0
            WHEN 'YEARLY'    THEN e."totalAmount" / 12.0
            ELSE 0
          END AS amount
        FROM months m
        JOIN expenses e ON
          (e."frequency" = 'ONE_TIME'
            AND date_trunc('month', e."dateIncurred") = m.month_start)
          OR
          (e."frequency" <> 'ONE_TIME'
            AND m.month_start >= GREATEST(
                  date_trunc('month', COALESCE(e."dateStart", e."dateIncurred")),
                  date_trunc('month', ${from}::timestamp))
            AND m.month_start <= LEAST(
                  date_trunc('month', COALESCE(e."dateEnd", '9999-12-31'::timestamp)),
                  date_trunc('month', ${to}::timestamp)))
        WHERE e."tenantId" = ${tenantId}
          -- Pre-filter on the expenses scan (mirrors the legacy findMany OR).
          -- Without this, Postgres reads every recurring expense regardless
          -- of its active window and filters them in the Nested Loop, which
          -- defeats indexes (tenantId, delegationId, dateIncurred) at scale.
          -- The condition is iso-functional with the legacy Prisma where:
          -- recurring expenses with NULL dateStart are excluded (NULL <= to
          -- is FALSE), matching pre-S5b behaviour exactly.
          AND (
            (e."frequency" = 'ONE_TIME'
              AND e."dateIncurred" >= ${from}::timestamp
              AND e."dateIncurred" <= ${to}::timestamp)
            OR
            (e."frequency" <> 'ONE_TIME'
              AND e."dateStart" <= ${to}::timestamp
              AND (e."dateEnd" IS NULL OR e."dateEnd" >= ${from}::timestamp))
          )
      )
      SELECT
        to_char(month_start, 'YYYY-MM') AS month,
        type,
        delegation_id,
        site_id,
        SUM(amount)::float8 AS total
      FROM contributions
      GROUP BY month_start, type, delegation_id, site_id
      ORDER BY month_start
    `);

    // Build the full set of months in the window (some may have no
    // contribution; they must still be present in the response).
    const months: string[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      months.push(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    type MonthBucket = {
      total: number;
      byType: Record<string, number>;
      byDelegation: Record<string, number>;
      bySite: Record<string, number>;
    };
    const byMonth: Record<string, MonthBucket> = {};
    for (const m of months) {
      byMonth[m] = { total: 0, byType: {}, byDelegation: {}, bySite: {} };
    }

    let grandTotal = 0;
    const totalByType: Record<string, number> = {};
    const totalByDelegation: Record<string, number> = {};
    const totalBySite: Record<string, number> = {};

    for (const row of rows) {
      const amt = Number(row.total);
      const type = row.type ?? 'OTHER';
      const delegationId = row.delegation_id ?? 'none';
      const siteId = row.site_id ?? 'none';
      const bucket = byMonth[row.month];
      if (!bucket) continue; // safety: SQL guarantees row.month ∈ months

      bucket.total += amt;
      bucket.byType[type] = (bucket.byType[type] || 0) + amt;
      bucket.byDelegation[delegationId] = (bucket.byDelegation[delegationId] || 0) + amt;
      bucket.bySite[siteId] = (bucket.bySite[siteId] || 0) + amt;

      grandTotal += amt;
      totalByType[type] = (totalByType[type] || 0) + amt;
      totalByDelegation[delegationId] = (totalByDelegation[delegationId] || 0) + amt;
      totalBySite[siteId] = (totalBySite[siteId] || 0) + amt;
    }

    const round2 = (v: number) => Math.round(v * 100) / 100;
    const roundObj = (obj: Record<string, number>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round2(v)]));

    return {
      totals: {
        total: round2(grandTotal),
        byType: roundObj(totalByType),
        byDelegation: roundObj(totalByDelegation),
        bySite: roundObj(totalBySite),
      },
      byMonth: months.map((m) => ({
        month: m,
        total: round2(byMonth[m].total),
        byType: roundObj(byMonth[m].byType),
        byDelegation: roundObj(byMonth[m].byDelegation),
        bySite: roundObj(byMonth[m].bySite),
      })),
    };
  }

  // ========== VALIDATION HELPERS ==========

  /**
   * D4 — When an expense is linked to an asset, its site must match the
   * asset's site. If the caller left siteId empty, we inherit the asset's
   * site to avoid the 2-step save pattern ("you forgot to pick the site").
   *
   * Returns the reconciled siteId (or null / undefined if no reconciliation
   * was needed). Throws BadRequest when both are set and conflict.
   */
  private async reconcileAssetSiteOrFail(
    tenantId: string,
    assetId: string | null | undefined,
    siteId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (!assetId) return siteId;
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      select: { id: true, siteId: true, name: true, serialNumber: true },
    });
    if (!asset) {
      throw new NotFoundException(`Équipement "${assetId}" introuvable.`);
    }
    // Asset has no site (stock / en transit) — keep whatever the caller gave.
    if (!asset.siteId) return siteId;
    // Caller left site empty → inherit asset's site.
    if (!siteId) return asset.siteId;
    // Both set → must match.
    if (siteId !== asset.siteId) {
      const assetLabel = asset.name || asset.serialNumber || asset.id;
      throw new BadRequestException(
        `Incohérence : l'équipement « ${assetLabel} » est rattaché à un autre site que celui de la dépense. Corrigez l'un des deux.`,
      );
    }
    return siteId;
  }

  private validateAllocations(allocations: AllocationDto[]) {
    const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
    if (totalPercentage > 100) {
      throw new BadRequestException(`Total allocation percentage (${totalPercentage}%) exceeds 100%`);
    }
  }

  /**
   * D2 — When `scopeDelegationIds` is not null (non super-admin), every
   * allocation target must be reachable by the user: either a BillingEntity
   * of one of their managed delegations, or a global one (delegationId=null).
   * Otherwise a manager could route refacturations toward CdCs they can't
   * even see in the UI.
   */
  private async validateAllocationTargets(
    tenantId: string,
    allocations: AllocationDto[],
    scopeDelegationIds: string[] | null = null,
  ) {
    for (const alloc of allocations) {
      const target = await this.prisma.billingEntity.findFirst({
        where: { id: alloc.targetId, tenantId },
        select: { id: true, name: true, delegationId: true },
      });
      if (!target) throw new NotFoundException(`Target billing entity ${alloc.targetId} not found`);
      if (scopeDelegationIds !== null && target.delegationId && !scopeDelegationIds.includes(target.delegationId)) {
        throw new BadRequestException(
          `Centre de coût « ${target.name} » hors périmètre : refacturation interdite vers une délégation que vous ne gérez pas.`,
        );
      }
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
