import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GrantSiteAccessDto, BulkGrantSiteAccessDto, UpdateSiteAccessDto, SiteAccessLevel, ResourcePermissions, ResourcePermissionLevel } from './dto/grant-site-access.dto';

@Injectable()
export class SiteAccessService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Grant access to a user for a specific site
   */
  async grantAccess(tenantId: string, dto: GrantSiteAccessDto, grantedBy: string) {
    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify site belongs to tenant
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
    }

    // Upsert: create or update access
    const access = await this.prisma.userSiteAccess.upsert({
      where: {
        userId_siteId: {
          userId: dto.userId,
          siteId: dto.siteId,
        },
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

    return access;
  }

  /**
   * Bulk grant access to multiple users for a site
   */
  async bulkGrantAccess(tenantId: string, dto: BulkGrantSiteAccessDto, grantedBy: string) {
    // Verify site belongs to tenant
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
    }

    // Verify all users belong to tenant
    const users = await this.prisma.user.findMany({
      where: { id: { in: dto.userIds }, tenantId },
      select: { id: true },
    });
    const validUserIds = users.map((u) => u.id);

    const results = [];
    for (const userId of validUserIds) {
      const access = await this.prisma.userSiteAccess.upsert({
        where: {
          userId_siteId: { userId, siteId: dto.siteId },
        },
        update: {
          accessLevel: dto.accessLevel || 'READ',
          grantedBy,
          grantedAt: new Date(),
        },
        create: {
          tenantId,
          userId,
          siteId: dto.siteId,
          accessLevel: dto.accessLevel || 'READ',
          grantedBy,
        },
      });
      results.push(access);
    }

    return { granted: results.length, skipped: dto.userIds.length - validUserIds.length };
  }

  /**
   * Update access level for a specific user-site combination
   */
  async updateAccess(tenantId: string, accessId: string, dto: UpdateSiteAccessDto) {
    const access = await this.prisma.userSiteAccess.findFirst({
      where: { id: accessId, tenantId },
    });

    if (!access) {
      throw new NotFoundException('Site access record not found');
    }

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

  /**
   * Revoke access for a user to a site
   */
  async revokeAccess(tenantId: string, accessId: string) {
    const access = await this.prisma.userSiteAccess.findFirst({
      where: { id: accessId, tenantId },
    });

    if (!access) {
      throw new NotFoundException('Site access record not found');
    }

    await this.prisma.userSiteAccess.delete({
      where: { id: accessId },
    });

    return { message: 'Access revoked successfully' };
  }

  /**
   * List all access records for a site
   */
  async listBySite(tenantId: string, siteId: string) {
    return this.prisma.userSiteAccess.findMany({
      where: { tenantId, siteId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * List all site access for a user
   */
  async listByUser(tenantId: string, userId: string) {
    return this.prisma.userSiteAccess.findMany({
      where: { tenantId, userId },
      include: {
        site: { select: { id: true, name: true, code: true, status: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * Check if a user has access to a specific site
   * ADMIN and MANAGER always have access to all sites
   * TECHNICIEN and VIEWER need explicit access
   */
  async checkAccess(tenantId: string, userId: string, siteId: string, requiredLevel?: SiteAccessLevel): Promise<boolean> {
    // Get user role
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });

    if (!user) return false;

    // ADMIN and MANAGER have full access to all sites
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return true;
    }

    // Check explicit access
    const access = await this.prisma.userSiteAccess.findUnique({
      where: {
        userId_siteId: { userId, siteId },
      },
    });

    if (!access) return false;

    // If a specific level is required, check it
    if (requiredLevel === SiteAccessLevel.WRITE) {
      return access.accessLevel === 'WRITE';
    }

    // READ is satisfied by both READ and WRITE
    return true;
  }

  /**
   * Get accessible site IDs for a user (for filtering queries)
   * Returns null if user has access to ALL sites (ADMIN/MANAGER)
   */
  async getAccessibleSiteIds(tenantId: string, userId: string): Promise<string[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });

    if (!user) return [];

    // ADMIN and MANAGER see all sites
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return null; // null = all sites accessible
    }

    // Get explicit access entries
    const access = await this.prisma.userSiteAccess.findMany({
      where: { tenantId, userId },
      select: { siteId: true },
    });

    return access.map((a: { siteId: string }) => a.siteId);
  }

  /**
   * Get the effective permission level for a user on a specific resource within a site.
   * Resolution order:
   * 1. ADMIN/MANAGER → always WRITE
   * 2. If resourcePermissions[resource] is set → use it
   * 3. Fallback → accessLevel (READ/WRITE mapped to ResourcePermissionLevel)
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

    // ADMIN/MANAGER always have full WRITE access
    if (user.role === 'ADMIN' || user.role === 'MANAGER') {
      return ResourcePermissionLevel.WRITE;
    }

    // Get explicit access record
    const access = await this.prisma.userSiteAccess.findUnique({
      where: { userId_siteId: { userId, siteId } },
    });

    if (!access) return ResourcePermissionLevel.NONE;

    // Check resourcePermissions if set
    const resourcePerms = access.resourcePermissions as ResourcePermissions | null;
    if (resourcePerms && resource in resourcePerms) {
      return (resourcePerms as any)[resource] || ResourcePermissionLevel.NONE;
    }

    // Fallback to global accessLevel
    return access.accessLevel === 'WRITE'
      ? ResourcePermissionLevel.WRITE
      : ResourcePermissionLevel.READ;
  }
}
