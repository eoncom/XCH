import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';

@Injectable()
export class UserDelegationsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add a user to a delegation with a local role.
   */
  async addUserToDelegation(
    tenantId: string,
    userId: string,
    delegationId: string,
    role: UserRole,
    grantedBy?: string,
  ) {
    // Verify delegation exists in tenant
    const delegation = await this.prisma.delegation.findFirst({
      where: { id: delegationId, tenantId },
    });
    if (!delegation) {
      throw new NotFoundException(`Delegation ${delegationId} not found`);
    }

    // Verify user exists in tenant
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Check for duplicate
    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (existing) {
      throw new ConflictException('User already has access to this delegation');
    }

    return this.prisma.userDelegation.create({
      data: {
        tenantId,
        userId,
        delegationId,
        role,
        grantedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        delegation: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Remove a user from a delegation (R6 — local deletion).
   * Super admins cannot be removed from any delegation.
   */
  async removeUserFromDelegation(userId: string, delegationId: string) {
    // Check if target user is super admin — cannot remove from delegation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) {
      throw new ForbiddenException('Impossible de retirer un super administrateur d\'une délégation — accès ADMIN sur toutes les délégations');
    }

    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (!existing) {
      throw new NotFoundException('User delegation not found');
    }

    return this.prisma.userDelegation.delete({
      where: { userId_delegationId: { userId, delegationId } },
    });
  }

  /**
   * Get all delegations a user belongs to.
   */
  async getUserDelegations(userId: string, tenantId: string) {
    return this.prisma.userDelegation.findMany({
      where: { userId, tenantId },
      include: {
        delegation: {
          select: {
            id: true,
            name: true,
            code: true,
            groupLabel: true,
            groupColor: true,
            isActive: true,
          },
        },
      },
      orderBy: { grantedAt: 'asc' },
    });
  }

  /**
   * Get all users in a specific delegation.
   */
  async findByDelegation(delegationId: string, tenantId: string) {
    return this.prisma.userDelegation.findMany({
      where: { delegationId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { grantedAt: 'asc' },
    });
  }

  /**
   * Change a user's local role within a delegation.
   * Super admins are always ADMIN — their role cannot be changed.
   */
  async setRole(userId: string, delegationId: string, newRole: UserRole) {
    // Check if target user is super admin — cannot change their role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) {
      throw new ForbiddenException('Impossible de modifier le rôle d\'un super administrateur — toujours ADMIN sur toutes les délégations');
    }

    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (!existing) {
      throw new NotFoundException('User delegation not found');
    }

    return this.prisma.userDelegation.update({
      where: { userId_delegationId: { userId, delegationId } },
      data: { role: newRole },
      include: {
        user: { select: { id: true, name: true, email: true } },
        delegation: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Get current user's delegations (for delegation switcher).
   */
  async getMyDelegations(userId: string, tenantId: string) {
    return this.prisma.userDelegation.findMany({
      where: { userId, tenantId },
      include: {
        delegation: {
          select: {
            id: true,
            name: true,
            code: true,
            groupLabel: true,
            groupColor: true,
            isActive: true,
          },
        },
      },
      orderBy: { delegation: { name: 'asc' } },
    });
  }
}
