import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 — sdwan cross-site intrusion specs.
 *
 * Validates audit Phase 1 finding : `ensureSite(tenantId, siteId)`
 * validated only the tenant, leaking firewall infra (ip/mac/hostname/
 * vlan/port) of any tenant site to a tech of any delegation. Now
 * `ensureSiteForRead/Write` calls assertCanRead/WriteSite first.
 */
describe('SD-WAN — RBAC cross-site (ADR-021)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seed: RbacSeedResult;

  let admin: AuthenticatedAgent;
  let techA: AuthenticatedAgent;
  let managerA: AuthenticatedAgent;

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    seed = await seedRbac(prisma);

    admin = await loginAs(app, seed.users.admin.email, RBAC_SEED_PASSWORD);
    techA = await loginAs(app, seed.users.techA.email, RBAC_SEED_PASSWORD);
    managerA = await loginAs(app, seed.users.managerA.email, RBAC_SEED_PASSWORD);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  describe('GET /api/sdwan/:siteId', () => {
    it('tech-A on site B (cross-delegation) → 404', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/sdwan/${seed.sites.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(404);
    });

    it('tech-A on site A → 200 (config null acceptable)', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/sdwan/${seed.sites.a}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });

    it('super admin on site B → 200 (bypass)', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: `/api/sdwan/${seed.sites.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/sdwan/:siteId (write protection)', () => {
    it('manager-A on site B → 404 (read denied first)', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PUT',
        path: `/api/sdwan/${seed.sites.b}`,
        delegationId: seed.delegations.a,
        body: { enabled: true, provider: 'Hijacked' },
      });
      // ensureSiteForWrite : assertCanReadSite throws 404 first → expected.
      // (If access were granted at read but denied at write we'd get 403 ;
      // for cross-deleg the read denial wins.)
      expect(res.status).toBe(404);
    });

    it('manager-A on site A → 200 (legitimate)', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PUT',
        path: `/api/sdwan/${seed.sites.a}`,
        delegationId: seed.delegations.a,
        body: { enabled: true, provider: 'Test ISP A' },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/sdwan/:siteId', () => {
    it('manager-A on site B → 404', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'DELETE',
        path: `/api/sdwan/${seed.sites.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(404);
    });
  });
});
