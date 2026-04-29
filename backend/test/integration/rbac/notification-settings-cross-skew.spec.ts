import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { bootTestApp, loginAs, intrusionRequest, AuthenticatedAgent } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult, RBAC_SEED_PASSWORD } from '../fixtures/rbac-seed';

/**
 * ADR-021 §C — notification-settings cross-skew intrusion specs.
 *
 * Validates the audit Phase 1 finding : the controller accepted a
 * delegationId from URL param/query/body without checking it matched
 * the active X-Delegation-Id header. A MANAGE-on-A user could write
 * the config of B by passing `delegationId: B` in the body.
 *
 * Pattern fixed via `enforceDelegationConsistency(req, paramOrDtoDelegationId)`
 * called in every handler that accepts a delegationId.
 */
describe('Notification settings — RBAC cross-skew (ADR-021 §C)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seed: RbacSeedResult;

  let admin: AuthenticatedAgent;
  let managerA: AuthenticatedAgent;
  let managerB: AuthenticatedAgent;

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    seed = await seedRbac(prisma);

    admin = await loginAs(app, seed.users.admin.email, RBAC_SEED_PASSWORD);
    managerA = await loginAs(app, seed.users.managerA.email, RBAC_SEED_PASSWORD);
    managerB = await loginAs(app, seed.users.managerB.email, RBAC_SEED_PASSWORD);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  describe('PUT /api/notifications/config — body delegationId mismatch', () => {
    it('manager-A writing config of B (header A, body B) → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PUT',
        path: '/api/notifications/config',
        delegationId: seed.delegations.a,
        body: {
          delegationId: seed.delegations.b,
          channels: [{ kind: 'EMAIL', enabled: true, recipients: ['hijack@b.test'] }],
          rules: [],
        },
      });
      expect(res.status).toBe(403);
    });

    it('manager-A writing config of A (consistent) → 200', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'PUT',
        path: '/api/notifications/config',
        delegationId: seed.delegations.a,
        body: {
          delegationId: seed.delegations.a,
          channels: [{ kind: 'EMAIL', enabled: true, recipients: ['ops@a.test'] }],
          rules: [],
        },
      });
      expect(res.status).toBe(200);
    });

    it('super admin writing config of B from any delegation header → 200 (bypass)', async () => {
      const res = await intrusionRequest(app, admin, {
        method: 'PUT',
        path: '/api/notifications/config',
        delegationId: seed.delegations.a,
        body: {
          delegationId: seed.delegations.b,
          channels: [{ kind: 'EMAIL', enabled: true, recipients: ['admin@b.test'] }],
          rules: [],
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/notifications/config/:delegationId — path mismatch', () => {
    it('manager-A reading config of B (header A, path B) → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'GET',
        path: `/api/notifications/config/${seed.delegations.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(403);
    });

    it('manager-A reading config of A (consistent) → 200', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'GET',
        path: `/api/notifications/config/${seed.delegations.a}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/notifications/config?delegationId=… — query mismatch', () => {
    it('manager-A reading config of B (header A, query B) → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'GET',
        path: `/api/notifications/config?delegationId=${seed.delegations.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/notifications/config/:delegationId — path mismatch', () => {
    it('manager-A deleting config of B (header A, path B) → 403', async () => {
      const res = await intrusionRequest(app, managerA, {
        method: 'DELETE',
        path: `/api/notifications/config/${seed.delegations.b}`,
        delegationId: seed.delegations.a,
      });
      expect(res.status).toBe(403);
    });
  });
});
