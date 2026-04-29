import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 — consumption cross-site intrusion specs.
 *
 * Validates audit Phase 1 finding :
 *   - computeSite(siteId) checked only tenant.
 *   - summary() iterated ALL sites of the tenant.
 * Both leaked consumption + asset metadata cross-delegation.
 *
 * Now : computeSite/computeRack call assertCanReadSite ; summary
 * filters sites by getReadableSiteIds.
 */
describe('Consumption — RBAC cross-site (ADR-021)', () => {
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

  describe('GET /api/consumption/site/:id', () => {
    it('tech-A on site B (cross-delegation) → 404', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/consumption/site/${seed.sites.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(404);
    });

    it('tech-A on site A → 200', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/consumption/site/${seed.sites.a}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });

    it('super admin on site B → 200 (bypass)', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: `/api/consumption/site/${seed.sites.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/consumption/summary', () => {
    it('tech-A summary contains only site A, never site B', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: '/api/consumption/summary',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const siteIds = ((res.body as any).sites ?? []).map((s: any) => s.site.id);
      expect(siteIds).toContain(seed.sites.a);
      expect(siteIds).not.toContain(seed.sites.b);
    });

    it('super admin summary contains both sites', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: '/api/consumption/summary',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const siteIds = ((res.body as any).sites ?? []).map((s: any) => s.site.id);
      expect(siteIds).toContain(seed.sites.a);
      expect(siteIds).toContain(seed.sites.b);
    });
  });
});
