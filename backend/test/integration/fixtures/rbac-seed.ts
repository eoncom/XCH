import { PrismaClient, DelegationRight, MonitorKind } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * ADR-021 — RBAC test seed.
 *
 * Provisions a deterministic dataset for intrusion tests :
 *   - 1 tenant, 2 delegations (A, B).
 *   - 5 users :
 *       admin@rbac.test            — super admin (no UserDelegation rows).
 *       manager-a@rbac.test        — MANAGE on delegation A.
 *       tech-a@rbac.test           — WRITE on delegation A.
 *       viewer-a@rbac.test         — READ on delegation A.
 *       manager-b@rbac.test        — MANAGE on delegation B.
 *   - 1 site per delegation, 1 contact per delegation + 1 global contact.
 *   - 1 connectivity link per delegation.
 *
 * Specs may add their own rows on top (per-module seed) but the base
 * matrix is fixed. Common password = 'Rbac1234'.
 */

export const RBAC_SEED_PASSWORD = 'Rbac1234';

export interface RbacSeedResult {
  tenantId: string;
  delegations: { a: string; b: string };
  users: {
    admin: { id: string; email: string };
    managerA: { id: string; email: string };
    techA: { id: string; email: string };
    viewerA: { id: string; email: string };
    managerB: { id: string; email: string };
  };
  sites: { a: string; b: string };
  contacts: { aContactId: string; bContactId: string; globalContactId: string };
  links: { aLinkId: string; bLinkId: string };
  /**
   * One row per module per delegation (A & B), seeded for the parametric
   * cross-delegation findOne test (find-one-cross-delegation.spec.ts).
   * Minimal fields only — extend per-spec if a finer assertion is needed.
   */
  modules: {
    aRackId: string;
    bRackId: string;
    aTaskId: string;
    bTaskId: string;
    aFloorPlanId: string;
    bFloorPlanId: string;
    aAssetId: string;
    bAssetId: string;
    aMonitorCheckId: string;
    bMonitorCheckId: string;
    aBillingEntityId: string;
    bBillingEntityId: string;
    aExpenseId: string;
    bExpenseId: string;
    aBudgetId: string;
    bBudgetId: string;
  };
}

const TENANT_ID = 'rbac-tenant';
const DEL_A = 'rbac-del-a';
const DEL_B = 'rbac-del-b';

export async function seedRbac(prisma: PrismaClient): Promise<RbacSeedResult> {
  await wipeRbac(prisma);

  const passwordHash = await bcrypt.hash(RBAC_SEED_PASSWORD, 10);

  // Tenant
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: 'RBAC Test Tenant', subdomain: 'rbac-test', status: 'ACTIVE' },
  });

  // Delegations
  await prisma.delegation.create({
    data: { id: DEL_A, tenantId: TENANT_ID, code: 'DEL-A', name: 'Délégation A' },
  });
  await prisma.delegation.create({
    data: { id: DEL_B, tenantId: TENANT_ID, code: 'DEL-B', name: 'Délégation B' },
  });

  // Users
  const admin = await prisma.user.create({
    data: {
      id: 'rbac-user-admin',
      tenantId: TENANT_ID,
      email: 'admin@rbac.test',
      name: 'Admin Super',
      passwordHash,
      authProvider: 'local',
      isSuperAdmin: true,
      active: true,
    },
  });
  const managerA = await prisma.user.create({
    data: {
      id: 'rbac-user-manager-a',
      tenantId: TENANT_ID,
      email: 'manager-a@rbac.test',
      name: 'Manager A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const techA = await prisma.user.create({
    data: {
      id: 'rbac-user-tech-a',
      tenantId: TENANT_ID,
      email: 'tech-a@rbac.test',
      name: 'Tech A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const viewerA = await prisma.user.create({
    data: {
      id: 'rbac-user-viewer-a',
      tenantId: TENANT_ID,
      email: 'viewer-a@rbac.test',
      name: 'Viewer A',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });
  const managerB = await prisma.user.create({
    data: {
      id: 'rbac-user-manager-b',
      tenantId: TENANT_ID,
      email: 'manager-b@rbac.test',
      name: 'Manager B',
      passwordHash,
      authProvider: 'local',
      active: true,
    },
  });

  // UserDelegations
  await prisma.userDelegation.createMany({
    data: [
      { tenantId: TENANT_ID, userId: managerA.id, delegationId: DEL_A, right: DelegationRight.MANAGE },
      { tenantId: TENANT_ID, userId: techA.id,    delegationId: DEL_A, right: DelegationRight.WRITE },
      { tenantId: TENANT_ID, userId: viewerA.id,  delegationId: DEL_A, right: DelegationRight.READ },
      { tenantId: TENANT_ID, userId: managerB.id, delegationId: DEL_B, right: DelegationRight.MANAGE },
    ],
  });

  // Sites
  const siteA = await prisma.site.create({
    data: {
      id: 'rbac-site-a',
      tenantId: TENANT_ID,
      delegationId: DEL_A,
      code: 'SITE-A',
      name: 'Site A',
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    },
  });
  const siteB = await prisma.site.create({
    data: {
      id: 'rbac-site-b',
      tenantId: TENANT_ID,
      delegationId: DEL_B,
      code: 'SITE-B',
      name: 'Site B',
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    },
  });

  // ContactType (required FK for Contact)
  const contactType = await prisma.contactType.create({
    data: {
      id: 'rbac-contact-type',
      tenantId: TENANT_ID,
      slug: 'rbac-default',
      name: 'Default',
      category: 'TECHNICAL',
      isActive: true,
    },
  });

  // Contacts : one per delegation + one global (delegationId=null)
  const aContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-a',
      tenantId: TENANT_ID,
      delegationId: DEL_A,
      typeId: contactType.id,
      name: 'Contact A',
      isActive: true,
    },
  });
  const bContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-b',
      tenantId: TENANT_ID,
      delegationId: DEL_B,
      typeId: contactType.id,
      name: 'Contact B',
      isActive: true,
    },
  });
  const globalContact = await prisma.contact.create({
    data: {
      id: 'rbac-contact-global',
      tenantId: TENANT_ID,
      delegationId: null,
      typeId: contactType.id,
      name: 'Contact Global',
      isActive: true,
    },
  });

  // ConnectivityLinks : one per site (provider + type required, role default PRIMARY)
  const aLink = await prisma.connectivityLink.create({
    data: {
      id: 'rbac-link-a',
      tenantId: TENANT_ID,
      siteId: siteA.id,
      provider: 'Test ISP A',
      type: 'FIBER',
    },
  });
  const bLink = await prisma.connectivityLink.create({
    data: {
      id: 'rbac-link-b',
      tenantId: TENANT_ID,
      siteId: siteB.id,
      provider: 'Test ISP B',
      type: 'FIBER',
    },
  });

  // ─────────────────────────────────────────────────────────────────────
  // Per-module rows — one per delegation A/B, minimal-shape inserts. Used
  // by find-one-cross-delegation.spec.ts to validate the ADR-021 guess-by-id
  // defense uniformly across modules.
  // ─────────────────────────────────────────────────────────────────────

  // Racks (siteId required)
  const aRack = await prisma.rack.create({
    data: {
      id: 'rbac-rack-a',
      tenantId: TENANT_ID,
      siteId: siteA.id,
      name: 'Rack A',
      heightU: 42,
    },
  });
  const bRack = await prisma.rack.create({
    data: {
      id: 'rbac-rack-b',
      tenantId: TENANT_ID,
      siteId: siteB.id,
      name: 'Rack B',
      heightU: 42,
    },
  });

  // Tasks (siteId required, type/title required)
  const aTask = await prisma.task.create({
    data: {
      id: 'rbac-task-a',
      tenantId: TENANT_ID,
      siteId: siteA.id,
      title: 'Task A',
    },
  });
  const bTask = await prisma.task.create({
    data: {
      id: 'rbac-task-b',
      tenantId: TENANT_ID,
      siteId: siteB.id,
      title: 'Task B',
    },
  });

  // FloorPlans (siteId required, fileUrl + uploadedBy required)
  const aFloorPlan = await prisma.floorPlan.create({
    data: {
      id: 'rbac-floorplan-a',
      siteId: siteA.id,
      title: 'Floor Plan A',
      fileUrl: 'rbac://noop',
      uploadedBy: admin.id,
    },
  });
  const bFloorPlan = await prisma.floorPlan.create({
    data: {
      id: 'rbac-floorplan-b',
      siteId: siteB.id,
      title: 'Floor Plan B',
      fileUrl: 'rbac://noop',
      uploadedBy: admin.id,
    },
  });

  // Assets (siteId optional, but we want them site-scoped for the test)
  const aAsset = await prisma.asset.create({
    data: {
      id: 'rbac-asset-a',
      tenantId: TENANT_ID,
      delegationId: DEL_A,
      siteId: siteA.id,
      type: 'OTHER',
      status: 'IN_SERVICE',
    },
  });
  const bAsset = await prisma.asset.create({
    data: {
      id: 'rbac-asset-b',
      tenantId: TENANT_ID,
      delegationId: DEL_B,
      siteId: siteB.id,
      type: 'OTHER',
      status: 'IN_SERVICE',
    },
  });

  // MonitorChecks (polymorphic — pick siteId direct, simplest scenario)
  const aMonitorCheck = await prisma.monitorCheck.create({
    data: {
      id: 'rbac-monitor-a',
      tenantId: TENANT_ID,
      siteId: siteA.id,
      kind: MonitorKind.ICMP,
      target: '127.0.0.1',
    },
  });
  const bMonitorCheck = await prisma.monitorCheck.create({
    data: {
      id: 'rbac-monitor-b',
      tenantId: TENANT_ID,
      siteId: siteB.id,
      kind: MonitorKind.ICMP,
      target: '127.0.0.2',
    },
  });

  // BillingEntities (delegation-scoped)
  const aBillingEntity = await prisma.billingEntity.create({
    data: {
      id: 'rbac-be-a',
      tenantId: TENANT_ID,
      name: 'Billing A',
      code: 'BE-A',
      type: 'DIRECTION',
      delegationId: DEL_A,
    },
  });
  const bBillingEntity = await prisma.billingEntity.create({
    data: {
      id: 'rbac-be-b',
      tenantId: TENANT_ID,
      name: 'Billing B',
      code: 'BE-B',
      type: 'DIRECTION',
      delegationId: DEL_B,
    },
  });

  // Expenses (delegationId required, bearerId required)
  const aExpense = await prisma.expense.create({
    data: {
      id: 'rbac-expense-a',
      tenantId: TENANT_ID,
      label: 'Expense A',
      totalAmount: 100,
      dateIncurred: new Date('2026-01-01'),
      bearerId: aBillingEntity.id,
      delegationId: DEL_A,
      createdBy: admin.id,
    },
  });
  const bExpense = await prisma.expense.create({
    data: {
      id: 'rbac-expense-b',
      tenantId: TENANT_ID,
      label: 'Expense B',
      totalAmount: 200,
      dateIncurred: new Date('2026-01-01'),
      bearerId: bBillingEntity.id,
      delegationId: DEL_B,
      createdBy: admin.id,
    },
  });

  // Budgets (delegationId nullable)
  const aBudget = await prisma.budget.create({
    data: {
      id: 'rbac-budget-a',
      tenantId: TENANT_ID,
      label: 'Budget A',
      delegationId: DEL_A,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 10000,
    },
  });
  const bBudget = await prisma.budget.create({
    data: {
      id: 'rbac-budget-b',
      tenantId: TENANT_ID,
      label: 'Budget B',
      delegationId: DEL_B,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      amount: 20000,
    },
  });

  return {
    tenantId: TENANT_ID,
    delegations: { a: DEL_A, b: DEL_B },
    users: {
      admin: { id: admin.id, email: admin.email },
      managerA: { id: managerA.id, email: managerA.email },
      techA: { id: techA.id, email: techA.email },
      viewerA: { id: viewerA.id, email: viewerA.email },
      managerB: { id: managerB.id, email: managerB.email },
    },
    sites: { a: siteA.id, b: siteB.id },
    contacts: { aContactId: aContact.id, bContactId: bContact.id, globalContactId: globalContact.id },
    links: { aLinkId: aLink.id, bLinkId: bLink.id },
    modules: {
      aRackId: aRack.id,
      bRackId: bRack.id,
      aTaskId: aTask.id,
      bTaskId: bTask.id,
      aFloorPlanId: aFloorPlan.id,
      bFloorPlanId: bFloorPlan.id,
      aAssetId: aAsset.id,
      bAssetId: bAsset.id,
      aMonitorCheckId: aMonitorCheck.id,
      bMonitorCheckId: bMonitorCheck.id,
      aBillingEntityId: aBillingEntity.id,
      bBillingEntityId: bBillingEntity.id,
      aExpenseId: aExpense.id,
      bExpenseId: bExpense.id,
      aBudgetId: aBudget.id,
      bBudgetId: bBudget.id,
    },
  };
}

/**
 * Cleanup. ON DELETE CASCADE on Tenant cascades to all child rows.
 */
export async function wipeRbac(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}
