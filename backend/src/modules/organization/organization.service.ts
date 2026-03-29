import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
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
  // DIVISIONS
  // ============================================================================

  async createDivision(tenantId: string, dto: CreateDivisionDto, userId?: string) {
    const existing = await this.prisma.division.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Division with code "${dto.code}" already exists`);
    }

    const division = await this.prisma.division.create({
      data: { tenantId, ...dto },
    });

    await this.auditLogService.log({
      tenantId, userId, action: 'CREATE', entityType: 'division', entityId: division.id,
      changes: { after: { code: division.code, name: division.name } },
    });

    return division;
  }

  async findAllDivisions(tenantId: string, includeInactive = false) {
    return this.prisma.division.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: { select: { delegations: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneDivision(id: string, tenantId: string) {
    const division = await this.prisma.division.findFirst({
      where: { id, tenantId },
      include: {
        delegations: {
          include: { _count: { select: { sites: true } } },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!division) throw new NotFoundException('Division not found');
    return division;
  }

  async updateDivision(id: string, tenantId: string, dto: UpdateDivisionDto, userId?: string) {
    const division = await this.prisma.division.findFirst({ where: { id, tenantId } });
    if (!division) throw new NotFoundException('Division not found');

    if (dto.code && dto.code !== division.code) {
      const existing = await this.prisma.division.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) throw new ConflictException(`Division with code "${dto.code}" already exists`);
    }

    const updated = await this.prisma.division.update({ where: { id }, data: dto });

    await this.auditLogService.log({
      tenantId, userId, action: 'UPDATE', entityType: 'division', entityId: id,
      changes: { before: { code: division.code, name: division.name }, after: { code: updated.code, name: updated.name } },
    });

    return updated;
  }

  async removeDivision(id: string, tenantId: string, userId?: string) {
    const division = await this.prisma.division.findFirst({
      where: { id, tenantId },
      include: { delegations: { include: { _count: { select: { sites: true } } } } },
    });
    if (!division) throw new NotFoundException('Division not found');

    const sitesCount = division.delegations.reduce((sum, d) => sum + d._count.sites, 0);
    if (sitesCount > 0) {
      throw new BadRequestException(
        `Cannot delete division "${division.name}": ${sitesCount} site(s) still assigned via its delegations. Transfer them first.`,
      );
    }

    await this.prisma.division.delete({ where: { id } });

    await this.auditLogService.log({
      tenantId, userId, action: 'DELETE', entityType: 'division', entityId: id,
      changes: { before: { code: division.code, name: division.name } },
    });

    return { deleted: true };
  }

  // ============================================================================
  // DELEGATIONS
  // ============================================================================

  async createDelegation(tenantId: string, dto: CreateDelegationDto, userId?: string) {
    // Verify division exists and belongs to tenant
    const division = await this.prisma.division.findFirst({
      where: { id: dto.divisionId, tenantId },
    });
    if (!division) throw new NotFoundException('Division not found');

    const existing = await this.prisma.delegation.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Delegation with code "${dto.code}" already exists`);
    }

    const delegation = await this.prisma.delegation.create({
      data: { tenantId, ...dto },
      include: { division: { select: { id: true, name: true, code: true } } },
    });

    await this.auditLogService.log({
      tenantId, userId, action: 'CREATE', entityType: 'delegation', entityId: delegation.id,
      changes: { after: { code: delegation.code, name: delegation.name, divisionCode: division.code } },
    });

    return delegation;
  }

  async findAllDelegations(tenantId: string, divisionId?: string, includeInactive = false) {
    return this.prisma.delegation.findMany({
      where: {
        tenantId,
        ...(divisionId ? { divisionId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        division: { select: { id: true, name: true, code: true, color: true } },
        _count: { select: { sites: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneDelegation(id: string, tenantId: string) {
    const delegation = await this.prisma.delegation.findFirst({
      where: { id, tenantId },
      include: {
        division: { select: { id: true, name: true, code: true, color: true } },
        sites: { select: { id: true, code: true, name: true, status: true } },
      },
    });
    if (!delegation) throw new NotFoundException('Delegation not found');
    return delegation;
  }

  async updateDelegation(id: string, tenantId: string, dto: UpdateDelegationDto, userId?: string) {
    const delegation = await this.prisma.delegation.findFirst({ where: { id, tenantId } });
    if (!delegation) throw new NotFoundException('Delegation not found');

    if (dto.divisionId && dto.divisionId !== delegation.divisionId) {
      const division = await this.prisma.division.findFirst({ where: { id: dto.divisionId, tenantId } });
      if (!division) throw new NotFoundException('Target division not found');
    }

    if (dto.code && dto.code !== delegation.code) {
      const existing = await this.prisma.delegation.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (existing) throw new ConflictException(`Delegation with code "${dto.code}" already exists`);
    }

    const updated = await this.prisma.delegation.update({
      where: { id },
      data: dto,
      include: { division: { select: { id: true, name: true, code: true, color: true } } },
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
  // ORGANIZATION TREE
  // ============================================================================

  async getTree(tenantId: string, includeInactive = false) {
    const divisions = await this.prisma.division.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        delegations: {
          where: includeInactive ? {} : { isActive: true },
          include: {
            sites: {
              select: { id: true, code: true, name: true, status: true, city: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return divisions;
  }
}
