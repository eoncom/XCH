import { Injectable, Inject, NotFoundException, ConflictException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaClient) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId: createUserDto.tenantId,
        email: createUserDto.email,
      },
    });

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = createUserDto.password
      ? await bcrypt.hash(createUserDto.password, 10)
      : null;

    // Remove password from DTO before creating user
    const { password, tenantId: dtoTenantId, ...userDataWithoutPassword } = createUserDto;

    const userData: any = {
      ...userDataWithoutPassword,
      passwordHash,
    };

    if (dtoTenantId) {
      userData.tenant = { connect: { id: dtoTenantId } };
    }

    const user = await this.prisma.user.create({
      data: userData,
      include: {
        tenant: true,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  /**
   * Get all users.
   * - Super admin (activeDelegationId=null): sees ALL users
   * - Admin local (activeDelegationId set): sees only users in that delegation
   */
  async findAll(tenantId: string, filters: FilterUserDto = {}, activeDelegationId?: string | null) {
    const where: any = { tenantId };

    // Non-super-admin: filter to users in the active delegation only
    if (activeDelegationId) {
      where.userDelegations = {
        some: { delegationId: activeDelegationId },
      };
    }

    // Search filter (name or email)
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Role filter
    if (filters.role) {
      where.role = filters.role;
    }

    // Active filter
    if (filters.active !== undefined) {
      where.active = filters.active;
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const sortField = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          userDelegations: {
            include: {
              delegation: {
                select: {
                  id: true,
                  name: true,
                  groupLabel: true,
                },
              },
            },
          },
        },
        orderBy: {
          [sortField]: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const data = users.map(({ passwordHash, totpSecret, totpBackupCodes, ...user }) => user);
    return buildPaginatedResponse(data, total, page, pageSize);
  }

  /**
   * Get a single user.
   * - activeDelegationId=null → super admin, no scope check
   * - activeDelegationId set → check target user is in that delegation
   */
  async findOne(id: string, tenantId: string, activeDelegationId?: string | null) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Non-super-admin: verify target user is in their active delegation
    if (activeDelegationId) {
      const targetInDelegation = await this.prisma.userDelegation.findUnique({
        where: { userId_delegationId: { userId: id, delegationId: activeDelegationId } },
      });
      if (!targetInDelegation) {
        throw new ForbiddenException('Cet utilisateur ne fait pas partie de votre délégation');
      }
    }

    const { passwordHash, totpSecret, totpBackupCodes, ...result } = user;
    return result;
  }

  /**
   * Update a user.
   * - activeDelegationId=null → super admin, full access
   * - activeDelegationId set → must be ADMIN of that delegation, target must be in it
   */
  async update(
    id: string,
    tenantId: string,
    updateUserDto: UpdateUserDto,
    requestingUserId?: string,
    activeDelegationId?: string | null,
    localRole?: string,
  ) {
    const targetUser = await this.findOne(id, tenantId);

    // Security: check if requesting user is super admin
    let requestingUser = null;
    if (requestingUserId) {
      requestingUser = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { isSuperAdmin: true },
      });
    }
    const isSuperAdmin = requestingUser?.isSuperAdmin === true;

    // Security: never allow modifying isSuperAdmin via API
    const data: any = { ...updateUserDto };
    delete data.isSuperAdmin;

    // Security: protect super admin users from being modified by non-super-admins
    if ((targetUser as any).isSuperAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Seul un super administrateur peut modifier un autre super administrateur');
    }

    // Security: strip role field — User.role is deprecated, cannot be changed via API
    // Role management goes through UserDelegation only
    delete data.role;

    // Non-super-admin: must be ADMIN of active delegation and target must be in it
    if (activeDelegationId) {
      if (localRole !== 'ADMIN') {
        throw new ForbiddenException('Seul un administrateur de la délégation peut modifier les utilisateurs');
      }
      const targetInDelegation = await this.prisma.userDelegation.findUnique({
        where: { userId_delegationId: { userId: id, delegationId: activeDelegationId } },
      });
      if (!targetInDelegation) {
        throw new ForbiddenException('Cet utilisateur ne fait pas partie de votre délégation');
      }
    }

    if (updateUserDto.password) {
      data.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete data.password;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        tenant: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Delete a user.
   * - activeDelegationId=null → super admin, full access
   * - activeDelegationId set → must be ADMIN of that delegation, target must be in it
   */
  async remove(
    id: string,
    tenantId: string,
    requestingUserId?: string,
    activeDelegationId?: string | null,
    localRole?: string,
  ) {
    const targetUser = await this.findOne(id, tenantId);

    // Security: prevent deleting super admin users
    if ((targetUser as any).isSuperAdmin) {
      throw new ForbiddenException('Impossible de supprimer un super administrateur');
    }

    // Security: prevent self-deletion
    if (requestingUserId === id) {
      throw new ForbiddenException('Impossible de supprimer votre propre compte');
    }

    // Non-super-admin: must be ADMIN of active delegation and target must be in it
    if (activeDelegationId) {
      if (localRole !== 'ADMIN') {
        throw new ForbiddenException('Seul un administrateur de la délégation peut supprimer les utilisateurs');
      }
      const targetInDelegation = await this.prisma.userDelegation.findUnique({
        where: { userId_delegationId: { userId: id, delegationId: activeDelegationId } },
      });
      if (!targetInDelegation) {
        throw new ForbiddenException('Cet utilisateur ne fait pas partie de votre délégation');
      }
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async getProfile(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async updateProfile(userId: string, tenantId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if changing email
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: updateProfileDto.email,
          id: { not: userId },
        },
      });

      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateProfileDto,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    const { passwordHash, ...result } = updatedUser;
    return result;
  }

  /**
   * Toggle super admin status for a user.
   * Only callable by an existing super admin.
   * When promoting: auto-creates UserDelegation(ADMIN) on ALL delegations.
   * When demoting: removes auto-created delegations (keeps manually assigned ones with their roles).
   */
  async toggleSuperAdmin(targetUserId: string, tenantId: string, requestingUserId: string, promote: boolean) {
    // Verify requesting user is super admin
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { isSuperAdmin: true },
    });
    if (!requestingUser?.isSuperAdmin) {
      throw new ForbiddenException('Seul un super administrateur peut gérer les super administrateurs');
    }

    // Cannot demote yourself
    if (requestingUserId === targetUserId && !promote) {
      throw new ForbiddenException('Vous ne pouvez pas retirer votre propre statut super administrateur');
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
    });
    if (!targetUser) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (promote && targetUser.isSuperAdmin) {
      throw new BadRequestException('Cet utilisateur est déjà super administrateur');
    }
    if (!promote && !targetUser.isSuperAdmin) {
      throw new BadRequestException("Cet utilisateur n'est pas super administrateur");
    }

    // Update isSuperAdmin flag
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isSuperAdmin: promote,
      },
    });

    // Sync delegations
    if (promote) {
      await this.syncSuperAdminDelegations(targetUserId, tenantId, requestingUserId);
    }

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        tenant: true,
        userDelegations: {
          include: { delegation: { select: { id: true, name: true, code: true, groupLabel: true } } },
        },
      },
    });

    const { passwordHash, totpSecret, totpBackupCodes, ...result } = updatedUser!;
    return result;
  }

  /**
   * Ensure a super admin has ADMIN role on ALL delegations of the tenant.
   * Creates missing UserDelegation records and upgrades existing ones to ADMIN.
   */
  async syncSuperAdminDelegations(userId: string, tenantId: string, grantedBy?: string) {
    // Get all delegations in tenant
    const allDelegations = await this.prisma.delegation.findMany({
      where: { tenantId },
      select: { id: true },
    });

    // Get existing user delegations
    const existingDelegations = await this.prisma.userDelegation.findMany({
      where: { userId, tenantId },
      select: { delegationId: true, role: true },
    });
    const existingMap = new Map(existingDelegations.map(d => [d.delegationId, d.role]));

    // Create missing ones & upgrade non-ADMIN ones
    for (const delegation of allDelegations) {
      const existingRole = existingMap.get(delegation.id);
      if (!existingRole) {
        // Create new UserDelegation with ADMIN role
        await this.prisma.userDelegation.create({
          data: {
            tenantId,
            userId,
            delegationId: delegation.id,
            role: UserRole.ADMIN,
            grantedBy,
          },
        });
      } else if (existingRole !== UserRole.ADMIN) {
        // Upgrade to ADMIN
        await this.prisma.userDelegation.update({
          where: { userId_delegationId: { userId, delegationId: delegation.id } },
          data: { role: UserRole.ADMIN },
        });
      }
    }
  }

  async changePassword(userId: string, tenantId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully' };
  }
}
