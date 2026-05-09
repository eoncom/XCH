import { PrismaClient, ExpenseFrequency, ExpenseType } from '@prisma/client';

/**
 * S5b PR1 — minimal expenses seed for projection / reportByMonth integration
 * tests. Lighter than `rbac-seed.ts` because RBAC scopes are not exercised
 * here (projection() is super-admin only, reportByMonth() filters by
 * delegationId scope but we test that with an explicit param).
 *
 * Structure : 1 tenant, 1 delegation, 1 site, 1 bearer (BillingEntity).
 * Expenses are seeded per-test by calling `addExpense()` so each spec
 * can compose its own scenario.
 */

export const EXPENSES_SEED_TENANT = 's5b-expenses-tenant';
export const EXPENSES_SEED_DELEGATION = 's5b-expenses-deleg';
export const EXPENSES_SEED_SITE = 's5b-expenses-site';
export const EXPENSES_SEED_BEARER = 's5b-expenses-bearer';

export interface ExpensesSeedResult {
  tenantId: string;
  delegationId: string;
  siteId: string;
  bearerId: string;
}

export async function seedExpensesBaseline(
  prisma: PrismaClient,
): Promise<ExpensesSeedResult> {
  await wipeExpensesSeed(prisma);

  await prisma.tenant.create({
    data: {
      id: EXPENSES_SEED_TENANT,
      name: 'S5b Expenses Test Tenant',
      subdomain: 's5b-expenses',
      status: 'ACTIVE',
    },
  });
  await prisma.delegation.create({
    data: {
      id: EXPENSES_SEED_DELEGATION,
      tenantId: EXPENSES_SEED_TENANT,
      code: 'S5B-DEL',
      name: 'Délégation S5b',
    },
  });
  await prisma.site.create({
    data: {
      id: EXPENSES_SEED_SITE,
      tenantId: EXPENSES_SEED_TENANT,
      delegationId: EXPENSES_SEED_DELEGATION,
      name: 'Site S5b',
      code: 'S5B-SITE',
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    },
  });
  await prisma.billingEntity.create({
    data: {
      id: EXPENSES_SEED_BEARER,
      tenantId: EXPENSES_SEED_TENANT,
      delegationId: EXPENSES_SEED_DELEGATION,
      name: 'Bearer S5b',
      code: 'S5B-BEAR',
      type: 'DELEGATION',
    },
  });

  return {
    tenantId: EXPENSES_SEED_TENANT,
    delegationId: EXPENSES_SEED_DELEGATION,
    siteId: EXPENSES_SEED_SITE,
    bearerId: EXPENSES_SEED_BEARER,
  };
}

export async function wipeExpensesSeed(prisma: PrismaClient) {
  // Order matters : children before parents.
  await prisma.costAllocation.deleteMany({ where: { expense: { tenantId: EXPENSES_SEED_TENANT } } });
  await prisma.expense.deleteMany({ where: { tenantId: EXPENSES_SEED_TENANT } });
  await prisma.budget.deleteMany({ where: { tenantId: EXPENSES_SEED_TENANT } });
  await prisma.billingEntity.deleteMany({ where: { tenantId: EXPENSES_SEED_TENANT } });
  await prisma.site.deleteMany({ where: { tenantId: EXPENSES_SEED_TENANT } });
  await prisma.delegation.deleteMany({ where: { tenantId: EXPENSES_SEED_TENANT } });
  await prisma.tenant.deleteMany({ where: { id: EXPENSES_SEED_TENANT } });
}

export interface AddExpenseInput {
  label: string;
  totalAmount: number;
  frequency: ExpenseFrequency;
  type?: ExpenseType;
  dateIncurred: Date;
  dateStart?: Date | null;
  dateEnd?: Date | null;
  delegationId?: string;
  siteId?: string | null;
  bearerId?: string;
}

export async function addExpense(
  prisma: PrismaClient,
  seed: ExpensesSeedResult,
  input: AddExpenseInput,
) {
  return prisma.expense.create({
    data: {
      tenantId: seed.tenantId,
      label: input.label,
      totalAmount: input.totalAmount,
      frequency: input.frequency,
      type: input.type ?? ExpenseType.OTHER,
      dateIncurred: input.dateIncurred,
      dateStart: input.dateStart ?? null,
      dateEnd: input.dateEnd ?? null,
      delegationId: input.delegationId ?? seed.delegationId,
      siteId: input.siteId === undefined ? seed.siteId : input.siteId,
      bearerId: input.bearerId ?? seed.bearerId,
      createdBy: 'system',
    },
  });
}
