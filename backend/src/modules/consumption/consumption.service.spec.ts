import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConsumptionService } from './consumption.service';

/**
 * S4 — ConsumptionService unit tests.
 *
 * Math under test (computeFromAssets, called by computeSite/computeRack/summary):
 *   - watts = powerConsumption * (dutyCyclePercent / 100)
 *   - kWh/month = (totalWatts * 24 * 30) / 1000
 *   - cost/month = kWh/month * tenant.config.electricity.costPerKwh
 *   - active filter: only IN_SERVICE / UNDER_MAINTENANCE contribute to watts
 *     (every linked asset still counts in `assetCount`)
 *   - default costPerKwh = 0.20 EUR when tenant.config.electricity is missing
 */
describe('ConsumptionService', () => {
  let service: ConsumptionService;
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      site: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      rack: { findFirst: jest.fn() },
      asset: { findMany: jest.fn() },
    } as unknown as jest.Mocked<PrismaClient>;

    service = new ConsumptionService(prisma);
  });

  // ----------------------------------------------------------------
  // computeSite — happy path & math
  // ----------------------------------------------------------------

  describe('computeSite', () => {
    it('throws NotFoundException when site does not exist', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.computeSite('t1', 'site-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('computes watts/kWh/cost for active assets only', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'Alto',
        code: 'ALTO',
        autoGenerateElectricityExpense: false,
      });
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        config: { electricity: { costPerKwh: 0.25, currency: 'EUR' } },
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([
        // Active server: 100W @ 80% = 80W
        {
          type: 'SERVER',
          status: 'IN_SERVICE',
          powerConsumption: 100,
          dutyCyclePercent: 80,
        },
        // Active switch under maintenance: 50W @ 100% = 50W
        {
          type: 'SWITCH',
          status: 'UNDER_MAINTENANCE',
          powerConsumption: 50,
          dutyCyclePercent: 100,
        },
        // Retired — must be skipped from watts but counted in assetCount.
        {
          type: 'SERVER',
          status: 'RETIRED',
          powerConsumption: 1000,
          dutyCyclePercent: 100,
        },
        // Active asset with no power data — counts as active asset, no watts.
        {
          type: 'ROUTER',
          status: 'IN_SERVICE',
          powerConsumption: null,
          dutyCyclePercent: 100,
        },
      ]);

      const result = await service.computeSite('t1', 's1');

      expect(result.totalWatts).toBe(130);
      // 130W * 24 * 30 / 1000 = 93.6 kWh
      expect(result.kWhMonth).toBe(93.6);
      // 93.6 * 0.25 = 23.4
      expect(result.costMonth).toBe(23.4);
      expect(result.costPerKwh).toBe(0.25);
      expect(result.currency).toBe('EUR');
      expect(result.assetCount).toBe(4); // every asset linked to the site
      expect(result.activeAssetCount).toBe(3); // RETIRED excluded
      expect(result.byType?.SERVER).toEqual({ watts: 80, count: 1 });
      expect(result.byType?.SWITCH).toEqual({ watts: 50, count: 1 });
      // ROUTER has no powerConsumption so byType is not populated for it
      expect(result.byType?.ROUTER).toBeUndefined();
    });

    it('falls back to costPerKwh=0.20 EUR when tenant config is missing', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'X',
        code: 'X',
      });
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ config: {} });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([
        {
          type: 'SERVER',
          status: 'IN_SERVICE',
          powerConsumption: 100,
          dutyCyclePercent: 100,
        },
      ]);

      const result = await service.computeSite('t1', 's1');
      expect(result.costPerKwh).toBe(0.2);
      expect(result.currency).toBe('EUR');
      // 100W -> 72 kWh -> 14.4 EUR
      expect(result.costMonth).toBe(14.4);
    });

    it('zero-power assets keep totalWatts=0 but assetCount intact', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'X',
        code: 'X',
      });
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ config: {} });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([
        {
          type: 'PATCH_PANEL',
          status: 'IN_SERVICE',
          powerConsumption: 0,
          dutyCyclePercent: 100,
        },
      ]);

      const result = await service.computeSite('t1', 's1');
      expect(result.totalWatts).toBe(0);
      expect(result.kWhMonth).toBe(0);
      expect(result.costMonth).toBe(0);
      expect(result.assetCount).toBe(1);
      expect(result.activeAssetCount).toBe(1);
    });

    it('honours dutyCyclePercent below 100', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'X',
        code: 'X',
      });
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        config: { electricity: { costPerKwh: 1, currency: 'EUR' } },
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([
        {
          type: 'UPS',
          status: 'IN_SERVICE',
          powerConsumption: 200,
          dutyCyclePercent: 25,
        },
      ]);
      const result = await service.computeSite('t1', 's1');
      expect(result.totalWatts).toBe(50); // 200 * 0.25
    });
  });

  // ----------------------------------------------------------------
  // computeRack — relies on the same math, asserts plumbing.
  // ----------------------------------------------------------------

  describe('computeRack', () => {
    it('throws NotFoundException when rack does not exist', async () => {
      (prisma.rack.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.computeRack('t1', 'rack-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('computes consumption from rack-scoped assets', async () => {
      (prisma.rack.findFirst as jest.Mock).mockResolvedValue({
        id: 'r1',
        name: 'R1',
        siteId: 's1',
      });
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        config: { electricity: { costPerKwh: 0.2, currency: 'EUR' } },
      });
      (prisma.asset.findMany as jest.Mock).mockResolvedValue([
        // computeRack does NOT select status, so the active filter
        // defaults to "treat every asset as active" — covered below.
        { type: 'SERVER', powerConsumption: 100, dutyCyclePercent: 50 },
      ]);

      const result = await service.computeRack('t1', 'r1');
      expect(result.totalWatts).toBe(50);
      expect(result.activeAssetCount).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // summary — multi-site rollup
  // ----------------------------------------------------------------

  describe('summary', () => {
    it('aggregates per-site totals and sorts by watts descending', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        config: { electricity: { costPerKwh: 0.2, currency: 'EUR' } },
      });
      (prisma.site.count as jest.Mock).mockResolvedValue(2);
      (prisma.site.findMany as jest.Mock).mockResolvedValue([
        {
          id: 's-small',
          name: 'Small',
          code: 'S',
          assets: [
            {
              type: 'SERVER',
              status: 'IN_SERVICE',
              powerConsumption: 50,
              dutyCyclePercent: 100,
            },
          ],
        },
        {
          id: 's-big',
          name: 'Big',
          code: 'B',
          assets: [
            {
              type: 'SERVER',
              status: 'IN_SERVICE',
              powerConsumption: 200,
              dutyCyclePercent: 100,
            },
          ],
        },
      ]);

      const result = await service.summary('t1');

      // Sorted by totalWatts desc → big first
      expect(result.sites[0].site.code).toBe('B');
      expect(result.sites[0].totalWatts).toBe(200);
      expect(result.sites[1].totalWatts).toBe(50);
      // Aggregated totals: 250W, 180kWh, 36 EUR
      expect(result.totals.totalWatts).toBe(250);
      expect(result.totals.kWhMonth).toBe(180);
      expect(result.totals.costMonth).toBe(36);
      // Pagination meta (S1 hardening — cap 500 sites + truncated flag)
      expect(result.meta.totalSites).toBe(2);
      expect(result.meta.returned).toBe(2);
      expect(result.meta.truncated).toBe(false);
    });

    it('honors limit + offset with truncated flag when totalSites > returned', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ config: {} });
      (prisma.site.count as jest.Mock).mockResolvedValue(150);
      (prisma.site.findMany as jest.Mock).mockResolvedValue([
        { id: 's1', name: 'Site 1', code: 'A', assets: [] },
      ]);

      const result = await service.summary('t1', { limit: 1, offset: 0 });

      expect(result.meta.totalSites).toBe(150);
      expect(result.meta.returned).toBe(1);
      expect(result.meta.limit).toBe(1);
      expect(result.meta.truncated).toBe(true);
      // Vérifie que findMany a bien reçu take + skip
      expect((prisma.site.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
        take: 1,
        skip: 0,
      });
    });

    it('caps limit to SUMMARY_SITE_CAP (500) even if a higher value is requested', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ config: {} });
      (prisma.site.count as jest.Mock).mockResolvedValue(10);
      (prisma.site.findMany as jest.Mock).mockResolvedValue([]);

      await service.summary('t1', { limit: 10000 });

      expect((prisma.site.findMany as jest.Mock).mock.calls[0][0].take).toBe(500);
    });
  });
});
