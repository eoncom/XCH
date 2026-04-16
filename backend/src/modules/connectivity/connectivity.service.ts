import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CreateConnectivityLinkDto,
  UpdateConnectivityLinkDto,
  FilterConnectivityLinkDto,
} from './dto/create-connectivity-link.dto';

const LINK_INCLUDE = {
  site: { select: { id: true, name: true, code: true, delegationId: true } },
  expense: { select: { id: true, label: true, totalAmount: true, frequency: true } },
};

@Injectable()
export class ConnectivityService {
  constructor(private prisma: PrismaClient) {}

  async create(tenantId: string, dto: CreateConnectivityLinkDto) {
    // Validate site belongs to tenant
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');

    return this.prisma.connectivityLink.create({
      data: {
        tenantId,
        siteId: dto.siteId,
        role: dto.role,
        provider: dto.provider,
        type: dto.type,
        bandwidthDown: dto.bandwidthDown ?? null,
        bandwidthUp: dto.bandwidthUp ?? null,
        publicIp: dto.publicIp ?? null,
        monthlyPrice: dto.monthlyPrice ?? null,
        currency: dto.currency || 'EUR',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        contractRef: dto.contractRef ?? null,
        notes: dto.notes ?? null,
      },
      include: LINK_INCLUDE,
    });
  }

  async findAll(tenantId: string, filters: FilterConnectivityLinkDto = {}) {
    const where: any = { tenantId };
    if (filters.siteId) where.siteId = filters.siteId;
    if (filters.role) where.role = filters.role;
    if (filters.type) where.type = filters.type;

    return this.prisma.connectivityLink.findMany({
      where,
      include: LINK_INCLUDE,
      orderBy: [{ role: 'asc' }, { provider: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
      include: LINK_INCLUDE,
    });
    if (!link) throw new NotFoundException('Connectivity link not found');
    return link;
  }

  async update(tenantId: string, id: string, dto: UpdateConnectivityLinkDto) {
    const existing = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Connectivity link not found');

    const data: any = { ...dto };
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;

    const updated = await this.prisma.connectivityLink.update({
      where: { id },
      data,
      include: LINK_INCLUDE,
    });

    // If an expense is linked and pricing/dates changed, sync the expense
    if (existing.expenseId && (dto.monthlyPrice !== undefined || dto.startDate !== undefined || dto.endDate !== undefined || dto.currency !== undefined)) {
      const expenseData: any = {};
      if (dto.monthlyPrice !== undefined && dto.monthlyPrice !== null) expenseData.totalAmount = dto.monthlyPrice;
      if (dto.currency !== undefined) expenseData.currency = dto.currency;
      if (dto.startDate !== undefined) expenseData.dateStart = dto.startDate ? new Date(dto.startDate) : null;
      if (dto.endDate !== undefined) expenseData.dateEnd = dto.endDate ? new Date(dto.endDate) : null;
      if (Object.keys(expenseData).length > 0) {
        await this.prisma.expense.update({
          where: { id: existing.expenseId },
          data: expenseData,
        }).catch(() => undefined);
      }
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
    });
    if (!link) throw new NotFoundException('Connectivity link not found');

    await this.prisma.connectivityLink.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Generate a recurring MONTHLY expense linked to this connectivity.
   * Requires bearerId (BillingEntity) in body.
   */
  async generateExpense(
    tenantId: string,
    id: string,
    body: { bearerId: string; label?: string },
    createdBy: string,
  ) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
      include: { site: { select: { id: true, name: true, delegationId: true } } },
    });
    if (!link) throw new NotFoundException('Connectivity link not found');

    if (!link.monthlyPrice || Number(link.monthlyPrice) <= 0) {
      throw new BadRequestException('Monthly price must be set to generate an expense');
    }
    if (link.expenseId) {
      throw new BadRequestException('An expense is already linked to this connectivity');
    }

    // Validate bearer
    const bearer = await this.prisma.billingEntity.findFirst({
      where: { id: body.bearerId, tenantId },
    });
    if (!bearer) throw new NotFoundException('Bearer billing entity not found');

    const defaultLabel = `Connectivité ${link.provider} (${link.type}) — ${link.site.name}`;

    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        label: body.label || defaultLabel,
        type: 'SERVICE' as any,
        totalAmount: Number(link.monthlyPrice),
        currency: link.currency,
        frequency: 'MONTHLY' as any,
        dateIncurred: link.startDate || new Date(),
        dateStart: link.startDate,
        dateEnd: link.endDate,
        bearerId: bearer.id,
        delegationId: link.site.delegationId,
        siteId: link.site.id,
        createdBy,
      } as any,
    });

    await this.prisma.connectivityLink.update({
      where: { id: link.id },
      data: { expenseId: expense.id },
    });

    return this.findOne(tenantId, id);
  }
}
