import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 — Contact cross-delegation intrusion specs.
 *
 * Validates the bug confirmed in audit Phase 1 is fixed :
 *   - tech-A GET /api/contacts must NOT include contacts attached to
 *     delegation B (regression user-reported in pilot test).
 *   - tech-A GET /api/contacts/:idB → 404 (defense in depth).
 *   - tech-A PATCH/DELETE on contact B → 403.
 *   - Global contacts (delegationId=null) remain readable by everyone
 *     (Contact schema annotation : "global, visible en lecture partout").
 *   - Super admin bypass works.
 *
 * Pre-requisites in CI : Postgres + Redis + JWT_SECRET. Migrations
 * applied before the spec runs.
 */
describe('Contacts — RBAC cross-delegation (ADR-021)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seed: RbacSeedResult;

  let admin: AuthenticatedAgent;
  let techA: AuthenticatedAgent;
  let managerA: AuthenticatedAgent;
  let viewerA: AuthenticatedAgent;
  let managerB: AuthenticatedAgent;

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    seed = await seedRbac(prisma);

    admin = await loginAs(app, seed.users.admin.email, RBAC_SEED_PASSWORD);
    techA = await loginAs(app, seed.users.techA.email, RBAC_SEED_PASSWORD);
    managerA = await loginAs(app, seed.users.managerA.email, RBAC_SEED_PASSWORD);
    viewerA = await loginAs(app, seed.users.viewerA.email, RBAC_SEED_PASSWORD);
    managerB = await loginAs(app, seed.users.managerB.email, RBAC_SEED_PASSWORD);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  describe('GET /api/contacts (list filtering)', () => {
    it('tech-A sees only contacts of A + global, never B', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: '/api/contacts',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const ids = (res.body.data ?? res.body).map((c: any) => c.id);
      expect(ids).toContain(seed.contacts.aContactId);
      expect(ids).toContain(seed.contacts.globalContactId);
      expect(ids).not.toContain(seed.contacts.bContactId);
    });

    it('manager-B sees only contacts of B + global, never A', async () => {
      const res = await intrusionRequest(app, managerB, {
        method: 'GET',
        path: '/api/contacts',
        delegationId: seed.delegations.b,
      });
      expect(res.status).toBe(200);
      const ids = (res.body.data ?? res.body).map((c: any) => c.id);
      expect(ids).toContain(seed.contacts.bContactId);
      expect(ids).toContain(seed.contacts.globalContactId);
      expect(ids).not.toContain(seed.contacts.aContactId);
    });

    it('super admin sees everything', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: '/api/contacts',
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      const ids = (res.body.data ?? res.body).map((c: any) => c.id);
      expect(ids).toContain(seed.contacts.aContactId);
      expect(ids).toContain(seed.contacts.bContactId);
      expect(ids).toContain(seed.contacts.globalContactId);
    });
  });

  describe('GET /api/contacts/:id (guess by id)', () => {
    it('tech-A on contact A → 200 (legitimate)', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/contacts/${seed.contacts.aContactId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(seed.contacts.aContactId);
    });

    it('tech-A on contact B (cross-delegation) → 404', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/contacts/${seed.contacts.bContactId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(404);
    });

    it('tech-A on global contact → 200 (allowGlobal)', async () => {
      const res = await intrusionRequest(app, techA, {
        method: 'GET',
        path: `/api/contacts/${seed.contacts.globalContactId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });

    it('super admin on contact B → 200 (bypass)', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'GET',
        path: `/api/contacts/${seed.contacts.bContactId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/contacts/:id (write protection)', () => {
    it('manager-A on contact B → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PATCH',
        path: `/api/contacts/${seed.contacts.bContactId}`,
        delegationId: seed.delegations.a,
        body: { name: 'Hijacked B' },
      });
      expect(res.status).toBe(403);
    });

    it('viewer-A on contact A (read-only) → 403', async () => {
      const res = await intrusionRequest(app, viewerA, {
        method: 'PATCH',
        path: `/api/contacts/${seed.contacts.aContactId}`,
        delegationId: seed.delegations.a,
        body: { name: 'Viewer-tried' },
      });
      expect(res.status).toBe(403);
    });

    it('manager-A on global contact → 403 (super-admin only)', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PATCH',
        path: `/api/contacts/${seed.contacts.globalContactId}`,
        delegationId: seed.delegations.a,
        body: { name: 'Hijacked global' },
      });
      expect(res.status).toBe(403);
    });

    it('manager-A on contact A (legitimate write) → 200', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PATCH',
        path: `/api/contacts/${seed.contacts.aContactId}`,
        delegationId: seed.delegations.a,
        body: { name: 'Updated A' },
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated A');
    });
  });

  describe('DELETE /api/contacts/:id (write protection)', () => {
    it('manager-A on contact B → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'DELETE',
        path: `/api/contacts/${seed.contacts.bContactId}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/contacts (cross-write at create)', () => {
    it('manager-A trying to create a contact in delegation B → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'POST',
        path: '/api/contacts',
        delegationId: seed.delegations.a,
        body: {
          name: 'Smuggled into B',
          typeId: 'rbac-contact-type',
          delegationId: seed.delegations.b,
        },
      });
      expect(res.status).toBe(403);
    });

    it('manager-A trying to create a global contact (delegationId omitted) → 403', async () => {
      // The DTO @IsString on delegationId rejects an explicit null with
      // 400 BadRequest before authz even runs. The cross-write attack
      // path that DOES reach authz is "omit the field" — service then
      // sees delegationId=undefined → null → super-admin only check.
      const res = await intrusionRequest(app, managerA, {
        method: 'POST',
        path: '/api/contacts',
        delegationId: seed.delegations.a,
        body: {
          name: 'Smuggled global',
          typeId: 'rbac-contact-type',
          // no delegationId field at all
        },
      });
      expect(res.status).toBe(403);
    });
  });
});
