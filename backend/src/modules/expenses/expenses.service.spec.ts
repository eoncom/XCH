import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PermissionService } from '../../common/services/permission.service';

/**
 * S5b — `projection()` and `reportByMonth()` were refactored from a
 * `findMany` + JS expansion loop into a single SQL `$queryRaw` (CTE
 * `GENERATE_SERIES` + INNER JOIN). The recurrence-expansion algorithm
 * now lives entirely in Postgres, so the meaningful behavioural assertions
 * (MONTHLY/QUARTERLY/YEARLY amortization, dateEnd clipping, multi-axis
 * aggregation, rounding) moved to the integration spec
 * `backend/test/integration/expenses-projection.spec.ts` which hits a
 * real Postgres.
 *
 * This unit spec keeps the tests that can still be exercised cheaply:
 *   - input validation (date format)
 *   - the post-fetch reshape from SQL rows into the byMonth API shape
 *
 * The query-count assertions ($queryRaw called exactly once, findMany
 * never called) live in `expenses.service.querycount.spec.ts` to keep
 * the concerns separated.
 */
describe('ExpensesService.projection — input + reshape', () => {
  let service: ExpensesService;
  let prisma: jest.Mocked<PrismaClient>;
  let budgets: jest.Mocked<BudgetsService>;
  let perm: jest.Mocked<PermissionService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      expense: { findMany: jest.fn() },
    } as unknown as jest.Mocked<PrismaClient>;
    budgets = {} as unknown as jest.Mocked<BudgetsService>;
    perm = {} as unknown as jest.Mocked<PermissionService>;
    service = new ExpensesService(prisma, budgets, perm);
  });

  it('rejects malformed date inputs', async () => {
    await expect(service.projection('t1', '', '2026-12')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.projection('t1', '2026-01', 'not-a-date'),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns the full window in byMonth even if SQL returned no rows', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
    const result = await service.projection('t1', '2026-01', '2026-03');
    expect(result.byMonth).toHaveLength(3);
    expect(result.byMonth.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(result.byMonth.every((m) => m.total === 0)).toBe(true);
    expect(result.totals).toEqual({ total: 0, byType: {}, byDelegation: {}, bySite: {} });
  });

  it('reshapes flat SQL rows into the multi-axis byMonth structure', async () => {
    // SQL returns one row per (month, type, delegation_id, site_id) bucket.
    // The service must aggregate these into byMonth + totals.* axes.
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { month: '2026-01', type: 'LICENSE', delegation_id: 'd1', site_id: 's1', total: 100 },
      { month: '2026-02', type: 'LICENSE', delegation_id: 'd1', site_id: 's1', total: 100 },
      { month: '2026-02', type: 'INSURANCE', delegation_id: 'd2', site_id: 's2', total: 50 },
    ]);
    const result = await service.projection('t1', '2026-01', '2026-02');

    expect(result.byMonth).toHaveLength(2);
    expect(result.byMonth[0]).toEqual({
      month: '2026-01',
      total: 100,
      byType: { LICENSE: 100 },
      byDelegation: { d1: 100 },
      bySite: { s1: 100 },
    });
    expect(result.byMonth[1]).toEqual({
      month: '2026-02',
      total: 150,
      byType: { LICENSE: 100, INSURANCE: 50 },
      byDelegation: { d1: 100, d2: 50 },
      bySite: { s1: 100, s2: 50 },
    });
    expect(result.totals.total).toBe(250);
    expect(result.totals.byType).toEqual({ LICENSE: 200, INSURANCE: 50 });
    expect(result.totals.byDelegation).toEqual({ d1: 200, d2: 50 });
    expect(result.totals.bySite).toEqual({ s1: 200, s2: 50 });
  });

  it('rounds aggregated amounts to 2 decimals (post-fetch)', async () => {
    // Simulate a row whose SQL SUM (already at db side) is 8.333333…
    // The service must round it to 8.33.
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { month: '2026-01', type: 'OTHER', delegation_id: 'd1', site_id: 's1', total: 100 / 12 },
    ]);
    const result = await service.projection('t1', '2026-01', '2026-01');
    expect(result.byMonth[0].total).toBe(8.33);
    expect(result.totals.total).toBe(8.33);
  });

  it('coerces NULL type/delegation/site rows to OTHER/none', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { month: '2026-01', type: null, delegation_id: null, site_id: null, total: 42 },
    ]);
    const result = await service.projection('t1', '2026-01', '2026-01');
    expect(result.byMonth[0]).toEqual({
      month: '2026-01',
      total: 42,
      byType: { OTHER: 42 },
      byDelegation: { none: 42 },
      bySite: { none: 42 },
    });
  });
});

describe('ExpensesService.reportByMonth — input validation', () => {
  let service: ExpensesService;
  let prisma: jest.Mocked<PrismaClient>;
  let budgets: jest.Mocked<BudgetsService>;
  let perm: jest.Mocked<PermissionService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PrismaClient>;
    budgets = {} as unknown as jest.Mocked<BudgetsService>;
    perm = {} as unknown as jest.Mocked<PermissionService>;
    service = new ExpensesService(prisma, budgets, perm);
  });

  it('throws when dateFrom or dateTo is missing', async () => {
    await expect(service.reportByMonth('t1', { dateFrom: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.reportByMonth('t1', { dateTo: '2026-01-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.reportByMonth('t1', {})).rejects.toThrow(BadRequestException);
  });

  it('throws when dateFrom or dateTo is not a parseable date', async () => {
    await expect(
      service.reportByMonth('t1', { dateFrom: 'nope', dateTo: '2026-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns [] without hitting Postgres when scopeDelegationIds is empty', async () => {
    const result = await service.reportByMonth(
      't1',
      { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
      [],
    );
    expect(result).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
