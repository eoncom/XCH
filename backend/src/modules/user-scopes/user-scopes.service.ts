import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateUserScopeDto, BulkSetUserScopesDto, ScopeTypeDto } from './dto/create-user-scope.dto';

@Injectable()
export class UserScopesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Add a scope to a user
   */
  async create(tenantId: string, dto: CreateUserScopeDto, grantedBy: string) {
    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Validate scopeId matches scopeType
    await this.validateScopeTarget(tenantId, dto.scopeType, dto.scopeId);

    // Check for duplicate
    const resolvedScopeId = dto.scopeType === 'TENANT' ? null : dto.scopeId;
    const existing = await this.prisma.userScope.findFirst({
      where: {
        userId: dto.userId,
        scopeType: dto.scopeType,
        scopeId: resolvedScopeId,
      },
    });
    if (existing) throw new ConflictException('This scope already exists for this user');

    return this.prisma.userScope.create({
      data: {
        tenantId,
        userId: dto.userId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeType === 'TENANT' ? null : dto.scopeId,
        grantedBy,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  /**
   * List all scopes for a user
   */
  async findByUser(tenantId: string, userId: string) {
    return this.prisma.userScope.findMany({
      where: { tenantId, userId },
      orderBy: { grantedAt: 'desc' },
    });
  }

  /**
   * Delete a specific scope
   */
  async remove(tenantId: string, scopeId: string) {
    const scope = await this.prisma.userScope.findFirst({
      where: { id: scopeId, tenantId },
    });
    if (!scope) throw new NotFoundException('Scope not found');

    await this.prisma.userScope.delete({ where: { id: scopeId } });
    return { message: 'Scope removed successfully' };
  }

  /**
   * Replace all scopes for a user (bulk set)
   */
  async bulkSet(tenantId: string, dto: BulkSetUserScopesDto, grantedBy: string) {
    // Verify user belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    // Validate all scope targets
    for (const scope of dto.scopes) {
      await this.validateScopeTarget(tenantId, scope.scopeType, scope.scopeId);
    }

    // Delete all existing scopes and create new ones in a transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.userScope.deleteMany({ where: { tenantId, userId: dto.userId } });

      const created = [];
      for (const scope of dto.scopes) {
        const record = await tx.userScope.create({
          data: {
            tenantId,
            userId: dto.userId,
            scopeType: scope.scopeType,
            scopeId: scope.scopeType === 'TENANT' ? null : scope.scopeId,
            grantedBy,
          },
        });
        created.push(record);
      }

      return created;
    });
  }

  /**
   * Validate that scopeId corresponds to an existing entity matching the scopeType
   */
  private async validateScopeTarget(tenantId: string, scopeType: ScopeTypeDto, scopeId?: string) {
    if (scopeType === 'TENANT') {
      if (scopeId) throw new BadRequestException('scopeId must be null for TENANT scope');
      return;
    }

    if (!scopeId) throw new BadRequestException(`scopeId is required for ${scopeType} scope`);

    switch (scopeType) {
      case 'DIVISION': {
        const div = await this.prisma.division.findFirst({ where: { id: scopeId, tenantId } });
        if (!div) throw new NotFoundException(`Division ${scopeId} not found`);
        break;
      }
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
