import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MonitorReactionsService } from '../monitoring/monitor-reactions.service';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import {
  CreateConnectivityLinkDto,
  UpdateConnectivityLinkDto,
  FilterConnectivityLinkDto,
} from './dto/create-connectivity-link.dto';

const LINK_INCLUDE = {
  site: { select: { id: true, name: true, code: true, delegationId: true } },
  expense: { select: { id: true, label: true, totalAmount: true, frequency: true } },
  asset: { select: { id: true, name: true, type: true, serialNumber: true } },
};

@Injectable()
export class ConnectivityService {
  private readonly logger = new Logger(ConnectivityService.name);

  constructor(
    private prisma: PrismaClient,
    private monitorReactions: MonitorReactionsService,
    private perm: PermissionService,
  ) {}

  async create(tenantId: string, dto: CreateConnectivityLinkDto, callerCtx: CallerCtx) {
    // ADR-021 — site must exist + caller must have write access on it.
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');
    await this.perm.assertCanWriteSite(callerCtx, dto.siteId);

    if (dto.assetId) {
      await this.validateAssetForSite(tenantId, dto.assetId, dto.siteId);
    }

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
        assetId: dto.assetId ?? null,
      },
      include: LINK_INCLUDE,
    });
  }

  /**
   * Ensure the asset belongs to the same tenant and (if the asset has a site)
   * to the same site as the connectivity link. Keeps a connectivity link from
   * pointing to an equipment located elsewhere.
   */
  private async validateAssetForSite(tenantId: string, assetId: string, siteId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      select: { id: true, siteId: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.siteId && asset.siteId !== siteId) {
      throw new BadRequestException(
        'Asset belongs to a different site than this connectivity link',
      );
    }
  }

  async findAll(
    tenantId: string,
    filters: FilterConnectivityLinkDto = {},
    callerCtx: CallerCtx,
  ) {
    const where: any = { tenantId };

    // ADR-021 — automatic site scope. Non-super-admin users see only links
    // attached to a site they can read. Empty array short-circuits to [].
    const readableSites = await this.perm.getReadableSiteIds(callerCtx);
    if (readableSites !== null) {
      where.siteId = { in: readableSites };
    }

    if (filters.siteId) {
      // UI narrowing : if the user already has the scope filter applied,
      // tighten further to a specific site they can read.
      where.siteId = readableSites !== null
        ? { in: readableSites.filter((s) => s === filters.siteId) }
        : filters.siteId;
    }
    if (filters.role) where.role = filters.role;
    if (filters.type) where.type = filters.type;

    return this.prisma.connectivityLink.findMany({
      where,
      include: LINK_INCLUDE,
      orderBy: [{ role: 'asc' }, { provider: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string, callerCtx: CallerCtx) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
      include: LINK_INCLUDE,
    });
    if (!link) throw new NotFoundException('Connectivity link not found');

    // ADR-021 — guess-by-id defense.
    await this.perm.assertCanReadSite(callerCtx, link.siteId);

    return link;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateConnectivityLinkDto,
    callerCtx: CallerCtx,
  ) {
    const existing = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Connectivity link not found');

    // ADR-021 — write access on the link's site.
    await this.perm.assertCanWriteSite(callerCtx, existing.siteId);

    if (dto.assetId !== undefined && dto.assetId !== null) {
      await this.validateAssetForSite(tenantId, dto.assetId, existing.siteId);
    }

    const data: any = { ...dto };
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    // Explicit null → detach the current asset.
    if (dto.assetId === null) data.assetId = null;

    const updated = await this.prisma.connectivityLink.update({
      where: { id },
      data,
      include: LINK_INCLUDE,
    });

    // ADR-016 — auto-sync MonitorCheck.target when publicIp changes.
    if (dto.publicIp !== undefined && dto.publicIp !== existing.publicIp) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { allowInternalNetworkTargets: true },
      });
      const allowInternal = tenant?.allowInternalNetworkTargets ?? false;
      await this.monitorReactions
        .autoSyncTargetForLink(tenantId, id, existing.publicIp, dto.publicIp, allowInternal)
        .catch((e) => this.logger.warn(`target sync failed for link ${id}: ${e.message}`));
    }

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

  async remove(tenantId: string, id: string, callerCtx: CallerCtx) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
    });
    if (!link) throw new NotFoundException('Connectivity link not found');

    // ADR-021 — write access on the link's site.
    await this.perm.assertCanWriteSite(callerCtx, link.siteId);

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
    callerCtx: CallerCtx,
  ) {
    const link = await this.prisma.connectivityLink.findFirst({
      where: { id, tenantId },
      include: { site: { select: { id: true, name: true, delegationId: true } } },
    });
    if (!link) throw new NotFoundException('Connectivity link not found');

    // ADR-021 — write access on the link's site.
    await this.perm.assertCanWriteSite(callerCtx, link.siteId);

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
