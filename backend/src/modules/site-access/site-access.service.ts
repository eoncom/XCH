import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SiteAccessLevel, ResourcePermissions, ResourcePermissionLevel } from './dto/grant-site-access.dto';

/**
 * Permission resolution using UserDelegation + AccessGrant.
 *
 * 2 sources combined by MAX:
 * - UserDelegation: local role applies fully on delegation's sites
 * - AccessGrant: ADDITIVE partial permissions (only listed resourcePermissions)
 */

const PERM_ORDER: Record<string, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
};

function maxPerm(a: ResourcePermissionLevel, b: ResourcePermissionLevel): ResourcePermissionLevel {
  return PERM_ORDER[a] >= PERM_ORDER[b] ? a : b;
}

/**
 * Map role to default permission level for a resource.
 * ADMIN → WRITE on everything
 * MANAGER → WRITE on tasks/contacts, READ on the rest
 * TECHNICIEN → WRITE on assets/racks/tasks/floorPlans, READ on the rest
 * VIEWER → READ on everything
 */
function roleToPermission(role: string, resource: string): ResourcePermissionLevel {
  switch (role) {
    case 'ADMIN':
      return ResourcePermissionLevel.WRITE;

    case 'MANAGER': {
      const managerWrite = ['tasks', 'contacts'];
      return managerWrite.includes(resource)
        ? ResourcePermissionLevel.WRITE
        : ResourcePermissionLevel.READ;
    }

    case 'TECHNICIEN': {
      const techWrite = ['assets', 'racks', 'tasks', 'floorPlans'];
      return techWrite.includes(resource)
        ? ResourcePermissionLevel.WRITE
        : ResourcePermissionLevel.READ;
    }

    case 'VIEWER':
      return ResourcePermissionLevel.READ;

    default:
      return ResourcePermissionLevel.NONE;
  }
}

@Injectable()
export class SiteAccessService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // CORE PERMISSION RESOLUTION (UserDelegation + AccessGrant)
  // ==========================================================================

  /**
   * Resolve site IDs covered by an AccessGrant scope
   */
  private async resolveGrantScopeToSiteIds(tenantId: string, scope: string, scopeId: string | null): Promise<string[] | null> {
    switch (scope) {
      case 'ALL_SITES':
        return null; // all sites

      case 'DELEGATION': {
        const sites = await this.prisma.site.findMany({
          where: { tenantId, delegationId: scopeId! },
          select: { id: true },
        });
        return sites.map(s => s.id);
      }

      case 'SITE':
        return [scopeId!];

      default:
        return [];
    }
  }

  /**
   * Check if a specific site is covered by an AccessGrant scope
   */
  private async isSiteCoveredByGrantScope(tenantId: string, scope: string, scopeId: string | null, siteId: string): Promise<boolean> {
    switch (scope) {
      case 'ALL_SITES':
        return true;

      case 'DELEGATION': {
        const site = await this.prisma.site.findFirst({
          where: { id: siteId, tenantId, delegationId: scopeId! },
        });
        return !!site;
      }

      case 'SITE':
        return scopeId === siteId;

      default:
        return false;
    }
  }

  /**
   * Get accessible site IDs for a user (for filtering queries).
   * Returns null if user has access to ALL sites (super admin).
   *
   * Uses UserDelegation + AccessGrant.
   */
  async getAccessibleSiteIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return [];

    // Super admin sees all sites
    if (user.isSuperAdmin) return null;

    // Load user delegations
    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId },
      select: { delegationId: true },
    });

    // Load non-expired access grants
    const grants = await this.prisma.accessGrant.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    // If no delegations and no grants → no access
    if (delegations.length === 0 && grants.length === 0) return [];

    // Resolve delegations to site IDs
    const delegationIds = delegations.map(d => d.delegationId);
    const sites = await this.prisma.site.findMany({
      where: { tenantId, delegationId: { in: delegationIds } },
      select: { id: true },
    });
    const allSiteIds = new Set<string>(sites.map(s => s.id));

    // Resolve grants to site IDs
    for (const grant of grants) {
      const ids = await this.resolveGrantScopeToSiteIds(tenantId, grant.scope, grant.scopeId);
      if (ids === null) return null; // ALL_SITES grant → all sites
      ids.forEach(id => allSiteIds.add(id));
    }

    return Array.from(allSiteIds);
  }

  /**
   * Get accessible site IDs filtered by per-resource permissions.
   */
  async getAccessibleSiteIdsForResource(
    tenantId: string,
    userId: string,
    resource: string,
  ): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return [];

    if (user.isSuperAdmin) return null;

    // Load user delegations with roles
    const delegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId },
      select: { delegationId: true, role: true },
    });

    // Load non-expired access grants
    const grants = await this.prisma.accessGrant.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (delegations.length === 0 && grants.length === 0) return [];

    const allSiteIds = new Set<string>();

    // Delegations: check if local role grants access on this resource
    for (const del of delegations) {
      const roleLevel = roleToPermission(del.role, resource);
      if (roleLevel !== ResourcePermissionLevel.NONE) {
        const sites = await this.prisma.site.findMany({
          where: { tenantId, delegationId: del.delegationId },
          select: { id: true },
        });
        sites.forEach(s => allSiteIds.add(s.id));
      }
    }

    // Grants: only if the grant includes this resource with a non-NONE level
    for (const grant of grants) {
      const grantPerms = grant.resourcePermissions as ResourcePermissions | null;
      if (grantPerms && resource in grantPerms) {
        const level = (grantPerms as any)[resource];
        if (level && level !== ResourcePermissionLevel.NONE) {
          const ids = await this.resolveGrantScopeToSiteIds(tenantId, grant.scope, grant.scopeId);
          if (ids === null) return null;
          ids.forEach(id => allSiteIds.add(id));
        }
      }
    }

    return Array.from(allSiteIds);
  }

  /**
   * Get the effective permission level for a user on a specific resource within a site.
   *
   * Resolution (MAX of 2 sources):
   * 1. UserDelegation: if site belongs to user's delegation → local role permission
   * 2. AccessGrants: if site is covered AND resource is listed → grant's permission level
   */
  async getResourcePermission(
    tenantId: string,
    userId: string,
    siteId: string,
    resource: string,
  ): Promise<ResourcePermissionLevel> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return ResourcePermissionLevel.NONE;

    // Super admin gets WRITE on everything
    if (user.isSuperAdmin) return ResourcePermissionLevel.WRITE;

    let maxLevel = ResourcePermissionLevel.NONE;

    // SOURCE 1: UserDelegation (local role applies on delegation's sites)
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { delegationId: true },
    });

    if (site?.delegationId) {
      const userDelegation = await this.prisma.userDelegation.findUnique({
        where: { userId_delegationId: { userId, delegationId: site.delegationId } },
      });
      if (userDelegation) {
        const roleLevel = roleToPermission(userDelegation.role, resource);
        maxLevel = maxPerm(maxLevel, roleLevel);
      }
    }

    // SOURCE 2: AccessGrants (additive, partial permissions only)
    const grants = await this.prisma.accessGrant.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    for (const grant of grants) {
      const grantPerms = grant.resourcePermissions as ResourcePermissions | null;
      if (!grantPerms || !(resource in grantPerms)) continue;

      const grantLevel = (grantPerms as any)[resource] as ResourcePermissionLevel;
      if (!grantLevel || grantLevel === ResourcePermissionLevel.NONE) continue;

      const covered = await this.isSiteCoveredByGrantScope(tenantId, grant.scope, grant.scopeId, siteId);
      if (covered) {
        maxLevel = maxPerm(maxLevel, grantLevel);
      }
    }

    return maxLevel;
  }

  /**
   * Check if a user has access to a specific site.
   */
  async checkAccess(tenantId: string, userId: string, siteId: string, requiredLevel?: SiteAccessLevel): Promise<boolean> {
    const perm = await this.getResourcePermission(tenantId, userId, siteId, 'sites');

    if (requiredLevel === SiteAccessLevel.WRITE) {
      return perm === ResourcePermissionLevel.WRITE;
    }

    return perm !== ResourcePermissionLevel.NONE;
  }

  /**
   * Get user IDs that are visible to a requesting user.
   * Users are visible if they share at least one delegation.
   * Returns null if the requesting user is super admin (sees all).
   */
  async getVisibleUserIds(tenantId: string, requestingUserId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: requestingUserId, tenantId },
      select: { isSuperAdmin: true },
    });
    if (!user) return [requestingUserId];

    // Super admin sees all users
    if (user.isSuperAdmin) return null;

    // Get requesting user's delegations
    const myDelegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId: requestingUserId },
      select: { delegationId: true },
    });

    if (myDelegations.length === 0) return [requestingUserId];

    const myDelegationIds = myDelegations.map(d => d.delegationId);

    // Find all users who share at least one delegation
    const sharedDelegationUsers = await this.prisma.userDelegation.findMany({
      where: {
        tenantId,
        delegationId: { in: myDelegationIds },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const visibleUserIds = new Set<string>(sharedDelegationUsers.map(u => u.userId));
    visibleUserIds.add(requestingUserId);

    // Also include super admins (they're visible to everyone)
    const superAdmins = await this.prisma.user.findMany({
      where: { tenantId, isSuperAdmin: true },
      select: { id: true },
    });
    superAdmins.forEach(sa => visibleUserIds.add(sa.id));

    return Array.from(visibleUserIds);
  }
}
