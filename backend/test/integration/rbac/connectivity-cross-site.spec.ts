import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 — ConnectivityLink cross-site intrusion specs.
 *
 * Validates the audit Phase 1 finding : connectivity.service.findAll
 * was scoped only via opt-in `?siteId=…` query, leaking the entire
 * tenant to any authenticated user.
 *
 * Scope is now site-based (getReadableSiteIds + assertCanReadSite).
 * No global "tenant-shared" semantics for ConnectivityLink — it's
 * always tied to a site.
 */
describe('ConnectivityLink — RBAC cross-site (ADR-021)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seed: RbacSeedResult;

  let admin: AuthenticatedAgent;
  let techA: AuthenticatedAgent;
  let managerA: AuthenticatedAgent;
  let managerB: AuthenticatedAgent;

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    seed = await seedRbac(prisma);

    admin = await loginAs(app, seed.users.admin.email, RBAC_SEED_PASSWORD);
    techA = await loginAs(app, seed.users.techA.email, RBAC_SEED_PASSWORD);
    managerA = await loginAs(app, seed.users.managerA.email, RBAC_SEED_PASSWORD);
    managerB = await loginAs(app, seed.users.managerB.email, RBAC_SEED_PASSWORD);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  describe('GET /api/connectivity (list filtering)', () => {
    it('tech-A sees only links of site A, never B', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: '/api/connectivity',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const ids = (res.body as any[]).map((l) => l.id);
      expect(ids).toContain(seed.links.aLinkId);
      expect(ids).not.toContain(seed.links.bLinkId);
    });

    it('manager-B sees only links of site B', async () => {
      const res = await intrusionRequest(app, managerB, {
        method: 'GET',
        path: '/api/connectivity',
        delegationId: seed.delegations.b,
      });
      expect(res.status).toBe(200);
      const ids = (res.body as any[]).map((l) => l.id);
      expect(ids).toContain(seed.links.bLinkId);
      expect(ids).not.toContain(seed.links.aLinkId);
    });

    it('super admin sees both links', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: '/api/connectivity',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const ids = (res.body as any[]).map((l) => l.id);
      expect(ids).toContain(seed.links.aLinkId);
      expect(ids).toContain(seed.links.bLinkId);
    });
  });

  describe('GET /api/connectivity/:id (guess by id)', () => {
    it('tech-A on link B (cross-site) → 404', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/connectivity/${seed.links.bLinkId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(404);
    });

    it('tech-A on link A (legitimate) → 200', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/connectivity/${seed.links.aLinkId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });

    it('super admin on link B → 200 (bypass)', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: `/api/connectivity/${seed.links.bLinkId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/connectivity/:id (write protection)', () => {
    it('manager-A on link B → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PATCH',
        path: `/api/connectivity/${seed.links.bLinkId}`,
        delegationId: seed.delegations.a,
        body: { provider: 'Hijacked' },
      });
      expect(res.status).toBe(403);
    });

    it('manager-A on link A (legitimate) → 200', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PATCH',
        path: `/api/connectivity/${seed.links.aLinkId}`,
        delegationId: seed.delegations.a,
        body: { provider: 'Updated A' },
      });
      expect(res.status).toBe(200);
      expect((res.body as any).provider).toBe('Updated A');
    });
  });

  describe('POST /api/connectivity (cross-write at create)', () => {
    it('manager-A trying to create a link on site B → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'POST',
        path: '/api/connectivity',
        delegationId: seed.delegations.a,
        body: {
          siteId: seed.sites.b,
          role: 'PRIMARY',
          provider: 'Smuggled',
          type: 'FIBER',
        },
      });
      expect(res.status).toBe(403);
    });
  });
});
