import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { BudgetsService } from '../budgets/budgets.service';

/**
 * S4 — ExpensesService.projection() unit tests.
 *
 * Focus on the recurring-expense expansion algorithm:
 *   - ONE_TIME → assigned to its dateIncurred month if inside the window
 *   - MONTHLY → totalAmount per month
 *   - QUARTERLY → totalAmount / 3 per month
 *   - YEARLY → totalAmount / 12 per month
 *   - clipping of dateStart/dateEnd to the projection window
 *   - groupBy aggregation totals
 *   - input validation on YYYY-MM strings
 */
describe('ExpensesService.projection', () => {
  let service: ExpensesService;
  let prisma: jest.Mocked<PrismaClient>;
  let budgets: jest.Mocked<BudgetsService>;

  beforeEach(() => {
    prisma = {
      expense: { findMany: jest.fn() },
    } as unknown as jest.Mocked<PrismaClient>;
    budgets = {} as unknown as jest.Mocked<BudgetsService>;
    service = new ExpensesService(prisma, budgets);
  });

  it('rejects malformed date inputs', async () => {
    await expect(service.projection('t1', '', '2026-12')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.projection('t1', '2026-01', 'not-a-date'),
    ).rejects.toThrow(BadRequestException);
  });

  it('expands a MONTHLY expense over the projection window', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exp-1',
        type: 'LICENSE',
        totalAmount: 100,
        frequency: 'MONTHLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: 'd1',
        siteId: 's1',
      },
    ]);

    const result = await service.projection('t1', '2026-01', '2026-03');
    expect(result.byMonth).toHaveLength(3);
    expect(result.byMonth.map((m) => m.total)).toEqual([100, 100, 100]);
    expect(result.totals.total).toBe(300);
    expect(result.totals.byType.LICENSE).toBe(300);
    expect(result.totals.byDelegation.d1).toBe(300);
    expect(result.totals.bySite.s1).toBe(300);
  });

  it('expands a QUARTERLY expense as totalAmount / 3 per month', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exp-2',
        type: 'OTHER',
        totalAmount: 300,
        frequency: 'QUARTERLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: 'd1',
        siteId: null,
      },
    ]);

    const result = await service.projection('t1', '2026-01', '2026-03');
    expect(result.byMonth.map((m) => m.total)).toEqual([100, 100, 100]);
    expect(result.totals.total).toBe(300);
    expect(result.totals.bySite.none).toBe(300); // siteId null collapsed to "none"
  });

  it('expands a YEARLY expense as totalAmount / 12 per month', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exp-3',
        type: 'INSURANCE',
        totalAmount: 1200,
        frequency: 'YEARLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: null,
        siteId: null,
      },
    ]);

    const result = await service.projection('t1', '2026-01', '2026-12');
    expect(result.byMonth).toHaveLength(12);
    expect(result.byMonth.every((m) => m.total === 100)).toBe(true);
    expect(result.totals.total).toBe(1200);
  });

  it('clips a recurring expense whose dateEnd falls inside the window', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exp-4',
        type: 'LICENSE',
        totalAmount: 100,
        frequency: 'MONTHLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: new Date('2026-02-15'),
        delegationId: 'd1',
        siteId: 's1',
      },
    ]);

    // Window 2026-01..2026-04 — expense ends mid-Feb so months 1+2 only.
    const result = await service.projection('t1', '2026-01', '2026-04');
    const totals = result.byMonth.map((m) => m.total);
    expect(totals[0]).toBe(100);
    expect(totals[1]).toBe(100);
    expect(totals[2]).toBe(0);
    expect(totals[3]).toBe(0);
    expect(result.totals.total).toBe(200);
  });

  it('places a ONE_TIME expense in the right month bucket and ignores others', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exp-5',
        type: 'EQUIPMENT',
        totalAmount: 999,
        frequency: 'ONE_TIME',
        dateIncurred: new Date('2026-02-15'),
        dateStart: null,
        dateEnd: null,
        delegationId: 'd1',
        siteId: 's1',
      },
    ]);

    const result = await service.projection('t1', '2026-01', '2026-03');
    expect(result.byMonth[0].total).toBe(0);
    expect(result.byMonth[1].total).toBe(999);
    expect(result.byMonth[2].total).toBe(0);
    expect(result.totals.byType.EQUIPMENT).toBe(999);
  });

  it('aggregates multiple expenses across types/delegations/sites', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a',
        type: 'LICENSE',
        totalAmount: 100,
        frequency: 'MONTHLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: 'd1',
        siteId: 's1',
      },
      {
        id: 'b',
        type: 'INSURANCE',
        totalAmount: 1200,
        frequency: 'YEARLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: 'd2',
        siteId: 's2',
      },
    ]);

    const result = await service.projection('t1', '2026-01', '2026-02');
    // Window has 2 months; LICENSE = 200, INSURANCE = 200.
    expect(result.totals.total).toBe(400);
    expect(result.totals.byType.LICENSE).toBe(200);
    expect(result.totals.byType.INSURANCE).toBe(200);
    expect(result.totals.byDelegation.d1).toBe(200);
    expect(result.totals.byDelegation.d2).toBe(200);
    expect(result.totals.bySite.s1).toBe(200);
    expect(result.totals.bySite.s2).toBe(200);
  });

  it('rounds amounts to 2 decimals (YEARLY → 100/12 = 8.33)', async () => {
    (prisma.expense.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'r',
        type: 'OTHER',
        totalAmount: 100,
        frequency: 'YEARLY',
        dateIncurred: new Date('2026-01-01'),
        dateStart: new Date('2026-01-01'),
        dateEnd: null,
        delegationId: 'd1',
        siteId: 's1',
      },
    ]);
    const result = await service.projection('t1', '2026-01', '2026-01');
    expect(result.byMonth[0].total).toBe(8.33);
    expect(result.totals.total).toBe(8.33);
  });
});
