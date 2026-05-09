import { PrismaClient } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PermissionService } from '../../common/services/permission.service';

/**
 * S5b PR1 — Quantitative N→1 assertions for the SQL refactor of
 * `projection()` and `reportByMonth()`. These tests fail if a future
 * refactor regresses to the previous `findMany + JS expansion loop`
 * pattern, even if it remains functionally correct.
 *
 * Pattern aligned with `budgets.service.spec.ts` (S5 PR4 R2) — the
 * assertion is `toHaveBeenCalledTimes(1)`, not `<N`. The exact count
 * guarantees the perf gain promised by the refactor.
 *
 * Functional behaviour (recurrence amortization, dateEnd clipping,
 * multi-axis aggregation, rounding) is exercised separately on a real
 * Postgres in `backend/test/integration/expenses-projection.spec.ts`.
 */
describe('ExpensesService — query count (S5b PR1)', () => {
  let service: ExpensesService;
  let prisma: any;
  let budgets: jest.Mocked<BudgetsService>;
  let perm: jest.Mocked<PermissionService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      expense: {
        findMany: jest.fn(), // must NOT be called by the new SQL path
        count: jest.fn(),    // legacy cap was removed in S5b
      },
    };
    budgets = {} as unknown as jest.Mocked<BudgetsService>;
    perm = {} as unknown as jest.Mocked<PermissionService>;
    service = new ExpensesService(prisma as PrismaClient, budgets, perm);
  });

  // ──────────────────────────── projection() ────────────────────────────

  it('projection() uses EXACTLY 1 $queryRaw call (was N+1)', async () => {
    await service.projection('t1', '2026-01', '2026-12');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(prisma.expense.count).not.toHaveBeenCalled();
  });

  it('projection() still uses 1 $queryRaw on a 5-year window', async () => {
    // The SQL path is constant in queries regardless of window size.
    await service.projection('t1', '2022-01', '2026-12');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });

  // ────────────────────────── reportByMonth() ──────────────────────────

  it('reportByMonth() uses EXACTLY 1 $queryRaw call (was N+1)', async () => {
    await service.reportByMonth('t1', {
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(prisma.expense.count).not.toHaveBeenCalled(); // legacy cap removed
  });

  it('reportByMonth() short-circuits with 0 queries when scopeDelegationIds is empty', async () => {
    const result = await service.reportByMonth(
      't1',
      { dateFrom: '2026-01-01', dateTo: '2026-12-31' },
      [],
    );

    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });

  it('reportByMonth() applies all filters in a single SQL call', async () => {
    await service.reportByMonth(
      't1',
      {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        delegationId: 'd1',
        expenseType: 'LICENSE',
      },
      ['d1', 'd2', 'd3'],
    );

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.expense.findMany).not.toHaveBeenCalled();
  });
});
