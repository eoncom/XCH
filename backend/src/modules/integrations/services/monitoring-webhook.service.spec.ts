import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { MonitoringWebhookService } from './monitoring-webhook.service';
import { HealthAggregationService } from '../health-aggregation.service';

/**
 * S4 — MonitoringWebhookService unit tests.
 *
 * Focus:
 *   - Kuma payload parser (status 0/1/2/3 → down/up/unknown/maintenance)
 *   - Gatus payload parser (resolved/triggered booleans + string variants)
 *   - Routing flow: persists ConnectivityLink status + invokes
 *     HealthAggregationService.calculateSiteHealth()
 *   - Webhook secret validation (forbidden when mismatch)
 *
 * Prisma & HealthAggregationService are stubbed with hand-rolled jest mocks;
 * jest-mock-extended is not currently a dependency.
 */
describe('MonitoringWebhookService', () => {
  let service: MonitoringWebhookService;
  let prisma: jest.Mocked<PrismaClient>;
  let healthAgg: jest.Mocked<HealthAggregationService>;
  let config: jest.Mocked<ConfigService>;

  const buildSiteRow = () => ({
    id: 'site-1',
    name: 'Alto',
    code: 'ALTO',
    metadata: {},
    assets: [],
    connectivityLinks: [
      {
        id: 'link-1',
        siteId: 'site-1',
        role: 'PRIMARY',
        monitorName: '[ALTO] LINK Fibre',
        status: 'up',
      },
    ],
    sdwanConfig: null,
  });

  beforeEach(() => {
    prisma = {
      site: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      connectivityLink: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'link-1',
            siteId: 'site-1',
            role: 'PRIMARY',
            monitorName: '[ALTO] LINK Fibre',
            status: 'down',
          },
        ]),
      },
      asset: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as jest.Mocked<PrismaClient>;

    healthAgg = {
      updateCachedStatuses: jest.fn().mockReturnValue({ links: [] }),
      updateAssetMonitorStatus: jest.fn().mockReturnValue({}),
      calculateSiteHealth: jest.fn().mockReturnValue({
        overall: 'CRITICAL',
        timestamp: '2026-04-25T00:00:00Z',
        components: [],
      }),
    } as unknown as jest.Mocked<HealthAggregationService>;

    config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    service = new MonitoringWebhookService(prisma, healthAgg, config);
  });

  // ---------------- Payload normalization ----------------

  describe('Kuma payload parser', () => {
    it('parses status=0 (DOWN)', () => {
      const result = (service as any).normalizeKuma({
        monitor: { name: '[ALTO] LINK Fibre' },
        heartbeat: { status: 0, msg: 'connection refused', time: 0, ping: 12 },
      });
      expect(result).toMatchObject({
        monitorName: '[ALTO] LINK Fibre',
        status: 'down',
        responseTime: 12,
      });
    });

    it('parses status=1 (UP)', () => {
      const result = (service as any).normalizeKuma({
        monitor: { name: '[LYON] LINK SFR' },
        heartbeat: { status: 1, ping: 30 },
      });
      expect(result.status).toBe('up');
      expect(result.responseTime).toBe(30);
    });

    it('parses status=2 (PENDING) → unknown', () => {
      const result = (service as any).normalizeKuma({
        monitor: { name: '[ALTO] LINK Fibre' },
        heartbeat: { status: 2 },
      });
      expect(result.status).toBe('unknown');
    });

    it('parses status=3 (MAINTENANCE)', () => {
      const result = (service as any).normalizeKuma({
        monitor: { name: '[ALTO] LINK Fibre' },
        heartbeat: { status: 3 },
      });
      expect(result.status).toBe('maintenance');
    });

    it('returns null when monitor.name is missing', () => {
      expect((service as any).normalizeKuma({})).toBeNull();
      expect((service as any).normalizeKuma({ monitor: {} })).toBeNull();
    });

    it('defaults to "unknown" on out-of-range status code', () => {
      const result = (service as any).normalizeKuma({
        monitor: { name: 'foo' },
        heartbeat: { status: 99 },
      });
      expect(result.status).toBe('unknown');
    });
  });

  describe('Gatus payload parser', () => {
    it('parses resolved=true → up', () => {
      const r = (service as any).normalizeGatus({
        endpoint_name: '[ALTO] LINK Fibre',
        resolved: true,
      });
      expect(r.status).toBe('up');
      expect(r.monitorName).toBe('[ALTO] LINK Fibre');
    });

    it('parses resolved=false → down', () => {
      const r = (service as any).normalizeGatus({
        endpoint_name: '[ALTO] LINK Fibre',
        resolved: false,
      });
      expect(r.status).toBe('down');
    });

    it('parses triggered=true with no resolved key → down', () => {
      const r = (service as any).normalizeGatus({
        endpoint_name: '[ALTO] LINK Fibre',
        triggered: true,
      });
      expect(r.status).toBe('down');
    });

    it('accepts string booleans ("true"/"false")', () => {
      expect(
        (service as any).normalizeGatus({
          endpoint_name: 'x',
          resolved: 'true',
        }).status,
      ).toBe('up');
      expect(
        (service as any).normalizeGatus({
          endpoint_name: 'x',
          resolved: 'false',
        }).status,
      ).toBe('down');
    });

    it('falls back to payload.name when endpoint_name is missing', () => {
      const r = (service as any).normalizeGatus({
        name: 'fallback',
        resolved: true,
      });
      expect(r.monitorName).toBe('fallback');
    });

    it('returns null when no name field is present', () => {
      expect((service as any).normalizeGatus({ resolved: true })).toBeNull();
    });
  });

  // ---------------- Provider routing ----------------

  describe('normalizePayload provider switch', () => {
    it('routes to Kuma normalizer for provider="kuma"', () => {
      const result = (service as any).normalizePayload('kuma', {
        monitor: { name: 'x' },
        heartbeat: { status: 1 },
      });
      expect(result.status).toBe('up');
    });

    it('routes to Gatus normalizer for provider="gatus"', () => {
      const result = (service as any).normalizePayload('gatus', {
        endpoint_name: 'x',
        resolved: false,
      });
      expect(result.status).toBe('down');
    });

    it('returns null for unknown providers', () => {
      expect((service as any).normalizePayload('mystery', {})).toBeNull();
    });
  });

  // ---------------- End-to-end flow ----------------

  describe('processWebhook routing', () => {
    it('persists status + invokes HealthAggregation when payload is valid', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue(buildSiteRow());

      await service.processWebhook(
        'kuma',
        {},
        {
          monitor: { name: '[ALTO] LINK Fibre' },
          heartbeat: { status: 0 },
        },
      );

      expect(prisma.connectivityLink.updateMany).toHaveBeenCalledWith({
        where: { siteId: 'site-1', monitorName: '[ALTO] LINK Fibre' },
        data: { status: 'down' },
      });
      expect(healthAgg.calculateSiteHealth).toHaveBeenCalled();
      expect(prisma.site.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'site-1' },
          data: expect.objectContaining({ healthStatus: 'CRITICAL' }),
        }),
      );
    });

    it('skips silently when monitor name is malformed', async () => {
      await service.processWebhook(
        'kuma',
        {},
        {
          monitor: { name: 'unparseable-monitor-name' },
          heartbeat: { status: 1 },
        },
      );
      expect(prisma.site.findFirst).not.toHaveBeenCalled();
      expect(prisma.connectivityLink.updateMany).not.toHaveBeenCalled();
    });

    it('skips silently when payload is unrecognized', async () => {
      await service.processWebhook('kuma', {}, { random: 'noise' });
      expect(prisma.site.findFirst).not.toHaveBeenCalled();
    });

    it('skips silently when site code is unknown', async () => {
      (prisma.site.findFirst as jest.Mock).mockResolvedValue(null);
      await service.processWebhook(
        'kuma',
        {},
        {
          monitor: { name: '[NOPE] LINK Fibre' },
          heartbeat: { status: 0 },
        },
      );
      expect(prisma.connectivityLink.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---------------- Webhook secret ----------------

  describe('validateSecret', () => {
    it('skips validation when no secret configured', () => {
      (config.get as jest.Mock).mockReturnValue(undefined);
      expect(() =>
        (service as any).validateSecret({}),
      ).not.toThrow();
    });

    it('accepts a matching x-webhook-secret header', () => {
      (config.get as jest.Mock).mockReturnValue('s3cret');
      expect(() =>
        (service as any).validateSecret({ 'x-webhook-secret': 's3cret' }),
      ).not.toThrow();
    });

    it('rejects a missing or mismatched header', () => {
      (config.get as jest.Mock).mockReturnValue('s3cret');
      expect(() => (service as any).validateSecret({})).toThrow(
        ForbiddenException,
      );
      expect(() =>
        (service as any).validateSecret({ 'x-webhook-secret': 'wrong' }),
      ).toThrow(ForbiddenException);
    });
  });
});
