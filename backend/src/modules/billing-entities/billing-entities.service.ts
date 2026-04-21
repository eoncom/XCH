import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBillingEntityDto, UpdateBillingEntityDto } from './dto/create-billing-entity.dto';
import { validateDelegationSiteCoherence } from '../../common/utils/delegation-site-validation.util';

@Injectable()
export class BillingEntitiesService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateBillingEntityDto) {
    // Check code uniqueness
    const existing = await this.prisma.billingEntity.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);

    // Validate delegation/site coherence (R1)
    await validateDelegationSiteCoherence(this.prisma as any, dto.delegationId, dto.siteId);

    return this.prisma.billingEntity.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        description: dto.description,
        isActive: dto.isActive,
        delegationId: dto.delegationId || null,
        siteId: dto.siteId || null,
      } as any,
    });
  }

  async findAll(
    tenantId: string,
    filters?: {
      type?: string;
      isActive?: string;
      search?: string;
      delegationId?: string;
      siteId?: string;
      includeGlobal?: boolean;
    },
    scopeDelegationIds: string[] | null = null,
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

    // Delegation-based filtering
    if (filters?.delegationId) {
      if (filters.includeGlobal !== false) {
        const delegationCondition = [
          { delegationId: filters.delegationId },
          { delegationId: null },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: delegationCondition }];
          delete where.OR;
        } else {
          where.OR = delegationCondition;
        }
      } else {
        where.delegationId = filters.delegationId;
      }
    }

    if (filters?.siteId) where.siteId = filters.siteId;

    // Manager scope: see entities for managed delegations + globals.
    if (scopeDelegationIds !== null) {
      if (scopeDelegationIds.length === 0) return [];
      const scopeCondition = [
        { delegationId: { in: scopeDelegationIds } },
        { delegationId: null },
      ];
      if (where.AND) {
        where.AND.push({ OR: scopeCondition });
      } else if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: scopeCondition }];
        delete where.OR;
      } else {
        where.OR = scopeCondition;
      }
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

    if (dto.code && dto.code !== entity.code) {
      const existing = await this.prisma.billingEntity.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) throw new ConflictException(`Code "${dto.code}" already exists`);
    }

    // Validate delegation/site coherence if changing (R1)
    const delegationId = 'delegationId' in dto ? dto.delegationId : (entity as any).delegationId;
    const siteId = 'siteId' in dto ? dto.siteId : (entity as any).siteId;
    await validateDelegationSiteCoherence(this.prisma as any, delegationId, siteId);

    const data: any = { ...dto };
    if ('delegationId' in dto && dto.delegationId === null) {
      data.delegationId = null;
      data.siteId = null;
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

  async getSummary(tenantId: string, id: string) {
    const entity = await this.findOne(tenantId, id);

    const expenses = await this.prisma.expense.findMany({
      where: { bearerId: id },
      select: { totalAmount: true },
    });
    const totalBorne = expenses.reduce((sum, e) => sum + e.totalAmount, 0);

    const allocationsOut = await this.prisma.costAllocation.findMany({
      where: {
        expense: { bearerId: id },
        NOT: { targetId: id },
      },
      select: { amount: true },
    });
    const totalRefactured = allocationsOut.reduce((sum, a) => sum + a.amount, 0);

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
