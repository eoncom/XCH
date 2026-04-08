import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateAccessGrantDto, UpdateAccessGrantDto, AccessScopeDto } from './dto/create-access-grant.dto';

@Injectable()
export class AccessGrantsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create an access grant for a user
   */
  async create(tenantId: string, dto: CreateAccessGrantDto, grantedBy: string) {
    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Validate scope target
    await this.validateScopeTarget(tenantId, dto.scope, dto.scopeId);

    return this.prisma.accessGrant.create({
      data: {
        tenantId,
        userId: dto.userId,
        scope: dto.scope,
        scopeId: dto.scope === 'ALL_SITES' ? null : dto.scopeId,
        resourcePermissions: dto.resourcePermissions as any,
        label: dto.label,
        grantedBy,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * List all grants for a user
   */
  async findByUser(tenantId: string, userId: string) {
    return this.prisma.accessGrant.findMany({
      where: { tenantId, userId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * Update a grant
   */
  async update(tenantId: string, grantId: string, dto: UpdateAccessGrantDto) {
    const grant = await this.prisma.accessGrant.findFirst({
      where: { id: grantId, tenantId },
    });
    if (!grant) throw new NotFoundException('Access grant not found');

    const data: any = {};
    if (dto.resourcePermissions !== undefined) data.resourcePermissions = dto.resourcePermissions;
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.prisma.accessGrant.update({
      where: { id: grantId },
      data,
    });
  }

  /**
   * Delete a grant
   */
  async remove(tenantId: string, grantId: string) {
    const grant = await this.prisma.accessGrant.findFirst({
      where: { id: grantId, tenantId },
    });
    if (!grant) throw new NotFoundException('Access grant not found');

    await this.prisma.accessGrant.delete({ where: { id: grantId } });
    return { message: 'Access grant removed successfully' };
  }

  /**
   * Validate scope target exists
   */
  private async validateScopeTarget(tenantId: string, scope: AccessScopeDto, scopeId?: string) {
    if (scope === 'ALL_SITES') {
      if (scopeId) throw new BadRequestException('scopeId must be null for ALL_SITES scope');
      return;
    }

    if (!scopeId) throw new BadRequestException(`scopeId is required for ${scope} scope`);

    switch (scope) {
      case 'DELEGATION': {
        const del = await this.prisma.delegation.findFirst({ where: { id: scopeId, tenantId } });
        if (!del) throw new NotFoundException(`Delegation ${scopeId} not found`);
        break;
      }
      case 'SITE': {
        const site = await this.prisma.site.findFirst({ where: { id: scopeId, tenantId } });
        if (!site) throw new NotFoundException(`Site ${scopeId} not found`);
        break;
      }
    }
  }
}
