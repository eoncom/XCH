import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Hard cap for the number of sites loaded by a single summary() call.
 * Above that, the result becomes too large to serialize and the in-memory
 * include.assets blows up Node memory. The pilot has < 10 sites — this
 * cap is a defense-in-depth against pathological tenants. Frontend should
 * paginate via ?limit/offset for tenants approaching this number.
 */
const SUMMARY_SITE_CAP = 500;

export interface ConsumptionResult {
  totalWatts: number;
  kWhMonth: number;
  costMonth: number;
  currency: string;
  costPerKwh: number;
  /** Total assets linked (any status) — matches /dashboard/assets?siteId=X and the site detail tab. */
  assetCount: number;
  /** Active-only subset (IN_SERVICE / UNDER_MAINTENANCE) used for the watts/kWh computation. */
  activeAssetCount: number;
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
    // ADR-018 — typed table TenantElectricityConfig replaces tenant.config.electricity.
    const cfg = await this.prisma.tenantElectricityConfig.findUnique({
      where: { tenantId },
    });
    return {
      costPerKwh: cfg ? Number(cfg.costPerKwh) : 0.20,
      currency: cfg?.currency || 'EUR',
    };
  }

  private computeFromAssets(
    assets: Array<{ type: string; status?: string; powerConsumption: number | null; dutyCyclePercent: number }>,
    cfg: TenantElectricityConfig,
  ): ConsumptionResult {
    let totalWatts = 0;
    let activeAssetCount = 0;
    const byType: Record<string, { watts: number; count: number }> = {};
    // Only active-state assets contribute to the watts sum. The `assetCount`
    // reflects EVERY asset linked regardless of status so the figure matches
    // the other pages (user spec "tous les équipements qui appartiennent au site").
    const ACTIVE_STATUSES = new Set(['IN_SERVICE', 'UNDER_MAINTENANCE']);

    for (const asset of assets) {
      const isActive = asset.status ? ACTIVE_STATUSES.has(asset.status) : true;
      if (!isActive) continue;
      activeAssetCount++;
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
      activeAssetCount,
      byType,
    };
  }

  async computeSite(tenantId: string, siteId: string): Promise<ConsumptionResult & { site: any }> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
      select: { id: true, name: true, code: true, autoGenerateElectricityExpense: true },
    });
    if (!site) throw new NotFoundException('Site not found');

    // v1.4.x — we count ALL assets linked to the site so the value matches the
    // "Équipements" tab on the site detail page and the `/dashboard/assets`
    // filtered view. The consumption MATH still only weights IN_SERVICE /
    // UNDER_MAINTENANCE assets (see computeFromAssetsScoped below) — broken
    // or retired hardware doesn't consume.
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, siteId },
      select: { type: true, status: true, powerConsumption: true, dutyCyclePercent: true },
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

  async summary(
    tenantId: string,
    opts: { limit?: number; offset?: number } = {},
  ) {
    // Hard-cap : un tenant pathologique avec >500 sites bloquait le serveur
    // (50k+ assets en mémoire via include.assets). Cap forcé même si l'user
    // demande plus.
    const limit = Math.min(opts.limit ?? SUMMARY_SITE_CAP, SUMMARY_SITE_CAP);
    const offset = Math.max(opts.offset ?? 0, 0);

    if (limit < 1) {
      throw new BadRequestException('limit must be >= 1');
    }

    const totalSites = await this.prisma.site.count({ where: { tenantId } });

    const sites = await this.prisma.site.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        assets: {
          // v1.4.x — include all linked assets (any status) so the per-site
          // Assets column matches the Équipements page filtered by site.
          // Active-only filter now lives in computeFromAssets().
          select: { type: true, status: true, powerConsumption: true, dutyCyclePercent: true },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
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
        activeAssetCount: r.activeAssetCount,
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
      // Les totals reflètent uniquement la page courante. Pour un tenant
      // au-dessus du cap, le frontend doit paginer pour obtenir l'agrégat
      // complet (ou un endpoint SQL agrégé sera ajouté plus tard).
      meta: {
        totalSites,
        returned: perSite.length,
        limit,
        offset,
        truncated: totalSites > offset + perSite.length,
      },
    };
  }
}
