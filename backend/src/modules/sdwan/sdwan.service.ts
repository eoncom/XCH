import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AttachFirewallDto, UpsertSdwanConfigDto } from './dto/sdwan.dto';

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
          networkInfo: true,
        },
      },
    },
  },
};

@Injectable()
export class SdwanService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Return the SD-WAN config for a site, with firewalls and their assets.
   * Returns null if no config yet — the UI decides whether to show an empty
   * state or a "configure SD-WAN" CTA.
   */
  async getBySite(tenantId: string, siteId: string) {
    await this.ensureSite(tenantId, siteId);
    return this.prisma.sdwanConfig.findUnique({
      where: { siteId },
      include: CONFIG_INCLUDE,
    });
  }

  /**
   * Idempotent upsert. Creates the SdwanConfig row on first call, updates in
   * place afterwards. Firewalls are managed via attach/detach endpoints.
   */
  async upsert(tenantId: string, siteId: string, dto: UpsertSdwanConfigDto) {
    await this.ensureSite(tenantId, siteId);
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

  async remove(tenantId: string, siteId: string) {
    await this.ensureSite(tenantId, siteId);
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
  async attachFirewall(tenantId: string, siteId: string, dto: AttachFirewallDto) {
    await this.ensureSite(tenantId, siteId);
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

    return this.getBySite(tenantId, siteId);
  }

  async detachFirewall(tenantId: string, siteId: string, assetId: string) {
    await this.ensureSite(tenantId, siteId);
    const config = await this.prisma.sdwanConfig.findUnique({ where: { siteId } });
    if (!config) throw new NotFoundException('SD-WAN config not found for this site');

    const row = await this.prisma.sdwanFirewall.findUnique({
      where: { sdwanConfigId_assetId: { sdwanConfigId: config.id, assetId } },
    });
    if (!row) throw new NotFoundException('Firewall not attached to this SD-WAN config');

    await this.prisma.sdwanFirewall.delete({ where: { id: row.id } });
    return this.getBySite(tenantId, siteId);
  }

  private async ensureSite(tenantId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('Site not found');
  }
}
