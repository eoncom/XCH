import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';

// Role hierarchy: ADMIN > MANAGER > TECHNICIEN > VIEWER
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 4,
  MANAGER: 3,
  TECHNICIEN: 2,
  VIEWER: 1,
};

@Injectable()
export class UserDelegationsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if the requesting user is authorized to manage roles in a delegation.
   * Must be ADMIN of that delegation OR super admin.
   * Returns the requesting user's info for further checks.
   */
  private async authorizeManagement(requestingUserId: string, delegationId: string, tenantId: string) {
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { isSuperAdmin: true },
    });

    if (requestingUser?.isSuperAdmin) {
      return { isSuperAdmin: true, localRole: 'ADMIN' as UserRole };
    }

    // Check requesting user's role in this delegation
    const requestingDelegation = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId: requestingUserId, delegationId } },
    });

    if (!requestingDelegation || requestingDelegation.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Seul un administrateur de cette délégation peut gérer les accès'
      );
    }

    return { isSuperAdmin: false, localRole: requestingDelegation.role };
  }

  /**
   * Validate that delegation role does not exceed user's global role.
   * Rule: User.role = maximum role allowed on any delegation.
   * ADMIN → all roles, MANAGER → MANAGER/TECH/VIEWER, TECHNICIEN → TECH/VIEWER, VIEWER → VIEWER only.
   * Super admins bypass this check (always ADMIN everywhere).
   */
  private async validateRoleHierarchy(userId: string, delegationRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isSuperAdmin: true, name: true },
    });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    // Super admins bypass
    if (user.isSuperAdmin) return;

    const globalLevel = ROLE_HIERARCHY[user.role] || 0;
    const localLevel = ROLE_HIERARCHY[delegationRole] || 0;

    if (localLevel > globalLevel) {
      const ROLE_LABELS: Record<string, string> = {
        ADMIN: 'Administrateur',
        MANAGER: 'Manager',
        TECHNICIEN: 'Technicien',
        VIEWER: 'Observateur',
      };
      throw new ForbiddenException(
        `Impossible d'attribuer le rôle "${ROLE_LABELS[delegationRole]}" — le compte de ${user.name} est "${ROLE_LABELS[user.role]}". Le rôle par délégation ne peut pas dépasser le rôle du compte.`
      );
    }
  }

  /**
   * Add a user to a delegation with a local role.
   * Authorization: only ADMIN of the delegation or super admin.
   * Constraint: delegation role cannot exceed User.role.
   */
  async addUserToDelegation(
    tenantId: string,
    userId: string,
    delegationId: string,
    role: UserRole,
    grantedBy?: string,
    requestingUserId?: string,
  ) {
    // Authorization check
    if (requestingUserId) {
      await this.authorizeManagement(requestingUserId, delegationId, tenantId);
    }

    // Verify delegation exists in tenant
    const delegation = await this.prisma.delegation.findFirst({
      where: { id: delegationId, tenantId },
    });
    if (!delegation) {
      throw new NotFoundException(`Délégation non trouvée`);
    }

    // Verify user exists in tenant
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé`);
    }

    // Validate: delegation role cannot exceed user's global role
    await this.validateRoleHierarchy(userId, role);

    // Check for duplicate
    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (existing) {
      throw new ConflictException('L\'utilisateur a déjà accès à cette délégation');
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
   * Authorization: only ADMIN of the delegation or super admin.
   * Cannot remove super admin. Cannot remove yourself.
   */
  async removeUserFromDelegation(
    userId: string,
    delegationId: string,
    requestingUserId?: string,
    tenantId?: string,
  ) {
    // Check if target user is super admin — cannot remove from delegation
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (user?.isSuperAdmin) {
      throw new ForbiddenException('Impossible de retirer un super administrateur d\'une délégation');
    }

    // Cannot remove yourself from a delegation
    if (requestingUserId && requestingUserId === userId) {
      throw new ForbiddenException('Vous ne pouvez pas retirer votre propre accès à une délégation');
    }

    // Authorization check
    if (requestingUserId && tenantId) {
      await this.authorizeManagement(requestingUserId, delegationId, tenantId);
    }

    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (!existing) {
      throw new NotFoundException('Accès délégation non trouvé');
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
   * Authorization:
   * - Only ADMIN of the delegation or super admin can change roles
   * - Cannot change your own role
   * - Cannot promote to ADMIN unless you are ADMIN/super admin
   * - Super admins are always ADMIN (immutable)
   */
  async setRole(
    userId: string,
    delegationId: string,
    newRole: UserRole,
    requestingUserId?: string,
    tenantId?: string,
  ) {
    // Check if target user is super admin — cannot change their role
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (targetUser?.isSuperAdmin) {
      throw new ForbiddenException('Impossible de modifier le rôle d\'un super administrateur — toujours ADMIN');
    }

    // Cannot change your own role
    if (requestingUserId && requestingUserId === userId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre rôle');
    }

    // Authorization check
    if (requestingUserId && tenantId) {
      await this.authorizeManagement(requestingUserId, delegationId, tenantId);
    }

    // Validate: delegation role cannot exceed user's global role
    await this.validateRoleHierarchy(userId, newRole);

    const existing = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId, delegationId } },
    });
    if (!existing) {
      throw new NotFoundException('Accès délégation non trouvé');
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
