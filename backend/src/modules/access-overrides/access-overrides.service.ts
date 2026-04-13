import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient, OverrideEffect } from '@prisma/client';
import { CreateAccessOverrideDto, UpdateAccessOverrideDto } from './dto/access-override.dto';
import { isValidResource } from '../../common/constants/resources';

@Injectable()
export class AccessOverridesService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateAccessOverrideDto, grantedBy: string) {
    // Validate resource
    if (!isValidResource(dto.resource)) {
      throw new BadRequestException(
        `Invalid resource "${dto.resource}". Valid values: *, assets, racks, tasks, plans, contacts, expenses, monitoring`,
      );
    }

    // ALLOW must have permission, DENY must not
    if (dto.effect === OverrideEffect.ALLOW && !dto.permission) {
      throw new BadRequestException('permission is required when effect is ALLOW');
    }
    if (dto.effect === OverrideEffect.DENY && dto.permission) {
      throw new BadRequestException('permission must be null when effect is DENY');
    }

    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');

    // Verify site belongs to tenant
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found in this tenant');

    try {
      return await this.prisma.accessOverride.create({
        data: {
          tenantId,
          userId: dto.userId,
          siteId: dto.siteId,
          resource: dto.resource,
          effect: dto.effect,
          permission: dto.effect === OverrideEffect.DENY ? null : dto.permission,
          label: dto.label,
          grantedBy,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          site: { select: { id: true, name: true } },
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          `An override already exists for this user+site+resource combination. Use PATCH to update it.`,
        );
      }
      throw e;
    }
  }

  async findByUser(tenantId: string, userId: string) {
    return this.prisma.accessOverride.findMany({
      where: { tenantId, userId },
      include: {
        site: { select: { id: true, name: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async findBySite(tenantId: string, siteId: string) {
    return this.prisma.accessOverride.findMany({
      where: { tenantId, siteId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const override = await this.prisma.accessOverride.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, name: true } },
      },
    });
    if (!override) throw new NotFoundException('Access override not found');
    return override;
  }

  async update(tenantId: string, id: string, dto: UpdateAccessOverrideDto) {
    const existing = await this.prisma.accessOverride.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Access override not found');

    const effect = dto.effect ?? existing.effect;

    // Validate effect/permission consistency
    if (effect === OverrideEffect.ALLOW) {
      const permission = dto.permission ?? existing.permission;
      if (!permission) {
        throw new BadRequestException('permission is required when effect is ALLOW');
      }
    }

    const data: any = {};
    if (dto.effect !== undefined) data.effect = dto.effect;
    if (dto.permission !== undefined) data.permission = dto.effect === 'DENY' ? null : dto.permission;
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.prisma.accessOverride.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        site: { select: { id: true, name: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.accessOverride.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Access override not found');

    await this.prisma.accessOverride.delete({ where: { id } });
    return { message: 'Access override removed successfully' };
  }
}
