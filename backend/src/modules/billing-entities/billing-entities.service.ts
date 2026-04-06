import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBillingEntityDto, UpdateBillingEntityDto } from './dto/create-billing-entity.dto';
import { validateScope } from '../../common/utils/scope-validation.util';
import { resolveDescendantScopes } from '../../common/utils/scope-resolution.util';

@Injectable()
export class BillingEntitiesService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateBillingEntityDto) {
    // Check code uniqueness
    const existing = await this.prisma.billingEntity.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);

    // Auto-populate scopeType/scopeId from deprecated fields if not set
    let { scopeType, scopeId } = dto;
    if (!scopeType && !scopeId) {
      if (dto.siteId) { scopeType = 'SITE'; scopeId = dto.siteId; }
      else if (dto.delegationId) { scopeType = 'DELEGATION'; scopeId = dto.delegationId; }
      else if (dto.divisionId) { scopeType = 'DIVISION'; scopeId = dto.divisionId; }
    }

    // Validate scope entity exists
    if (scopeType && scopeId) {
      await validateScope(this.prisma as any, tenantId, scopeType, scopeId);
    }

    return this.prisma.billingEntity.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        description: dto.description,
        isActive: dto.isActive,
        scopeType: scopeType || null,
        scopeId: scopeId || null,
        divisionId: dto.divisionId,
        delegationId: dto.delegationId,
        siteId: dto.siteId,
      } as any,
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      type?: string;
      isActive?: string;
      search?: string;
      scopeType?: string;
      scopeId?: string;
      forScopeType?: string;
      forScopeId?: string;
    },
  ) {
    const where: any = { tenantId };
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive === 'true';
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Direct scope filter
    if (filters?.scopeType) {
      where.scopeType = filters.scopeType;
      if (filters.scopeId) where.scopeId = filters.scopeId;
    }

    // Hierarchical scope filter: include entities at this scope + all descendants + tenant-wide
    if (filters?.forScopeType && filters?.forScopeId) {
      const descendants = await resolveDescendantScopes(
        this.prisma as any,
        filters.forScopeType,
        filters.forScopeId,
      );
      where.OR = [
        { scopeType: null }, // Tenant-wide entities
        ...descendants.map((d) => ({ scopeType: d.scopeType, scopeId: d.scopeId })),
        // Also include if search was set (merge OR conditions)
        ...(where.OR || []),
      ];
    }

    return this.prisma.billingEntity.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const entity = await this.prisma.billingEntity.findFirst({
      where: { id, tenantId },
    });
    if (!entity) throw new NotFoundException('Billing entity not found');
    return entity;
  }

  async update(tenantId: string, id: string, dto: UpdateBillingEntityDto) {
    const entity = await this.prisma.billingEntity.findFirst({
      where: { id, tenantId },
    });
    if (!entity) throw new NotFoundException('Billing entity not found');

    // Check code uniqueness if changing
    if (dto.code && dto.code !== entity.code) {
      const existing = await this.prisma.billingEntity.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);
    }

    // Validate scope if changing
    const scopeType = dto.scopeType !== undefined ? dto.scopeType : (entity as any).scopeType;
    const scopeId = dto.scopeId !== undefined ? dto.scopeId : (entity as any).scopeId;
    if (scopeType && scopeId) {
      await validateScope(this.prisma as any, tenantId, scopeType, scopeId);
    }

    const data: any = { ...dto };
    // Handle explicit null for scope clearing
    if (dto.scopeType === null) {
      data.scopeType = null;
      data.scopeId = null;
    }

    return this.prisma.billingEntity.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const entity = await this.prisma.billingEntity.findFirst({
      where: { id, tenantId },
    });
    if (!entity) throw new NotFoundException('Billing entity not found');

    // Check for linked expenses
    const expenseCount = await this.prisma.expense.count({
      where: { bearerId: id },
    });
    const allocationCount = await this.prisma.costAllocation.count({
      where: { targetId: id },
    });

    if (expenseCount > 0 || allocationCount > 0) {
      throw new ConflictException(
        `Cannot delete: ${expenseCount} expense(s) and ${allocationCount} allocation(s) reference this entity`,
      );
    }

    await this.prisma.billingEntity.delete({ where: { id } });
    return { message: 'Billing entity deleted' };
  }

  /**
   * Get summary: total borne (as bearer), total imputed (as target), net balance
   */
  async getSummary(tenantId: string, id: string) {
    const entity = await this.findOne(tenantId, id);

    // Total expenses borne (bearer)
    const expenses = await this.prisma.expense.findMany({
      where: { bearerId: id },
      select: { totalAmount: true },
    });
    const totalBorne = expenses.reduce((sum, e) => sum + e.totalAmount, 0);

    // Total refactured out (allocations FROM expenses of this bearer to other targets)
    const allocationsOut = await this.prisma.costAllocation.findMany({
      where: {
        expense: { bearerId: id },
        NOT: { targetId: id },
      },
      select: { amount: true },
    });
    const totalRefactured = allocationsOut.reduce((sum, a) => sum + a.amount, 0);

    // Total imputed (allocations received as target)
    const allocationsIn = await this.prisma.costAllocation.findMany({
      where: { targetId: id },
      select: { amount: true },
    });
    const totalImputed = allocationsIn.reduce((sum, a) => sum + a.amount, 0);

    return {
      ...entity,
      totalBorne,
      totalRefactured,
      netBorne: totalBorne - totalRefactured,
      totalImputed,
    };
  }
}
