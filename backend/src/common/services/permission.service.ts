import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, PermissionLevel, OverrideEffect } from '@prisma/client';
import { Resource } from '../constants/resources';

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
}
