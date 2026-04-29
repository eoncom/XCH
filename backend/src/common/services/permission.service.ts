import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, PermissionLevel, OverrideEffect } from '@prisma/client';
import { Resource } from '../constants/resources';
import { CallerCtx } from '../types/caller-ctx.interface';

/**
 * Effective permission returned by resolve().
 * null = no access.
 */
export type EffectivePermission = 'WRITE' | 'READ' | null;

/**
 * Right hierarchy: MANAGE > WRITE > READ.
 * MANAGE includes WRITE for resolution purposes.
 */
const RIGHT_RANK: Record<string, number> = {
  MANAGE: 3,
  WRITE: 2,
  READ: 1,
};

/**
 * Check if a right satisfies a minimum requirement.
 * e.g. MANAGE satisfies WRITE, WRITE satisfies READ.
 */
export function rightSatisfies(actual: string, required: string): boolean {
  return (RIGHT_RANK[actual] ?? 0) >= (RIGHT_RANK[required] ?? 0);
}

/**
 * Central permission resolution service.
 *
 * Implements the 6-step algorithm:
 *   0. isSuperAdmin → WRITE (bypass)
 *   1. DENY on specific resource → refuse
 *   2. ALLOW on specific resource → return permission
 *   3. DENY on site ("*") → refuse
 *   4. ALLOW on site ("*") → return permission
 *   5. Delegation inheritance → return mapped right
 *   6. No access → null
 *
 * This service is the SINGLE source of truth for site+resource permissions.
 * The frontend caches results for UX but never decides.
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private prisma: PrismaClient) {}

  /**
   * Resolve effective permission for a user on a site+resource.
   *
   * @param userId - user ID
   * @param siteId - target site ID
   * @param resource - resource key (e.g. "tasks", "racks") or "*" for whole site
   * @param tenantId - tenant ID
   * @returns EffectivePermission: 'WRITE' | 'READ' | null
   */
  async resolve(
    userId: string,
    siteId: string,
    resource: Resource,
    tenantId: string,
  ): Promise<EffectivePermission> {
    // STEP 0 — Super admin bypass
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return null;
    if (user.isSuperAdmin) return 'WRITE';

    // Load all non-expired overrides for this user+site in one query
    const overrides = await this.prisma.accessOverride.findMany({
      where: {
        tenantId,
        userId,
        siteId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    // Index overrides by resource for O(1) lookup
    const byResource = new Map<string, typeof overrides[0]>();
    for (const o of overrides) {
      byResource.set(o.resource, o);
    }

    // If querying a specific resource (not "*"), check resource-level overrides first
    if (resource !== '*') {
      const resourceOverride = byResource.get(resource);
      if (resourceOverride) {
        // STEP 1 — DENY on specific resource
        if (resourceOverride.effect === OverrideEffect.DENY) {
          return null;
        }
        // STEP 2 — ALLOW on specific resource
        if (resourceOverride.effect === OverrideEffect.ALLOW && resourceOverride.permission) {
          return resourceOverride.permission as EffectivePermission;
        }
      }
    }

    // STEP 3 — DENY on site ("*")
    const siteOverride = byResource.get('*');
    if (siteOverride && siteOverride.effect === OverrideEffect.DENY) {
      return null;
    }

    // STEP 4 — ALLOW on site ("*")
    if (siteOverride && siteOverride.effect === OverrideEffect.ALLOW && siteOverride.permission) {
      return siteOverride.permission as EffectivePermission;
    }

    // STEP 5 — Delegation inheritance
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { delegationId: true },
    });

    if (site?.delegationId) {
      const userDelegation = await this.prisma.userDelegation.findUnique({
        where: {
          userId_delegationId: { userId, delegationId: site.delegationId },
        },
        select: { right: true },
      });

      if (userDelegation) {
        // MANAGE and WRITE → WRITE, READ → READ
        return userDelegation.right === 'READ' ? 'READ' : 'WRITE';
      }
    }

    // STEP 6 — No access
    return null;
  }

  /**
   * Resolve permissions for all accessible sites of a user.
   * Returns a map of siteId → EffectivePermission.
   * Used by GET /auth/me to pre-resolve all rights for frontend cache.
   */
  async resolveAllSites(
    userId: string,
    tenantId: string,
  ): Promise<Map<string, EffectivePermission>> {
    const result = new Map<string, EffectivePermission>();

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return result;

    // Super admin → all sites with WRITE
    if (user.isSuperAdmin) {
      const allSites = await this.prisma.site.findMany({
        where: { tenantId },
        select: { id: true },
      });
      for (const site of allSites) {
        result.set(site.id, 'WRITE');
      }
      return result;
    }

    // Get sites from delegations
    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId },
      select: { delegationId: true, right: true },
    });

    for (const del of delegations) {
      const sites = await this.prisma.site.findMany({
        where: { tenantId, delegationId: del.delegationId },
        select: { id: true },
      });
      const perm: EffectivePermission = del.right === 'READ' ? 'READ' : 'WRITE';
      for (const site of sites) {
        result.set(site.id, perm);
      }
    }

    // Apply overrides (ALLOW adds sites, DENY removes or downgrades)
    const overrides = await this.prisma.accessOverride.findMany({
      where: {
        tenantId,
        userId,
        resource: '*', // site-level overrides only for this summary
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    for (const o of overrides) {
      if (o.effect === OverrideEffect.DENY) {
        result.delete(o.siteId);
      } else if (o.effect === OverrideEffect.ALLOW && o.permission) {
        result.set(o.siteId, o.permission as EffectivePermission);
      }
    }

    return result;
  }

  /**
   * Get all site IDs accessible to a user.
   * Returns null if super admin (= all sites).
   */
  async getAccessibleSiteIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return [];
    if (user.isSuperAdmin) return null;

    const resolved = await this.resolveAllSites(userId, tenantId);
    return Array.from(resolved.keys());
  }

  /**
   * Get all delegation IDs a user has MANAGE on.
   * Returns null if super admin (= all delegations visible).
   * Returns [] if the user has no MANAGE anywhere — denies everything.
   *
   * Used by the cost module to restrict expense / budget / billing-entity
   * visibility to a manager's own delegations, never leak cross-delegation.
   */
  async getManagedDelegationIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return [];
    if (user.isSuperAdmin) return null;

    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId, right: 'MANAGE' },
      select: { delegationId: true },
    });
    return delegations.map((d) => d.delegationId);
  }

  // ============================================================================
  // ADR-021 — uniform CallerCtx-based helpers used by every service for
  // row-level filtering. Throw 404 on read denial (defense in depth — don't
  // reveal an id we shouldn't see), 403 on write denial (the user knew the
  // resource via a legitimate window).
  // ============================================================================

  /**
   * Site IDs the user can read (READ/WRITE/MANAGE through delegation, or
   * granted via AccessOverride). null = super admin (all sites).
   *
   * Wrapper around `resolveAllSites` for the canonical name pattern of
   * ADR-021. The underlying algorithm is unchanged.
   */
  async getReadableSiteIds(callerCtx: CallerCtx): Promise<string[] | null> {
    if (callerCtx.isSuperAdmin) return null;
    const resolved = await this.resolveAllSites(callerCtx.userId, callerCtx.tenantId);
    return Array.from(resolved.keys());
  }

  /**
   * Delegation IDs the user has any role on (READ + WRITE + MANAGE union).
   * Complement of `getManagedDelegationIds` which is MANAGE-only and reserved
   * for the cost module. Use this one for everything else (Contact, etc.).
   *
   * Returns null for super admin, [] for users with no UserDelegation.
   */
  async getReadableDelegationIds(callerCtx: CallerCtx): Promise<string[] | null> {
    if (callerCtx.isSuperAdmin) return null;
    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId: callerCtx.tenantId, userId: callerCtx.userId },
      select: { delegationId: true },
    });
    return delegations.map((d) => d.delegationId);
  }

  /**
   * Throw 404 NotFoundException if the user can't read the given site.
   * Super admin bypass.
   */
  async assertCanReadSite(callerCtx: CallerCtx, siteId: string): Promise<void> {
    if (callerCtx.isSuperAdmin) return;
    const readable = await this.getReadableSiteIds(callerCtx);
    if (readable !== null && !readable.includes(siteId)) {
      throw new NotFoundException();
    }
  }

  /**
   * Throw 403 ForbiddenException if the user can't write the given site.
   * Walks the full `resolve()` algorithm so AccessOverride DENY at resource
   * level is honoured. Super admin bypass.
   */
  async assertCanWriteSite(callerCtx: CallerCtx, siteId: string, resource: Resource = '*'): Promise<void> {
    if (callerCtx.isSuperAdmin) return;
    const perm = await this.resolve(callerCtx.userId, siteId, resource, callerCtx.tenantId);
    if (perm !== 'WRITE') {
      throw new ForbiddenException();
    }
  }

  /**
   * Throw 404 NotFoundException if the user can't read the given delegation.
   *
   * `allowGlobal` controls how `delegationId === null` is interpreted :
   *   - true  : null = "shared/global, readable by everyone" (Contact, Expense
   *             per schema annotation, TenantSecurityReminder).
   *   - false : null = "tenant-wide super-admin only" (NotificationChannel,
   *             NotificationRule).
   * Default `false` is the safer choice — explicit opt-in for sharing.
   */
  async assertCanReadDelegation(
    callerCtx: CallerCtx,
    delegationId: string | null,
    options: { allowGlobal?: boolean } = {},
  ): Promise<void> {
    if (callerCtx.isSuperAdmin) return;
    if (delegationId === null) {
      if (options.allowGlobal) return;
      throw new NotFoundException();
    }
    const readable = await this.getReadableDelegationIds(callerCtx);
    if (readable !== null && !readable.includes(delegationId)) {
      throw new NotFoundException();
    }
  }

  /**
   * Throw 403 ForbiddenException if the user can't write the given delegation.
   * "Write" here = the user has WRITE or MANAGE through UserDelegation.
   * Super admin bypass. Globals (`null`) are super-admin only.
   */
  async assertCanWriteDelegation(
    callerCtx: CallerCtx,
    delegationId: string | null,
  ): Promise<void> {
    if (callerCtx.isSuperAdmin) return;
    if (delegationId === null) {
      throw new ForbiddenException();
    }
    const userDelegation = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId: callerCtx.userId, delegationId } },
      select: { right: true },
    });
    if (!userDelegation || userDelegation.right === 'READ') {
      throw new ForbiddenException();
    }
  }
}
