import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class OrganizationService {
  constructor(
    private prisma: PrismaClient,
    private auditLogService: AuditLogService,
  ) {}

  // ============================================================================
  // DELEGATIONS
  // ============================================================================

  async createDelegation(tenantId: string, dto: CreateDelegationDto, userId?: string) {
    const existing = await this.prisma.delegation.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Delegation with code "${dto.code}" already exists`);
    }

    const delegation = await this.prisma.delegation.create({
      data: { tenantId, ...dto },
    });

    await this.auditLogService.log({
      tenantId, userId, action: 'CREATE', entityType: 'delegation', entityId: delegation.id,
      changes: { after: { code: delegation.code, name: delegation.name } },
    });

    return delegation;
  }

  async findAllDelegations(tenantId: string, includeInactive = false) {
    return this.prisma.delegation.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: { select: { sites: true, userDelegations: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneDelegation(id: string, tenantId: string) {
    const delegation = await this.prisma.delegation.findFirst({
      where: { id, tenantId },
      include: {
        sites: { select: { id: true, code: true, name: true, status: true } },
      },
    });
    if (!delegation) throw new NotFoundException('Delegation not found');
    return delegation;
  }

  async updateDelegation(id: string, tenantId: string, dto: UpdateDelegationDto, userId?: string) {
    const delegation = await this.prisma.delegation.findFirst({ where: { id, tenantId } });
    if (!delegation) throw new NotFoundException('Delegation not found');

    if (dto.code && dto.code !== delegation.code) {
      const existing = await this.prisma.delegation.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) throw new ConflictException(`Delegation with code "${dto.code}" already exists`);
    }

    const updated = await this.prisma.delegation.update({
      where: { id },
      data: dto,
    });

    await this.auditLogService.log({
      tenantId, userId, action: 'UPDATE', entityType: 'delegation', entityId: id,
      changes: { before: { code: delegation.code, name: delegation.name }, after: { code: updated.code, name: updated.name } },
    });

    return updated;
  }

  async removeDelegation(id: string, tenantId: string, userId?: string) {
    const delegation = await this.prisma.delegation.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { sites: true } } },
    });
    if (!delegation) throw new NotFoundException('Delegation not found');

    if (delegation._count.sites > 0) {
      throw new BadRequestException(
        `Cannot delete delegation "${delegation.name}": ${delegation._count.sites} site(s) still assigned. Transfer them first.`,
      );
    }

    await this.prisma.delegation.delete({ where: { id } });

    await this.auditLogService.log({
      tenantId, userId, action: 'DELETE', entityType: 'delegation', entityId: id,
      changes: { before: { code: delegation.code, name: delegation.name } },
    });

    return { deleted: true };
  }

  // ============================================================================
  // ORGANIZATION TREE (flat list of delegations with sites)
  // ============================================================================

  async getTree(tenantId: string, includeInactive = false, accessibleSiteIds?: string[] | null) {
    const siteFilter: any = {};
    if (accessibleSiteIds !== null && accessibleSiteIds !== undefined) {
      if (accessibleSiteIds.length === 0) return [];
      siteFilter.id = { in: accessibleSiteIds };
    }

    const delegations = await this.prisma.delegation.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        sites: {
          where: siteFilter,
          select: { id: true, code: true, name: true, status: true, city: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Prune empty delegations when filtering by accessible sites
    if (accessibleSiteIds !== null && accessibleSiteIds !== undefined) {
      return delegations.filter(del => del.sites.length > 0);
    }

    return delegations;
  }
}
