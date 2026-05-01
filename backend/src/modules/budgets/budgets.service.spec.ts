import { PrismaClient } from '@prisma/client';
import { BudgetsService } from './budgets.service';

/**
 * S5 PR4 R2 — Budget threshold N+1 → 1 batch findMany.
 *
 * Avant : `for (b of candidateBudgets) { getStatus(b.id) }` faisait
 *   3-4 queries DB par budget candidat (findFirst budget + 1-2 findMany
 *   expenses + 1 listMatchingExpenses redondante). 50 candidats sur 1
 *   expense créée → 150-200 queries.
 *
 * Maintenant : 1 expense.findMany global qui couvre tous les candidats,
 *   filter+compute en mémoire par budget. Tests quantitatifs avec
 *   assertion EXACTE sur le nombre de queries (pas "< N", le chiffre
 *   exact garantit que le refactor délivre le gain perf attendu).
 */
describe('BudgetsService — checkThresholdsForExpense (S5 PR4 R2)', () => {
  let service: BudgetsService;
  let prisma: any;
  let notifications: any;
  let perm: any;

  beforeEach(() => {
    prisma = {
      budget: {
        findMany: jest.fn(),
        findFirst: jest.fn(), // doit ne PAS être appelé en mode batch
      },
      expense: {
        findMany: jest.fn(), // doit être appelé EXACTEMENT 1× (le batch)
        aggregate: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]), // notify path retourne 0 recipients
      },
      userNotification: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    notifications = {};
    perm = {};
    service = new BudgetsService(prisma as any, notifications as any, perm as any);
  });

  // ───────────────────────────────────────────────────────────────────
  // Quantitative N+1 assertions
  // ───────────────────────────────────────────────────────────────────

  it('uses EXACTLY 1 expense.findMany regardless of candidate count', async () => {
    // 50 candidats non-CdC sur la même délégation, fenêtre commune.
    const candidates = Array.from({ length: 50 }, (_, i) => ({
      id: `b${i}`,
      tenantId: 't1',
      delegationId: 'deleg-A',
      siteId: null,
      expenseType: null,
      billingEntityId: null,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 1000,
      currency: 'EUR',
      label: `Budget ${i}`,
      alertsEnabled: true,
      alertThresholdPct: 80,
    }));
    prisma.budget.findMany
      .mockResolvedValueOnce(candidates) // nonCdcCandidates
      .mockResolvedValueOnce([]); // cdcCandidates (affectedCdcIds=[] → never queried, mais on sécurise)

    // Aucun expense pertinent → aucun threshold atteint, pas de notify.
    prisma.expense.findMany.mockResolvedValue([]);

    await service.checkThresholdsForExpense('t1', {
      delegationId: 'deleg-A',
      siteId: null,
      type: 'SERVICE',
      bearerId: null,
      allocationTargetIds: [],
      dateIncurred: new Date('2026-06-15'),
    });

    // Assertions quantitatives EXACTES (pas "< 100", le chiffre exact
    // garantit le gain perf — un refacto qui passerait fonctionnellement
    // mais ferait toujours N queries doit faire échouer ce test).
    expect(prisma.expense.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.budget.findFirst).not.toHaveBeenCalled();
    // budget.findMany est appelé pour trouver les candidats (1 ou 2 fois
    // selon affectedCdcIds), pas dans la boucle de threshold check.
    expect(prisma.budget.findMany).toHaveBeenCalledTimes(1); // affectedCdcIds vide
  });

  it('uses EXACTLY 1 expense.findMany with mixed CdC + non-CdC candidates', async () => {
    const nonCdc = [
      {
        id: 'b-deleg',
        tenantId: 't1',
        delegationId: 'deleg-A',
        siteId: null,
        expenseType: null,
        billingEntityId: null,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        amount: 5000,
        currency: 'EUR',
        label: 'Budget délégation A',
        alertsEnabled: true,
        alertThresholdPct: 80,
      },
    ];
    const cdc = [
      {
        id: 'b-cdc',
        tenantId: 't1',
        delegationId: null,
        siteId: null,
        expenseType: null,
        billingEntityId: 'cdc-IT',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        amount: 3000,
        currency: 'EUR',
        label: 'Budget CdC IT',
        alertsEnabled: true,
        alertThresholdPct: 80,
      },
    ];
    prisma.budget.findMany
      .mockResolvedValueOnce(nonCdc) // nonCdcCandidates
      .mockResolvedValueOnce(cdc); // cdcCandidates
    prisma.expense.findMany.mockResolvedValue([]);

    await service.checkThresholdsForExpense('t1', {
      delegationId: 'deleg-A',
      siteId: null,
      type: 'SERVICE',
      bearerId: 'cdc-IT',
      allocationTargetIds: [],
      dateIncurred: new Date('2026-06-15'),
    });

    expect(prisma.expense.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.budget.findFirst).not.toHaveBeenCalled();
    // 2 budget.findMany : 1 pour nonCdcCandidates + 1 pour cdcCandidates
    expect(prisma.budget.findMany).toHaveBeenCalledTimes(2);
  });

  it('skips entirely when no candidates match (0 expense queries)', async () => {
    prisma.budget.findMany
      .mockResolvedValueOnce([]) // nonCdcCandidates
      .mockResolvedValueOnce([]); // cdcCandidates
    // Aucune query expense ne devrait être déclenchée.

    await service.checkThresholdsForExpense('t1', {
      delegationId: 'deleg-A',
      siteId: null,
      type: 'SERVICE',
      bearerId: null,
      allocationTargetIds: [],
      dateIncurred: new Date('2026-06-15'),
    });

    expect(prisma.expense.findMany).not.toHaveBeenCalled();
    expect(prisma.budget.findFirst).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────
  // Math : invariants computeDelegationSpentSync + computeCdcSpentSync
  // doivent être identiques aux versions async qu'ils remplacent.
  // ───────────────────────────────────────────────────────────────────

  it('correctly sums ONE_TIME expenses for a non-CdC budget (in-memory)', async () => {
    const candidate = {
      id: 'b1',
      tenantId: 't1',
      delegationId: 'deleg-A',
      siteId: null,
      expenseType: null,
      billingEntityId: null,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 100, // budget tight pour atteindre 80% threshold
      currency: 'EUR',
      label: 'Budget A',
      alertsEnabled: true,
      alertThresholdPct: 80,
    };
    prisma.budget.findMany
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([]);

    // 1 expense ONE_TIME de 90 EUR (= 90% du budget → seuil atteint)
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'e1',
        totalAmount: 90,
        frequency: 'ONE_TIME',
        dateStart: null,
        dateEnd: null,
        dateIncurred: new Date('2026-06-15'),
        delegationId: 'deleg-A',
        siteId: null,
        type: 'SERVICE',
        bearerId: 'cdc-other',
        allocations: [],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([]); // pas de recipient → notify ne fait rien

    await service.checkThresholdsForExpense('t1', {
      delegationId: 'deleg-A',
      siteId: null,
      type: 'SERVICE',
      bearerId: null,
      allocationTargetIds: [],
      dateIncurred: new Date('2026-06-15'),
    });

    // Threshold atteint → user.findMany appelé pour les recipients
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify when threshold not reached', async () => {
    const candidate = {
      id: 'b1',
      tenantId: 't1',
      delegationId: 'deleg-A',
      siteId: null,
      expenseType: null,
      billingEntityId: null,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 1000, // budget large
      currency: 'EUR',
      label: 'Budget A',
      alertsEnabled: true,
      alertThresholdPct: 80,
    };
    prisma.budget.findMany
      .mockResolvedValueOnce([candidate])
      .mockResolvedValueOnce([]);

    // 1 expense de 100 EUR (= 10% du budget → bien sous 80%)
    prisma.expense.findMany.mockResolvedValue([
      {
        id: 'e1',
        totalAmount: 100,
        frequency: 'ONE_TIME',
        dateStart: null,
        dateEnd: null,
        dateIncurred: new Date('2026-06-15'),
        delegationId: 'deleg-A',
        siteId: null,
        type: 'SERVICE',
        bearerId: 'cdc-other',
        allocations: [],
      },
    ]);

    await service.checkThresholdsForExpense('t1', {
      delegationId: 'deleg-A',
      siteId: null,
      type: 'SERVICE',
      bearerId: null,
      allocationTargetIds: [],
      dateIncurred: new Date('2026-06-15'),
    });

    // Pas de threshold atteint → user.findMany jamais appelé
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
