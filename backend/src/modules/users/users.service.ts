import { Injectable, Inject, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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

  async findAll(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(({ passwordHash, ...user }) => user);
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

    const { passwordHash, ...result } = user;
    return result;
  }

  async update(id: string, tenantId: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id, tenantId);

    const data: any = { ...updateUserDto };

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

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

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
