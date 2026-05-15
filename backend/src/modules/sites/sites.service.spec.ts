import { NotFoundException } from '@nestjs/common';
import { SitesService } from './sites.service';

/**
 * Track E.1 BOLA regression guard — sites.service.update().
 *
 * Before Track E.1 (v2.3.1 baseline), `update()` fetched the pre-image via
 * `findUnique({ where: { id } })` with no tenant scope. The guard
 * `assertCanWriteSite` has a super-admin bypass, so a super-admin in
 * tenantA who knew tenantB's site id could mutate tenantB's row and the
 * subsequent `update({ where: { id } })` would silently succeed, leaving
 * the audit log written under tenantA's tenantId (incorrect attribution).
 *
 * Track E.1 fix scopes the lookup by `tenantId` via `findFirst` and throws
 * `NotFoundException` (not 403) to avoid existence-leak, mirroring the
 * v2.3.1 `restoreFullBackupV2` pattern.
 *
 * See XCH_BOLA_PATTERN_CHECK + XCH_TRACK_E1_SECURITY_AUDIT_2026_05_15.
 */
describe('SitesService.update() BOLA tenant scoping (Track E.1)', () => {
  function buildService(prismaStub: Record<string, unknown>) {
    const perm = { assertCanWriteSite: jest.fn() } as never;
    const auditLogService = {
      log: jest.fn(),
      diffChanges: jest.fn().mockReturnValue(null),
    } as never;
    const storageService = {} as never;
    const notificationEmitter = {} as never;
    const monitorReactions = {} as never;
    return new SitesService(
      prismaStub as never,
      storageService,
      auditLogService,
      notificationEmitter,
      monitorReactions,
      perm,
    );
  }

  it('throws NotFoundException when siteId belongs to another tenant (no info leak)', async () => {
    // Prisma stub: findFirst returns null because the row exists under a
    // different tenantId — the `where: { id, tenantId }` clause filters it
    // out, indistinguishable from a row that doesn't exist.
    const findFirst = jest.fn().mockResolvedValue(null);
    const update = jest.fn();
    const prismaStub: Record<string, unknown> = {
      site: { findFirst, update },
    };
    const service = buildService(prismaStub);

    await expect(
      service.update(
        'site-foreign-tenant',
        'tnt-caller',
        { name: 'attacker rename' } as never,
        'u-admin',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Sanity: lookup MUST go through findFirst with both id AND tenantId.
    expect(findFirst).toHaveBeenCalledTimes(1);
    const [args] = findFirst.mock.calls[0];
    expect(args.where).toMatchObject({
      id: 'site-foreign-tenant',
      tenantId: 'tnt-caller',
    });
    // And the prisma.update call MUST NOT have been reached.
    expect(update).not.toHaveBeenCalled();
  });
});
