import { INestApplication, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PermissionService } from '../../../src/common/services/permission.service';
import { CallerCtx, SYSTEM_CTX } from '../../../src/common/types/caller-ctx.interface';
import { bootTestApp } from '../helpers/intrusion';
import { seedRbac, wipeRbac, RbacSeedResult } from '../fixtures/rbac-seed';

/**
 * ADR-021 — canary spec for the helpers added in Session 4a PR1.
 *
 * Validates BEFORE any service refactor that:
 *   - getReadableSiteIds returns a tenant-scoped list for normal users,
 *     null for super admins.
 *   - getReadableDelegationIds returns the union of READ+WRITE+MANAGE
 *     UserDelegation rows.
 *   - assertCanReadSite throws 404 on denial, succeeds on allow,
 *     bypasses for super admin.
 *   - assertCanWriteSite throws 403 on read-only delegation.
 *   - assertCanReadDelegation honours the allowGlobal flag.
 *   - assertCanWriteDelegation refuses globals to non-super admins.
 *   - SYSTEM_CTX(reason, tenantId) requires both args, returns
 *     isSuperAdmin=true and a systemReason tag.
 *
 * Pre-requisites in CI : Postgres + Redis services running, prisma
 * migrate deploy applied.
 */
describe('PermissionService — RBAC foundations (ADR-021)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let perm: PermissionService;
  let seed: RbacSeedResult;

  const ctx = (over: Partial<CallerCtx>): CallerCtx => ({
    userId: 'placeholder',
    isSuperAdmin: false,
    tenantId: seed.tenantId,
    activeDelegationId: null,
    activeRight: null,
    ...over,
  });

  beforeAll(async () => {
    app = await bootTestApp();
    prisma = app.get(PrismaClient);
    perm = app.get(PermissionService);
    seed = await seedRbac(prisma);
  });

  afterAll(async () => {
    await wipeRbac(prisma);
    await app.close();
  });

  // ─────────────── getReadableSiteIds ───────────────
  describe('getReadableSiteIds', () => {
    it('returns null for super admin', async () => {
      const ids = await perm.getReadableSiteIds(ctx({ userId: seed.users.admin.id, isSuperAdmin: true }));
      expect(ids).toBeNull();
    });

    it('returns only delegation A sites for tech-A', async () => {
      const ids = await perm.getReadableSiteIds(ctx({ userId: seed.users.techA.id }));
      expect(ids).not.toBeNull();
      expect(ids).toContain(seed.sites.a);
      expect(ids).not.toContain(seed.sites.b);
    });

    it('returns only delegation B sites for manager-B', async () => {
      const ids = await perm.getReadableSiteIds(ctx({ userId: seed.users.managerB.id }));
      expect(ids).toContain(seed.sites.b);
      expect(ids).not.toContain(seed.sites.a);
    });
  });

  // ─────────────── getReadableDelegationIds ───────────────
  describe('getReadableDelegationIds', () => {
    it('returns null for super admin', async () => {
      const ids = await perm.getReadableDelegationIds(ctx({ userId: seed.users.admin.id, isSuperAdmin: true }));
      expect(ids).toBeNull();
    });

    it('returns A for viewer-A (READ only — covered by READ+WRITE+MANAGE union)', async () => {
      const ids = await perm.getReadableDelegationIds(ctx({ userId: seed.users.viewerA.id }));
      expect(ids).toEqual([seed.delegations.a]);
    });

    it('returns A for tech-A (WRITE)', async () => {
      const ids = await perm.getReadableDelegationIds(ctx({ userId: seed.users.techA.id }));
      expect(ids).toEqual([seed.delegations.a]);
    });

    it('returns A for manager-A (MANAGE)', async () => {
      const ids = await perm.getReadableDelegationIds(ctx({ userId: seed.users.managerA.id }));
      expect(ids).toEqual([seed.delegations.a]);
    });

    it('does not leak B to A users', async () => {
      const ids = await perm.getReadableDelegationIds(ctx({ userId: seed.users.viewerA.id }));
      expect(ids).not.toContain(seed.delegations.b);
    });
  });

  // ─────────────── assertCanReadSite ───────────────
  describe('assertCanReadSite — throws 404 on denial', () => {
    it('passes for tech-A on site A', async () => {
      await expect(
        perm.assertCanReadSite(ctx({ userId: seed.users.techA.id }), seed.sites.a),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException for tech-A on site B', async () => {
      await expect(
        perm.assertCanReadSite(ctx({ userId: seed.users.techA.id }), seed.sites.b),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('bypasses for super admin (any site)', async () => {
      await expect(
        perm.assertCanReadSite(ctx({ userId: seed.users.admin.id, isSuperAdmin: true }), seed.sites.b),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────── assertCanWriteSite ───────────────
  describe('assertCanWriteSite — throws 403 on read-only', () => {
    it('passes for tech-A (WRITE) on site A', async () => {
      await expect(
        perm.assertCanWriteSite(ctx({ userId: seed.users.techA.id }), seed.sites.a),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException for viewer-A on site A (READ only)', async () => {
      await expect(
        perm.assertCanWriteSite(ctx({ userId: seed.users.viewerA.id }), seed.sites.a),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException for tech-A on site B (no access)', async () => {
      await expect(
        perm.assertCanWriteSite(ctx({ userId: seed.users.techA.id }), seed.sites.b),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─────────────── assertCanReadDelegation ───────────────
  describe('assertCanReadDelegation — allowGlobal flag', () => {
    it('passes for tech-A on delegation A', async () => {
      await expect(
        perm.assertCanReadDelegation(ctx({ userId: seed.users.techA.id }), seed.delegations.a),
      ).resolves.toBeUndefined();
    });

    it('throws 404 for tech-A on delegation B', async () => {
      await expect(
        perm.assertCanReadDelegation(ctx({ userId: seed.users.techA.id }), seed.delegations.b),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 404 for tech-A on null with allowGlobal=false (default)', async () => {
      await expect(
        perm.assertCanReadDelegation(ctx({ userId: seed.users.techA.id }), null),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('passes for tech-A on null with allowGlobal=true (Contact-style global)', async () => {
      await expect(
        perm.assertCanReadDelegation(ctx({ userId: seed.users.techA.id }), null, { allowGlobal: true }),
      ).resolves.toBeUndefined();
    });

    it('bypasses for super admin on null without flag', async () => {
      await expect(
        perm.assertCanReadDelegation(ctx({ userId: seed.users.admin.id, isSuperAdmin: true }), null),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────── assertCanWriteDelegation ───────────────
  describe('assertCanWriteDelegation', () => {
    it('passes for manager-A (MANAGE) on delegation A', async () => {
      await expect(
        perm.assertCanWriteDelegation(ctx({ userId: seed.users.managerA.id }), seed.delegations.a),
      ).resolves.toBeUndefined();
    });

    it('passes for tech-A (WRITE) on delegation A', async () => {
      await expect(
        perm.assertCanWriteDelegation(ctx({ userId: seed.users.techA.id }), seed.delegations.a),
      ).resolves.toBeUndefined();
    });

    it('throws 403 for viewer-A (READ only) on delegation A', async () => {
      await expect(
        perm.assertCanWriteDelegation(ctx({ userId: seed.users.viewerA.id }), seed.delegations.a),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws 403 for non-super-admin on null (global write reserved)', async () => {
      await expect(
        perm.assertCanWriteDelegation(ctx({ userId: seed.users.managerA.id }), null),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('passes for super admin on null', async () => {
      await expect(
        perm.assertCanWriteDelegation(ctx({ userId: seed.users.admin.id, isSuperAdmin: true }), null),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────── SYSTEM_CTX factory ───────────────
  describe('SYSTEM_CTX factory', () => {
    it('returns isSuperAdmin=true and tags systemReason', () => {
      const ctx = SYSTEM_CTX('test-canary', seed.tenantId);
      expect(ctx.isSuperAdmin).toBe(true);
      expect(ctx.systemReason).toBe('test-canary');
      expect(ctx.tenantId).toBe(seed.tenantId);
      expect(ctx.userId).toBe('system');
    });

    it('throws when called without reason', () => {
      expect(() => SYSTEM_CTX('', seed.tenantId)).toThrow(/reason and tenantId/);
    });

    it('throws when called without tenantId', () => {
      expect(() => SYSTEM_CTX('test', '')).toThrow(/reason and tenantId/);
    });
  });
});
