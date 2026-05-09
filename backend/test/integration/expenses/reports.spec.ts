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
 * S5b PR2 — integration coverage for `reportByBearer()` + `reportByTarget()`
 * after the SQL refactor (findMany + reduce JS → single `$queryRaw`).
 *
 * Hits a real Postgres (CI matrix or local dev DB) with a per-test wipe +
 * seed isolation strategy. Asserts the aggregated arithmetic against
 * carefully-crafted scenarios :
 *   - reportByBearer : per-bearer SUM(totalAmount) + LEFT JOIN LATERAL on
 *     cost_allocations to compute totalRefactured ; netBorne post-fetch.
 *   - reportByTarget : per-target SUM(allocations.amount) ; only allocations
 *     whose parent expense matches the filters reach the result.
 *
 * Tenant-isolation smoke ensures the WHERE clause is correctly scoped.
 */
describe('ExpensesService.reportByBearer — integration (S5b PR2)', () => {
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

  it('returns [] when the tenant has no expenses', async () => {
    const out = await service.reportByBearer(seed.tenantId);
    expect(out).toEqual([]);
  });

  it('aggregates totalBorne across multiple expenses on a single bearer', async () => {
    await addExpense(prisma, seed, {
      label: 'A', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });
    await addExpense(prisma, seed, {
      label: 'B', totalAmount: 250,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });

    const out = await service.reportByBearer(seed.tenantId);
    expect(out).toHaveLength(1);
    expect(out[0].bearer.id).toBe(seed.bearerId);
    expect(out[0].totalBorne).toBe(350);
    expect(out[0].totalRefactured).toBe(0);
    expect(out[0].netBorne).toBe(350);
    expect(out[0].expenseCount).toBe(2);
  });

  it('computes totalRefactured via LEFT JOIN LATERAL on cost_allocations', async () => {
    // Seed 2 bearers + 1 expense fully allocated, 1 expense partially allocated.
    await prisma.billingEntity.create({
      data: {
        id: 's5b-target-1', tenantId: seed.tenantId, delegationId: seed.delegationId,
        name: 'Target 1', code: 'TG-1', type: 'BU',
      },
    });

    const expA = await addExpense(prisma, seed, {
      label: 'Fully allocated', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });
    await prisma.costAllocation.create({
      data: { expenseId: expA.id, targetId: 's5b-target-1', percentage: 100, amount: 100 },
    });

    const expB = await addExpense(prisma, seed, {
      label: 'Partially allocated', totalAmount: 200,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });
    await prisma.costAllocation.create({
      data: { expenseId: expB.id, targetId: 's5b-target-1', percentage: 25, amount: 50 },
    });

    const out = await service.reportByBearer(seed.tenantId);
    expect(out).toHaveLength(1);
    expect(out[0].totalBorne).toBe(300);          // 100 + 200
    expect(out[0].totalRefactured).toBe(150);     // 100 (full) + 50 (partial)
    expect(out[0].netBorne).toBe(150);            // 300 − 150
    expect(out[0].expenseCount).toBe(2);
  });

  it('groups by bearer and sorts desc by totalBorne', async () => {
    // Second bearer + delegation.
    await prisma.delegation.create({
      data: {
        id: 's5b-deleg-2', tenantId: seed.tenantId, code: 'DEL-2', name: 'Délégation 2',
      },
    });
    await prisma.billingEntity.create({
      data: {
        id: 's5b-bearer-2', tenantId: seed.tenantId, delegationId: 's5b-deleg-2',
        name: 'Bearer 2', code: 'BEAR-2', type: 'DELEGATION',
      },
    });

    await addExpense(prisma, seed, {
      label: 'Big bearer 1', totalAmount: 500,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });
    await addExpense(prisma, seed, {
      label: 'Small bearer 2', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
      delegationId: 's5b-deleg-2', bearerId: 's5b-bearer-2',
    });

    const out = await service.reportByBearer(seed.tenantId);
    expect(out).toHaveLength(2);
    expect(out[0].bearer.id).toBe(seed.bearerId);   // 500 first
    expect(out[1].bearer.id).toBe('s5b-bearer-2');  // 100 second
  });

  it('honors dateFrom/dateTo filter', async () => {
    await addExpense(prisma, seed, {
      label: 'In window', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });
    await addExpense(prisma, seed, {
      label: 'Out of window', totalAmount: 9999,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2024-01-01'),
    });

    const out = await service.reportByBearer(seed.tenantId, {
      dateFrom: '2026-01-01', dateTo: '2026-12-31',
    });
    expect(out).toHaveLength(1);
    expect(out[0].totalBorne).toBe(100);
  });

  it('returns numeric (not string) totals — type smoke for $queryRaw casting', async () => {
    await addExpense(prisma, seed, {
      label: 'Type smoke', totalAmount: 75.25,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });

    const out = await service.reportByBearer(seed.tenantId);
    expect(typeof out[0].totalBorne).toBe('number');
    expect(typeof out[0].totalRefactured).toBe('number');
    expect(typeof out[0].netBorne).toBe('number');
    expect(typeof out[0].expenseCount).toBe('number');
  });
});

describe('ExpensesService.reportByTarget — integration (S5b PR2)', () => {
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

  it('returns [] when no allocations exist', async () => {
    await addExpense(prisma, seed, {
      label: 'No alloc', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });
    const out = await service.reportByTarget(seed.tenantId);
    expect(out).toEqual([]);
  });

  it('aggregates totalImputed per target across multiple allocations', async () => {
    await prisma.billingEntity.create({
      data: {
        id: 's5b-target-A', tenantId: seed.tenantId, delegationId: seed.delegationId,
        name: 'Target A', code: 'TG-A', type: 'BU',
      },
    });
    await prisma.billingEntity.create({
      data: {
        id: 's5b-target-B', tenantId: seed.tenantId, delegationId: seed.delegationId,
        name: 'Target B', code: 'TG-B', type: 'BU',
      },
    });

    const exp1 = await addExpense(prisma, seed, {
      label: 'Multi-allocated 1', totalAmount: 200,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-01-15'),
    });
    await prisma.costAllocation.createMany({
      data: [
        { expenseId: exp1.id, targetId: 's5b-target-A', percentage: 75, amount: 150 },
        { expenseId: exp1.id, targetId: 's5b-target-B', percentage: 25, amount: 50 },
      ],
    });

    const exp2 = await addExpense(prisma, seed, {
      label: 'Multi-allocated 2', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });
    await prisma.costAllocation.create({
      data: { expenseId: exp2.id, targetId: 's5b-target-A', percentage: 100, amount: 100 },
    });

    const out = await service.reportByTarget(seed.tenantId);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      target: { id: 's5b-target-A', name: 'Target A', code: 'TG-A', type: 'BU' },
      totalImputed: 250,
      allocationCount: 2,
    });
    expect(out[1]).toEqual({
      target: { id: 's5b-target-B', name: 'Target B', code: 'TG-B', type: 'BU' },
      totalImputed: 50,
      allocationCount: 1,
    });
  });

  it('honors dateFrom/dateTo on the parent expense (not the allocation)', async () => {
    await prisma.billingEntity.create({
      data: {
        id: 's5b-target-X', tenantId: seed.tenantId, delegationId: seed.delegationId,
        name: 'Target X', code: 'TG-X', type: 'BU',
      },
    });

    const inWindow = await addExpense(prisma, seed, {
      label: 'In window', totalAmount: 100,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2026-02-15'),
    });
    await prisma.costAllocation.create({
      data: { expenseId: inWindow.id, targetId: 's5b-target-X', percentage: 100, amount: 100 },
    });

    const outOfWindow = await addExpense(prisma, seed, {
      label: 'Out of window', totalAmount: 9999,
      frequency: ExpenseFrequency.ONE_TIME,
      dateIncurred: new Date('2024-01-01'),
    });
    await prisma.costAllocation.create({
      data: { expenseId: outOfWindow.id, targetId: 's5b-target-X', percentage: 100, amount: 9999 },
    });

    const out = await service.reportByTarget(seed.tenantId, {
      dateFrom: '2026-01-01', dateTo: '2026-12-31',
    });
    expect(out).toHaveLength(1);
    expect(out[0].totalImputed).toBe(100);
    expect(out[0].allocationCount).toBe(1);
  });

  it('does not leak allocations from a foreign tenant', async () => {
    // Seed a 2nd tenant with its own bearer + target + allocation.
    await prisma.tenant.create({
      data: {
        id: 's5b-other-tenant', name: 'Other', subdomain: 's5b-other', status: 'ACTIVE',
      },
    });
    await prisma.delegation.create({
      data: { id: 's5b-other-deleg', tenantId: 's5b-other-tenant', code: 'OD', name: 'OD' },
    });
    await prisma.billingEntity.createMany({
      data: [
        { id: 's5b-other-bearer', tenantId: 's5b-other-tenant', delegationId: 's5b-other-deleg', name: 'OB', code: 'OB', type: 'DELEGATION' },
        { id: 's5b-other-target', tenantId: 's5b-other-tenant', delegationId: 's5b-other-deleg', name: 'OT', code: 'OT', type: 'BU' },
      ],
    });
    const otherExp = await prisma.expense.create({
      data: {
        tenantId: 's5b-other-tenant',
        label: 'Other tenant exp',
        totalAmount: 9999,
        frequency: ExpenseFrequency.ONE_TIME,
        type: ExpenseType.OTHER,
        dateIncurred: new Date('2026-01-15'),
        bearerId: 's5b-other-bearer',
        delegationId: 's5b-other-deleg',
        createdBy: 'system',
      },
    });
    await prisma.costAllocation.create({
      data: { expenseId: otherExp.id, targetId: 's5b-other-target', percentage: 100, amount: 9999 },
    });

    // Query our seed tenant — must return [].
    const out = await service.reportByTarget(seed.tenantId);
    expect(out).toEqual([]);

    // Cleanup
    await prisma.costAllocation.deleteMany({ where: { expense: { tenantId: 's5b-other-tenant' } } });
    await prisma.expense.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.billingEntity.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.delegation.deleteMany({ where: { tenantId: 's5b-other-tenant' } });
    await prisma.tenant.deleteMany({ where: { id: 's5b-other-tenant' } });
  });
});
