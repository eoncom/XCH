import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface ConsumptionResult {
  totalWatts: number;
  kWhMonth: number;
  costMonth: number;
  currency: string;
  costPerKwh: number;
  assetCount: number;
  byType?: Record<string, { watts: number; count: number }>;
}

interface TenantElectricityConfig {
  costPerKwh: number;
  currency: string;
}

@Injectable()
export class ConsumptionService {
  constructor(private prisma: PrismaClient) {}

  private async getElectricityConfig(tenantId: string): Promise<TenantElectricityConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });
    const cfg = (tenant?.config as any)?.electricity || {};
    return {
      costPerKwh: Number(cfg.costPerKwh) || 0.20,
      currency: cfg.currency || 'EUR',
    };
  }

  private computeFromAssets(
    assets: Array<{ type: string; powerConsumption: number | null; dutyCyclePercent: number }>,
    cfg: TenantElectricityConfig,
  ): ConsumptionResult {
    let totalWatts = 0;
    const byType: Record<string, { watts: number; count: number }> = {};

    for (const asset of assets) {
      if (!asset.powerConsumption) continue;
      const watts = asset.powerConsumption * (asset.dutyCyclePercent / 100);
      totalWatts += watts;
      if (!byType[asset.type]) byType[asset.type] = { watts: 0, count: 0 };
      byType[asset.type].watts += watts;
      byType[asset.type].count += 1;
    }

    const kWhMonth = (totalWatts * 24 * 30) / 1000;
    const costMonth = kWhMonth * cfg.costPerKwh;

    return {
      totalWatts: Math.round(totalWatts * 100) / 100,
      kWhMonth: Math.round(kWhMonth * 100) / 100,
      costMonth: Math.round(costMonth * 100) / 100,
      currency: cfg.currency,
      costPerKwh: cfg.costPerKwh,
      assetCount: assets.length,
      byType,
    };
  }

  async computeSite(tenantId: string, siteId: string): Promise<ConsumptionResult & { site: any }> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true, name: true, code: true, autoGenerateElectricityExpense: true },
    });
    if (!site) throw new NotFoundException('Site not found');

    const assets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        siteId,
        status: { in: ['IN_SERVICE', 'UNDER_MAINTENANCE'] },
      },
      select: { type: true, powerConsumption: true, dutyCyclePercent: true },
    });

    const cfg = await this.getElectricityConfig(tenantId);
    const result = this.computeFromAssets(assets, cfg);
    return { ...result, site };
  }

  async computeRack(tenantId: string, rackId: string): Promise<ConsumptionResult & { rack: any }> {
    const rack = await this.prisma.rack.findFirst({
      where: { id: rackId, tenantId },
      select: { id: true, name: true, siteId: true },
    });
    if (!rack) throw new NotFoundException('Rack not found');

    const assets = await this.prisma.asset.findMany({
      where: { tenantId, rackId },
      select: { type: true, powerConsumption: true, dutyCyclePercent: true },
    });

    const cfg = await this.getElectricityConfig(tenantId);
    const result = this.computeFromAssets(assets, cfg);
    return { ...result, rack };
  }

  async summary(tenantId: string) {
    const sites = await this.prisma.site.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        assets: {
          where: { status: { in: ['IN_SERVICE', 'UNDER_MAINTENANCE'] as any } },
          select: { type: true, powerConsumption: true, dutyCyclePercent: true },
        },
      },
    });

    const cfg = await this.getElectricityConfig(tenantId);

    const perSite = sites.map((site) => {
      const r = this.computeFromAssets(site.assets as any, cfg);
      return {
        site: { id: site.id, name: site.name, code: site.code },
        totalWatts: r.totalWatts,
        kWhMonth: r.kWhMonth,
        costMonth: r.costMonth,
        assetCount: r.assetCount,
      };
    });

    const totalWatts = perSite.reduce((sum, s) => sum + s.totalWatts, 0);
    const totalKWh = perSite.reduce((sum, s) => sum + s.kWhMonth, 0);
    const totalCost = perSite.reduce((sum, s) => sum + s.costMonth, 0);

    return {
      totals: {
        totalWatts: Math.round(totalWatts * 100) / 100,
        kWhMonth: Math.round(totalKWh * 100) / 100,
        costMonth: Math.round(totalCost * 100) / 100,
        currency: cfg.currency,
        costPerKwh: cfg.costPerKwh,
      },
      sites: perSite.sort((a, b) => b.totalWatts - a.totalWatts),
    };
  }
}
