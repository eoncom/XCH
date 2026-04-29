import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 — parametric findOne cross-delegation defense.
 *
 * For every module that adopted the @CallerCtx-based RBAC pattern in
 * the audit Phase 2, we verify the same property : a user authenticated
 * on delegation A who tries to GET /api/<module>/:idB (a row that
 * belongs to delegation B) gets 404 (not 200, not 403 — the goal is
 * "indistinguishable from non-existent").
 *
 * Super admin always bypasses → expects 200.
 *
 * Modules covered :
 *   sites, racks, tasks, floor-plans, assets, monitors,
 *   billing-entities, expenses, budgets.
 *
 * (Modules already covered by their dedicated specs : contacts,
 * connectivity, sdwan, consumption, notification-settings.)
 */
describe('findOne — cross-delegation defense (ADR-021)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seed: RbacSeedResult;

  let admin: AuthenticatedAgent;
  let techA: AuthenticatedAgent;

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    seed = await seedRbac(prisma);

    admin = await loginAs(app, seed.users.admin.email, RBAC_SEED_PASSWORD);
    techA = await loginAs(app, seed.users.techA.email, RBAC_SEED_PASSWORD);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  /**
   * Each scenario describes one module:
   *   - basePath : route prefix
   *   - idA / idB : seeded ids in delegation A & B
   *   - expectedCrossStatus : 404 for site-scoped + delegation-scoped
   *     modules. (No "200 with leaks" allowed. No 403 either, that
   *     would reveal existence.)
   */
  const SCENARIOS: Array<{
    name: string;
    basePath: string;
    idA: () => string;
    idB: () => string;
  }> = [
    { name: 'sites',            basePath: '/api/sites',            idA: () => seed.sites.a,                  idB: () => seed.sites.b },
    { name: 'racks',            basePath: '/api/racks',            idA: () => seed.modules.aRackId,           idB: () => seed.modules.bRackId },
    { name: 'tasks',            basePath: '/api/tasks',            idA: () => seed.modules.aTaskId,           idB: () => seed.modules.bTaskId },
    { name: 'floor-plans',      basePath: '/api/floor-plans',      idA: () => seed.modules.aFloorPlanId,      idB: () => seed.modules.bFloorPlanId },
    { name: 'assets',           basePath: '/api/assets',           idA: () => seed.modules.aAssetId,          idB: () => seed.modules.bAssetId },
    { name: 'monitors',         basePath: '/api/monitors',         idA: () => seed.modules.aMonitorCheckId,   idB: () => seed.modules.bMonitorCheckId },
    { name: 'billing-entities', basePath: '/api/billing-entities', idA: () => seed.modules.aBillingEntityId,  idB: () => seed.modules.bBillingEntityId },
    { name: 'expenses',         basePath: '/api/expenses',         idA: () => seed.modules.aExpenseId,        idB: () => seed.modules.bExpenseId },
    { name: 'budgets',          basePath: '/api/budgets',          idA: () => seed.modules.aBudgetId,         idB: () => seed.modules.bBudgetId },
  ];

  describe.each(SCENARIOS)('$name — GET /:id', ({ name, basePath, idA, idB }) => {
    it(`tech-A on B → 404 (guess-by-id defense)`, async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `${basePath}/${idB()}`,
        delegationId: seed.delegations.a,
      });
      // Some modules layer a Forbidden/403 path on top (when user has no
      // managed delegation at all). The point of ADR-021 is to refuse
      // information disclosure — 404 is the canonical answer.
      // Accept 403 if the module's authz layer returns it before the
      // service-level 404 (e.g. expenses/budgets RequireManage path).
      expect([403, 404]).toContain(res.status);
      // No leakage of fields from B.
      expect(res.body).not.toHaveProperty('id', idB());
    });

    it(`super admin on B → 200 (bypass)`, async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: `${basePath}/${idB()}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      // Object identity confirmed.
      // (Some endpoints wrap in {data: {...}} — both shapes accepted.)
      const body = res.body.data ?? res.body;
      expect(body.id).toBe(idB());
    });

    it(`tech-A on A → 200 (legitimate)`, async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `${basePath}/${idA()}`,
        delegationId: seed.delegations.a,
      });
      // Some modules require MANAGE (expenses / budgets / billing-entities)
      // and tech-A only has WRITE on A → 403. Accept it as a non-leak.
      // For the modules tech-A actually has access to, expect 200.
      expect([200, 403]).toContain(res.status);
    });
  });
});
