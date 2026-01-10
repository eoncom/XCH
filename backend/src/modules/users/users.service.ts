import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('PRISMA_CLIENT') private prisma: PrismaClient) {}

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

    const user = await this.prisma.user.create({
      data: {
        ...userDataWithoutPassword,
        ...(dtoTenantId && { tenant: { connect: { id: dtoTenantId } } }),
        passwordHash,
      },
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
}
