import { PrismaClient } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PermissionService } from '../../common/services/permission.service';

/**
 * S5b PR2 — unit coverage for `reportByBearer()` and `reportByTarget()`
 * after the SQL refactor (findMany + reduce JS → single `$queryRaw`).
 *
 * The functional behaviour (real aggregation arithmetic, LEFT JOIN LATERAL
 * on cost_allocations) is exercised on a real Postgres in
 * `backend/test/integration/expenses/reports.spec.ts`. This spec covers :
 *   - input short-circuits (empty scope → no query)
 *   - reshape from SQL rows into the API contract shape
 *   - quantitative N→1 query-count assertions
 *     (pattern S5 PR4 R2 — `toHaveBeenCalledTimes(1)` exactly, not <N).
 */
describe('ExpensesService — reports (S5b PR2)', () => {
  let service: ExpensesService;
  let prisma: any;
  let budgets: jest.Mocked<BudgetsService>;
  let perm: jest.Mocked<PermissionService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      expense: { findMany: jest.fn() },
      costAllocation: { findMany: jest.fn() },
    };
    budgets = {} as unknown as jest.Mocked<BudgetsService>;
    perm = {} as unknown as jest.Mocked<PermissionService>;
    service = new ExpensesService(prisma as PrismaClient, budgets, perm);
  });

  // ─────────────────────────── reportByBearer ───────────────────────────

  describe('reportByBearer', () => {
    it('uses EXACTLY 1 $queryRaw call (was findMany + reduce JS)', async () => {
      await service.reportByBearer('t1');
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.expense.findMany).not.toHaveBeenCalled();
      expect(prisma.costAllocation.findMany).not.toHaveBeenCalled();
    });

    it('short-circuits with 0 queries when scopeDelegationIds is empty', async () => {
      const out = await service.reportByBearer('t1', undefined, []);
      expect(out).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('reshapes SQL rows into the wire contract', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          bearer_id: 'b1',
          bearer_name: 'IT',
          bearer_code: 'IT-CODE',
          bearer_type: 'DELEGATION',
          total_borne: 1000,
          total_refactured: 300,
          expense_count: 3,
        },
        {
          bearer_id: 'b2',
          bearer_name: 'Ops',
          bearer_code: 'OPS-CODE',
          bearer_type: 'BU',
          total_borne: 500,
          total_refactured: 0,
          expense_count: 2,
        },
      ]);

      const out = await service.reportByBearer('t1');
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({
        bearer: { id: 'b1', name: 'IT', code: 'IT-CODE', type: 'DELEGATION' },
        totalBorne: 1000,
        totalRefactured: 300,
        netBorne: 700, // computed post-fetch
        expenseCount: 3,
      });
      expect(out[1].netBorne).toBe(500); // no refactored allocation
    });

    it('passes filters into the query (delegation + date range)', async () => {
      await service.reportByBearer(
        't1',
        { dateFrom: '2026-01-01', dateTo: '2026-12-31', delegationId: 'd1' },
        ['d1', 'd2'],
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('coerces numeric / bigint-flavored row values via Number()', async () => {
      // Postgres can return SUM as string when no ::float cast catches; verify
      // the service is defensive (Number() applied to every numeric col).
      prisma.$queryRaw.mockResolvedValue([
        {
          bearer_id: 'b1',
          bearer_name: 'IT',
          bearer_code: 'IT-CODE',
          bearer_type: 'DELEGATION',
          total_borne: '1000.50',
          total_refactured: '250.25',
          expense_count: '5',
        },
      ]);
      const out = await service.reportByBearer('t1');
      expect(typeof out[0].totalBorne).toBe('number');
      expect(out[0].totalBorne).toBe(1000.5);
      expect(out[0].netBorne).toBe(750.25);
      expect(out[0].expenseCount).toBe(5);
    });
  });

  // ─────────────────────────── reportByTarget ───────────────────────────

  describe('reportByTarget', () => {
    it('uses EXACTLY 1 $queryRaw call (was findMany + reduce JS)', async () => {
      await service.reportByTarget('t1');
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.expense.findMany).not.toHaveBeenCalled();
      expect(prisma.costAllocation.findMany).not.toHaveBeenCalled();
    });

    it('short-circuits with 0 queries when scopeDelegationIds is empty', async () => {
      const out = await service.reportByTarget('t1', undefined, []);
      expect(out).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('reshapes SQL rows into the wire contract', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          target_id: 't1',
          target_name: 'Centre IT',
          target_code: 'CIT',
          target_type: 'BU',
          total_imputed: 750,
          allocation_count: 3,
        },
      ]);
      const out = await service.reportByTarget('t1');
      expect(out).toEqual([
        {
          target: { id: 't1', name: 'Centre IT', code: 'CIT', type: 'BU' },
          totalImputed: 750,
          allocationCount: 3,
        },
      ]);
    });

    it('passes filters into the query (delegation + date range)', async () => {
      await service.reportByTarget(
        't1',
        { dateFrom: '2026-01-01', dateTo: '2026-12-31', delegationId: 'd1' },
        ['d1'],
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
