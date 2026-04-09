import { Injectable, Inject, NotFoundException, ConflictException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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

  async findAll(tenantId: string, filters: FilterUserDto = {}, visibleUserIds?: string[] | null) {
    const where: any = { tenantId };
    // If visibleUserIds is an array, filter to only those users
    if (visibleUserIds !== null && visibleUserIds !== undefined) {
      where.id = { in: visibleUserIds };
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

  async findOne(id: string, tenantId: string) {
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

    const { passwordHash, totpSecret, totpBackupCodes, ...result } = user;
    return result;
  }

  async update(id: string, tenantId: string, updateUserDto: UpdateUserDto, requestingUserId?: string) {
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

    // Security: never allow modifying isSuperAdmin via API (only DB direct)
    const data: any = { ...updateUserDto };
    delete data.isSuperAdmin;

    // Security: protect super admin users from being modified by non-super-admins
    if ((targetUser as any).isSuperAdmin && !isSuperAdmin) {
      throw new ForbiddenException('Seul un super administrateur peut modifier un autre super administrateur');
    }

    // Security: prevent self-demotion of role for super admins
    if (requestingUserId === id && isSuperAdmin && data.role && data.role !== (targetUser as any).role) {
      throw new ForbiddenException('Un super administrateur ne peut pas modifier son propre rôle');
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

  async remove(id: string, tenantId: string, requestingUserId?: string) {
    const targetUser = await this.findOne(id, tenantId);

    // Security: prevent deleting super admin users
    if ((targetUser as any).isSuperAdmin) {
      throw new ForbiddenException('Impossible de supprimer un super administrateur');
    }

    // Security: prevent self-deletion
    if (requestingUserId === id) {
      throw new ForbiddenException('Impossible de supprimer votre propre compte');
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
