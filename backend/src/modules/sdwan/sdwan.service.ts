import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AttachFirewallDto, UpsertSdwanConfigDto } from './dto/sdwan.dto';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';

const CONFIG_INCLUDE = {
  firewalls: {
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          type: true,
          serialNumber: true,
          status: true,
          ip: true,
          mac: true,
          hostname: true,
          vlan: true,
          port: true,
        },
      },
    },
  },
};

@Injectable()
export class SdwanService {
  constructor(
    private prisma: PrismaClient,
    private perm: PermissionService,
  ) {}

  /**
   * Return the SD-WAN config for a site, with firewalls and their assets.
   * Returns null if no config yet — the UI decides whether to show an empty
   * state or a "configure SD-WAN" CTA.
   */
  async getBySite(tenantId: string, siteId: string, callerCtx: CallerCtx) {
    await this.ensureSiteForRead(tenantId, siteId, callerCtx);
    return this.prisma.sdwanConfig.findUnique({
      where: { siteId },
      include: CONFIG_INCLUDE,
    });
  }

  /**
   * Idempotent upsert. Creates the SdwanConfig row on first call, updates in
   * place afterwards. Firewalls are managed via attach/detach endpoints.
   */
  async upsert(
    tenantId: string,
    siteId: string,
    dto: UpsertSdwanConfigDto,
    callerCtx: CallerCtx,
  ) {
    await this.ensureSiteForWrite(tenantId, siteId, callerCtx);
    return this.prisma.sdwanConfig.upsert({
      where: { siteId },
      create: {
        tenantId,
        siteId,
        enabled: dto.enabled ?? true,
        provider: dto.provider ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: CONFIG_INCLUDE,
    });
  }

  async remove(tenantId: string, siteId: string, callerCtx: CallerCtx) {
    await this.ensureSiteForWrite(tenantId, siteId, callerCtx);
    const existing = await this.prisma.sdwanConfig.findUnique({ where: { siteId } });
    if (!existing) throw new NotFoundException('SD-WAN config not found for this site');
    await this.prisma.sdwanConfig.delete({ where: { siteId } });
    return { deleted: true };
  }

  /**
   * Attach a firewall asset to the site's SD-WAN config. Ensures the asset
   * belongs to the same site — a firewall can't terminate another site's
   * overlay.
   */
  async attachFirewall(
    tenantId: string,
    siteId: string,
    dto: AttachFirewallDto,
    callerCtx: CallerCtx,
  ) {
    await this.ensureSiteForWrite(tenantId, siteId, callerCtx);
    const config = await this.prisma.sdwanConfig.findUnique({ where: { siteId } });
    if (!config) {
      throw new BadRequestException(
        'Configure SD-WAN on this site before attaching firewalls',
      );
    }

    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, tenantId },
      select: { id: true, siteId: true, type: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.siteId && asset.siteId !== siteId) {
      throw new BadRequestException('Asset does not belong to this site');
    }

    try {
      await this.prisma.sdwanFirewall.create({
        data: {
          sdwanConfigId: config.id,
          assetId: asset.id,
          role: dto.role ?? 'active',
        },
      });
    } catch (err: any) {
      // Prisma unique violation code
      if (err?.code === 'P2002') {
        throw new ConflictException('Firewall already attached to this SD-WAN config');
      }
      throw err;
    }

    return this.getBySite(tenantId, siteId, callerCtx);
  }

  async detachFirewall(
    tenantId: string,
    siteId: string,
    assetId: string,
    callerCtx: CallerCtx,
  ) {
    await this.ensureSiteForWrite(tenantId, siteId, callerCtx);
    const config = await this.prisma.sdwanConfig.findUnique({ where: { siteId } });
    if (!config) throw new NotFoundException('SD-WAN config not found for this site');

    const row = await this.prisma.sdwanFirewall.findUnique({
      where: { sdwanConfigId_assetId: { sdwanConfigId: config.id, assetId } },
    });
    if (!row) throw new NotFoundException('Firewall not attached to this SD-WAN config');

    await this.prisma.sdwanFirewall.delete({ where: { id: row.id } });
    return this.getBySite(tenantId, siteId, callerCtx);
  }

  /**
   * ADR-021 — site existence + read access.
   * Throws 404 NotFoundException whether the site doesn't exist OR
   * the caller can't read it (defense in depth, identical shape).
   */
  private async ensureSiteForRead(tenantId: string, siteId: string, callerCtx: CallerCtx) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    await this.perm.assertCanReadSite(callerCtx, siteId);
  }

  /**
   * ADR-021 — site existence + write access.
   * 404 if site missing or unreadable, 403 if read-only on the site.
   */
  private async ensureSiteForWrite(tenantId: string, siteId: string, callerCtx: CallerCtx) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    // Read first (404 if cross-delegation), then write (403 if read-only).
    await this.perm.assertCanReadSite(callerCtx, siteId);
    await this.perm.assertCanWriteSite(callerCtx, siteId);
  }
}
