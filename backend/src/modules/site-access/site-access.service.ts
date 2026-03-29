import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GrantSiteAccessDto, BulkGrantSiteAccessDto, UpdateSiteAccessDto, SiteAccessLevel, ResourcePermissions, ResourcePermissionLevel } from './dto/grant-site-access.dto';

/**
 * Permission resolution using UserScope + AccessGrant (Phase B).
 *
 * UserSiteAccess is DEPRECATED and NOT used in resolution.
 *
 * 2 sources combined by MAX:
 * - UserScope: role applies fully on covered sites
 * - AccessGrant: ADDITIVE partial permissions (only listed resourcePermissions)
 */

// Numeric ordering for permission levels (for MAX comparison)
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
      const managerWrite = ['tasks', 'contacts', 'floorPlans'];
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
  // CORE PERMISSION RESOLUTION (UserScope + AccessGrant)
  // ==========================================================================

  /**
   * Resolve site IDs covered by a single UserScope
   */
  private async resolveScopeSiteIds(tenantId: string, scopeType: string, scopeId: string | null): Promise<string[] | null> {
    switch (scopeType) {
      case 'TENANT':
        return null; // all sites

      case 'DIVISION': {
        const sites = await this.prisma.site.findMany({
          where: {
            tenantId,
            delegation: { divisionId: scopeId! },
          },
          select: { id: true },
        });
        return sites.map(s => s.id);
      }

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
   * Check if a specific site is covered by a scope
   */
  private async isSiteCoveredByScope(tenantId: string, scopeType: string, scopeId: string | null, siteId: string): Promise<boolean> {
    switch (scopeType) {
      case 'TENANT':
        return true;

      case 'DIVISION': {
        const site = await this.prisma.site.findFirst({
          where: {
            id: siteId,
            tenantId,
            delegation: { divisionId: scopeId! },
          },
        });
        return !!site;
      }

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
   * Returns null if user has access to ALL sites.
   *
   * Uses UserScope + AccessGrant ONLY (no UserSiteAccess).
   */
  async getAccessibleSiteIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user) return [];

    // Load user scopes
    const scopes = await this.prisma.userScope.findMany({
      where: { tenantId, userId },
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

    // If no scopes and no grants → no access
    if (scopes.length === 0 && grants.length === 0) return [];

    // Resolve scopes to site IDs
    const allSiteIds = new Set<string>();
    for (const scope of scopes) {
      const ids = await this.resolveScopeSiteIds(tenantId, scope.scopeType, scope.scopeId);
      if (ids === null) return null; // TENANT scope → all sites
      ids.forEach(id => allSiteIds.add(id));
    }

    // Resolve grants to site IDs
    for (const grant of grants) {
      const ids = await this.resolveScopeSiteIds(tenantId, grant.scope === 'ALL_SITES' ? 'TENANT' : grant.scope, grant.scopeId);
      if (ids === null) return null; // ALL_SITES grant → all sites
      ids.forEach(id => allSiteIds.add(id));
    }

    return Array.from(allSiteIds);
  }

  /**
   * Get accessible site IDs filtered by per-resource permissions.
   * Uses UserScope + AccessGrant ONLY.
   */
  async getAccessibleSiteIdsForResource(
    tenantId: string,
    userId: string,
    resource: string,
  ): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user) return [];

    // Load user scopes
    const scopes = await this.prisma.userScope.findMany({
      where: { tenantId, userId },
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

    if (scopes.length === 0 && grants.length === 0) return [];

    // Check if role grants any access on this resource
    const roleLevel = roleToPermission(user.role, resource);

    // Scopes: if role has access to resource → include all scope sites
    const allSiteIds = new Set<string>();

    if (roleLevel !== ResourcePermissionLevel.NONE) {
      for (const scope of scopes) {
        const ids = await this.resolveScopeSiteIds(tenantId, scope.scopeType, scope.scopeId);
        if (ids === null) return null; // TENANT → all sites
        ids.forEach(id => allSiteIds.add(id));
      }
    }

    // Grants: only if the grant includes this resource with a non-NONE level
    for (const grant of grants) {
      const grantPerms = grant.resourcePermissions as ResourcePermissions | null;
      if (grantPerms && resource in grantPerms) {
        const level = (grantPerms as any)[resource];
        if (level && level !== ResourcePermissionLevel.NONE) {
          const ids = await this.resolveScopeSiteIds(tenantId, grant.scope === 'ALL_SITES' ? 'TENANT' : grant.scope, grant.scopeId);
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
   * 1. UserScopes: if site is covered → full role permission for this resource
   * 2. AccessGrants: if site is covered AND resource is listed → grant's permission level
   *
   * UserSiteAccess is NOT used.
   */
  async getResourcePermission(
    tenantId: string,
    userId: string,
    siteId: string,
    resource: string,
  ): Promise<ResourcePermissionLevel> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user) return ResourcePermissionLevel.NONE;

    let maxLevel = ResourcePermissionLevel.NONE;

    // SOURCE 1: UserScopes (role applies fully on covered sites)
    const scopes = await this.prisma.userScope.findMany({
      where: { tenantId, userId },
    });

    for (const scope of scopes) {
      const covered = await this.isSiteCoveredByScope(tenantId, scope.scopeType, scope.scopeId, siteId);
      if (covered) {
        const roleLevel = roleToPermission(user.role, resource);
        maxLevel = maxPerm(maxLevel, roleLevel);
        break; // One scope covering = full role, no need to check more
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

      // Check if the site is covered by this grant's scope
      const grantScopeType = grant.scope === 'ALL_SITES' ? 'TENANT' : grant.scope;
      const covered = await this.isSiteCoveredByScope(tenantId, grantScopeType, grant.scopeId, siteId);
      if (covered) {
        maxLevel = maxPerm(maxLevel, grantLevel);
      }
    }

    return maxLevel;
  }

  /**
   * Check if a user has access to a specific site.
   * Uses UserScope + AccessGrant ONLY.
   */
  async checkAccess(tenantId: string, userId: string, siteId: string, requiredLevel?: SiteAccessLevel): Promise<boolean> {
    const perm = await this.getResourcePermission(tenantId, userId, siteId, 'sites');

    if (requiredLevel === SiteAccessLevel.WRITE) {
      return perm === ResourcePermissionLevel.WRITE;
    }

    return perm !== ResourcePermissionLevel.NONE;
  }

  // ==========================================================================
  // LEGACY METHODS (UserSiteAccess CRUD — kept for backward compat)
  // These do NOT affect permission resolution.
  // ==========================================================================

  async grantAccess(tenantId: string, dto: GrantSiteAccessDto, grantedBy: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');

    return this.prisma.userSiteAccess.upsert({
      where: {
        userId_siteId: { userId: dto.userId, siteId: dto.siteId },
      },
      update: {
        accessLevel: dto.accessLevel || 'READ',
        ...(dto.resourcePermissions !== undefined && { resourcePermissions: dto.resourcePermissions as any }),
        grantedBy,
        grantedAt: new Date(),
      },
      create: {
        tenantId,
        userId: dto.userId,
        siteId: dto.siteId,
        accessLevel: dto.accessLevel || 'READ',
        ...(dto.resourcePermissions !== undefined && { resourcePermissions: dto.resourcePermissions as any }),
        grantedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async bulkGrantAccess(tenantId: string, dto: BulkGrantSiteAccessDto, grantedBy: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');

    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, tenantId },
      select: { id: true },
    });
    const validUserIds = users.map((u) => u.id);

    const results = [];
    for (const userId of validUserIds) {
      const access = await this.prisma.userSiteAccess.upsert({
        where: { userId_siteId: { userId, siteId: dto.siteId } },
        update: { accessLevel: dto.accessLevel || 'READ', grantedBy, grantedAt: new Date() },
        create: { tenantId, userId, siteId: dto.siteId, accessLevel: dto.accessLevel || 'READ', grantedBy },
      });
      results.push(access);
    }

    return { granted: results.length, skipped: dto.userIds.length - validUserIds.length };
  }

  async updateAccess(tenantId: string, accessId: string, dto: UpdateSiteAccessDto) {
    const access = await this.prisma.userSiteAccess.findFirst({
      where: { id: accessId, tenantId },
    });
    if (!access) throw new NotFoundException('Site access record not found');

    const data: any = {};
    if (dto.accessLevel) data.accessLevel = dto.accessLevel;
    if (dto.resourcePermissions !== undefined) data.resourcePermissions = dto.resourcePermissions;

    return this.prisma.userSiteAccess.update({
      where: { id: accessId },
      data,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async revokeAccess(tenantId: string, accessId: string) {
    const access = await this.prisma.userSiteAccess.findFirst({
      where: { id: accessId, tenantId },
    });
    if (!access) throw new NotFoundException('Site access record not found');

    await this.prisma.userSiteAccess.delete({ where: { id: accessId } });
    return { message: 'Access revoked successfully' };
  }

  async listBySite(tenantId: string, siteId: string) {
    return this.prisma.userSiteAccess.findMany({
      where: { tenantId, siteId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async listByUser(tenantId: string, userId: string) {
    return this.prisma.userSiteAccess.findMany({
      where: { tenantId, userId },
      include: {
        site: { select: { id: true, name: true, code: true, status: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}
