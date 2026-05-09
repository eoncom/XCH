import { PrismaClient, ExpenseFrequency, ExpenseType } from '@prisma/client';
import { ExpensesService } from '../../../src/modules/expenses/expenses.service';
import { BudgetsService } from '../../../src/modules/budgets/budgets.service';
import { PermissionService } from '../../../src/common/services/permission.service';
import {
  addExpense,
  seedExpensesBaseline,
  wipeExpensesSeed,
  ExpensesSeedResult,
} from '../fixtures/expenses-seed';

/**
 * S5b PR1 — integration coverage for the SQL refactor of `projection()`
 * and `reportByMonth()`. Hits a real Postgres (CI matrix or local dev DB)
 * to exercise the GENERATE_SERIES + JOIN expansion that previously lived
 * in JavaScript.
 *
 * Each scenario seeds 0..N expenses on a dedicated tenant
 * (`s5b-expenses-tenant`), runs the service, asserts on the response.
 * Tests are isolated via per-test wipe + seed (no shared state).
 *
 * The 8 cases below mirror the original unit-spec scenarios that ran
 * pre-S5b with mocked findMany. The 4 boundary cases (B1-B4) cover
 * conditions the JS algorithm did not exercise but the SQL one should
 * handle correctly:
 *   B1 — MONTHLY whose dateEnd is anterior to the projection window
 *   B2 — YEARLY beginning mid-window (dateStart in month 6 of a 12-month window)
 *   B3 — ONE_TIME with dateIncurred exactly at the upper window boundary
 *   B4 — Window with no contributions returns the right shape (empty buckets)
 */
describe('ExpensesService.projection — integration (S5b PR1)', () => {
  let prisma: PrismaClient;
  let service: ExpensesService;
  let seed: ExpensesSeedResult;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    service = new ExpensesService(
      prisma,
      {} as BudgetsService,
      {} as PermissionService,
    );
  });

  afterAll(async () => {
    await wipeExpensesSeed(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    seed = await seedExpensesBaseline(prisma);
  });

  // ─────────────── 8 scenarios from the original unit spec ───────────────

  it('rejects malformed date inputs', async () => {
    await expect(service.projection(seed.tenantId, '', '2026-12')).rejects.toThrow();
    await expect(
      service.projection(seed.tenantId, '2026-01', 'not-a-date'),
    ).rejects.toThrow();
  });

  it('expands a MONTHLY expense over the projection window', async () => {
    await addExpense(prisma, seed, {
      label: 'Monthly license',
      totalAmount: 100,
      frequency: ExpenseFrequency.MONTHLY,
      type: ExpenseType.LICENSE,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-03');
    expect(result.byMonth).toHaveLength(3);
    expect(result.byMonth.map((m) => m.total)).toEqual([100, 100, 100]);
    expect(result.totals.total).toBe(300);
    expect(result.totals.byType.LICENSE).toBe(300);
    expect(result.totals.byDelegation[seed.delegationId]).toBe(300);
    expect(result.totals.bySite[seed.siteId]).toBe(300);
  });

  it('expands a QUARTERLY expense as totalAmount / 3 per month', async () => {
    await addExpense(prisma, seed, {
      label: 'Quarterly fee',
      totalAmount: 300,
      frequency: ExpenseFrequency.QUARTERLY,
      type: ExpenseType.OTHER,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
      siteId: null,
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-03');
    expect(result.byMonth.map((m) => m.total)).toEqual([100, 100, 100]);
    expect(result.totals.total).toBe(300);
    expect(result.totals.bySite.none).toBe(300);
  });

  it('expands a YEARLY expense as totalAmount / 12 per month', async () => {
    await addExpense(prisma, seed, {
      label: 'Yearly insurance',
      totalAmount: 1200,
      frequency: ExpenseFrequency.YEARLY,
      type: ExpenseType.OTHER,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
      siteId: null,
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-12');
    expect(result.byMonth).toHaveLength(12);
    expect(result.byMonth.every((m) => m.total === 100)).toBe(true);
    expect(result.totals.total).toBe(1200);
  });

  it('clips a recurring expense whose dateEnd falls inside the window', async () => {
    await addExpense(prisma, seed, {
      label: 'Monthly with end',
      totalAmount: 100,
      frequency: ExpenseFrequency.MONTHLY,
      type: ExpenseType.LICENSE,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
      dateEnd: new Date('2026-02-15'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-04');
    const totals = result.byMonth.map((m) => m.total);
    expect(totals[0]).toBe(100);
    expect(totals[1]).toBe(100);
    expect(totals[2]).toBe(0);
    expect(totals[3]).toBe(0);
    expect(result.totals.total).toBe(200);
  });

  it('places a ONE_TIME expense in the right month bucket and ignores others', async () => {
    await addExpense(prisma, seed, {
      label: 'Equipment one-time',
      totalAmount: 999,
      frequency: ExpenseFrequency.ONE_TIME,
      type: ExpenseType.EQUIPMENT,
      dateIncurred: new Date('2026-02-15'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-03');
    expect(result.byMonth[0].total).toBe(0);
    expect(result.byMonth[1].total).toBe(999);
    expect(result.byMonth[2].total).toBe(0);
    expect(result.totals.byType.EQUIPMENT).toBe(999);
  });

  it('aggregates multiple expenses across types/delegations/sites', async () => {
    // To exercise multi-delegation aggregation, pre-create a second
    // delegation + bearer + site in the same tenant.
    await prisma.delegation.create({
      data: {
        id: 's5b-deleg-2',
        tenantId: seed.tenantId,
        code: 'S5B-DEL2',
        name: 'Délégation S5b 2',
      },
    });
    await prisma.site.create({
      data: {
        id: 's5b-site-2',
        tenantId: seed.tenantId,
        delegationId: 's5b-deleg-2',
        name: 'Site S5b 2',
        code: 'S5B-SITE2',
        status: 'ACTIVE',
        healthStatus: 'UNKNOWN',
      },
    });
    await prisma.billingEntity.create({
      data: {
        id: 's5b-bearer-2',
        tenantId: seed.tenantId,
        delegationId: 's5b-deleg-2',
        name: 'Bearer S5b 2',
        code: 'S5B-BEAR2',
        type: 'DELEGATION',
      },
    });

    await addExpense(prisma, seed, {
      label: 'License d1',
      totalAmount: 100,
      frequency: ExpenseFrequency.MONTHLY,
      type: ExpenseType.LICENSE,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
    });
    await addExpense(prisma, seed, {
      label: 'Insurance d2',
      totalAmount: 1200,
      frequency: ExpenseFrequency.YEARLY,
      type: ExpenseType.OTHER,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
      delegationId: 's5b-deleg-2',
      siteId: 's5b-site-2',
      bearerId: 's5b-bearer-2',
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-02');
    expect(result.totals.total).toBe(400);
    expect(result.totals.byType.LICENSE).toBe(200);
    expect(result.totals.byType.OTHER).toBe(200);
    expect(result.totals.byDelegation[seed.delegationId]).toBe(200);
    expect(result.totals.byDelegation['s5b-deleg-2']).toBe(200);
    expect(result.totals.bySite[seed.siteId]).toBe(200);
    expect(result.totals.bySite['s5b-site-2']).toBe(200);
  });

  it('rounds amounts to 2 decimals (YEARLY → 100/12 = 8.33)', async () => {
    await addExpense(prisma, seed, {
      label: 'Yearly small',
      totalAmount: 100,
      frequency: ExpenseFrequency.YEARLY,
      type: ExpenseType.OTHER,
      dateIncurred: new Date('2026-01-01'),
      dateStart: new Date('2026-01-01'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-01');
    expect(result.byMonth[0].total).toBe(8.33);
    expect(result.totals.total).toBe(8.33);
  });

  // ──────────────────────── boundary cases (B1-B4) ────────────────────────

  it('B1 — MONTHLY whose dateEnd is anterior to the projection window contributes nothing', async () => {
    await addExpense(prisma, seed, {
      label: 'Old monthly',
      totalAmount: 100,
      frequency: ExpenseFrequency.MONTHLY,
      dateIncurred: new Date('2025-01-01'),
      dateStart: new Date('2025-01-01'),
      dateEnd: new Date('2025-12-31'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-12');
    expect(result.byMonth).toHaveLength(12);
    expect(result.totals.total).toBe(0);
    expect(result.byMonth.every((m) => m.total === 0)).toBe(true);
  });

  it('B2 — YEARLY beginning mid-window contributes only to active months', async () => {
    await addExpense(prisma, seed, {
      label: 'Yearly mid-start',
      totalAmount: 1200,
      frequency: ExpenseFrequency.YEARLY,
      dateIncurred: new Date('2026-06-01'),
      dateStart: new Date('2026-06-01'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-12');
    expect(result.byMonth).toHaveLength(12);
    // Months 1-5 inactive, 6-12 each receive 100.
    expect(result.byMonth[0].total).toBe(0);
    expect(result.byMonth[4].total).toBe(0);
    expect(result.byMonth[5].total).toBe(100);
    expect(result.byMonth[11].total).toBe(100);
    expect(result.totals.total).toBe(700);
  });

  it('B3 — ONE_TIME with dateIncurred at the upper boundary is included', async () => {
    await addExpense(prisma, seed, {
      label: 'Last-day one-time',
      totalAmount: 50,
      frequency: ExpenseFrequency.ONE_TIME,
      type: ExpenseType.SERVICE,
      dateIncurred: new Date('2026-03-31T00:00:00Z'),
    });

    const result = await service.projection(seed.tenantId, '2026-01', '2026-03');
    expect(result.byMonth[0].total).toBe(0);
    expect(result.byMonth[1].total).toBe(0);
    expect(result.byMonth[2].total).toBe(50);
    expect(result.totals.byType.SERVICE).toBe(50);
  });

  it('B4 — empty window produces full month list with zero buckets', async () => {
    // No expenses seeded.
    const result = await service.projection(seed.tenantId, '2026-01', '2026-04');
    expect(result.byMonth).toHaveLength(4);
    expect(result.byMonth.map((m) => m.month)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04',
    ]);
    expect(result.totals).toEqual({ total: 0, byType: {}, byDelegation: {}, bySite: {} });
  });
});

describe('ExpensesService.reportByMonth — integration (S5b PR1)', () => {
  let prisma: PrismaClient;
  let service: ExpensesService;
  let seed: ExpensesSeedResult;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    service = new ExpensesService(
      prisma,
      {} as BudgetsService,
      {} as PermissionService,
    );
  });

  afterAll(async () => {
    await wipeExpensesSeed(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    seed = await seedExpensesBaseline(prisma);
  });

  it('returns only months with positive contributions (compact array, HAVING SUM > 0)', async () => {
    // 1 ONE_TIME in Feb only — Jan and Mar must be absent from the result.
    await addExpense(prisma, seed, {
      label: 'Feb one-time',
      totalAmount: 200,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });

    const rows = await service.reportByMonth(seed.tenantId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ month: '2026-02', total: 200, count: 1 });
  });

  it('expands a MONTHLY expense into compact rows ordered ascending', async () => {
    await addExpense(prisma, seed, {
      label: 'License monthly',
      totalAmount: 100,
      frequency: ExpenseFrequency.MONTHLY,
      dateIncurred: new Date('2026-01-15'),
      dateStart: new Date('2026-01-01'),
    });

    const rows = await service.reportByMonth(seed.tenantId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(rows.every((r) => r.total === 100)).toBe(true);
  });

  it('honors expenseType filter', async () => {
    await addExpense(prisma, seed, {
      label: 'License',
      totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      type: ExpenseType.LICENSE,
      dateIncurred: new Date('2026-01-15'),
    });
    await addExpense(prisma, seed, {
      label: 'Service',
      totalAmount: 50,
      frequency: ExpenseFrequency.ONE_TIME,
      type: ExpenseType.SERVICE,
      dateIncurred: new Date('2026-01-20'),
    });

    const rows = await service.reportByMonth(seed.tenantId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      expenseType: 'LICENSE',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ month: '2026-01', total: 100, count: 1 });
  });

  it('does not leak across tenants', async () => {
    // Seed a second tenant with a competing expense on the same date.
    await prisma.tenant.create({
      data: {
        id: 's5b-other-tenant',
        name: 'Other Tenant',
        subdomain: 's5b-other',
        status: 'ACTIVE',
      },
    });
    await prisma.delegation.create({
      data: {
        id: 's5b-other-deleg',
        tenantId: 's5b-other-tenant',
        code: 'OTH-DEL',
        name: 'Other delegation',
      },
    });
    await prisma.billingEntity.create({
      data: {
        id: 's5b-other-bearer',
        tenantId: 's5b-other-tenant',
        delegationId: 's5b-other-deleg',
        name: 'Other bearer',
        code: 'OTH-BEAR',
        type: 'DELEGATION',
      },
    });
    await prisma.expense.create({
      data: {
        tenantId: 's5b-other-tenant',
        label: 'Other expense',
        totalAmount: 9999,
        frequency: ExpenseFrequency.ONE_TIME,
        type: ExpenseType.OTHER,
        dateIncurred: new Date('2026-01-15'),
        bearerId: 's5b-other-bearer',
        delegationId: 's5b-other-deleg',
        createdBy: 'system',
      },
    });

    // Query our seed tenant — must return empty.
    const rows = await service.reportByMonth(seed.tenantId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(rows).toEqual([]);

    // Cleanup the other tenant.
    await prisma.expense.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.billingEntity.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.delegation.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.tenant.deleteMany({ where: { id: 's5b-other-tenant' } });
  });

  it('returns rows whose `total` and `count` are typed as JS numbers', async () => {
    await addExpense(prisma, seed, {
      label: 'Type smoke',
      totalAmount: 75,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });

    const rows = await service.reportByMonth(seed.tenantId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(rows).toHaveLength(1);
    expect(typeof rows[0].total).toBe('number');
    expect(typeof rows[0].count).toBe('number');
  });
});
