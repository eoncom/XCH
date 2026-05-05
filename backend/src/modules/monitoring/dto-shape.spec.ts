import { ConnectivityRole, HttpMethod, MonitorKind, MonitorStatus, SeverityLevel } from '@prisma/client';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { MonitorCheckResponseDto } from './dto/monitor-check.response.dto';
import {
  MonitorHistoryItemResponseDto,
  MonitorHistoryResponseDto,
} from './dto/monitor-history-item.response.dto';
import {
  MonitorSummaryResponseDto,
  toMonitorSummaryResponseDto,
} from './dto/monitor-summary.response.dto';
import { AutoDisabledStatusResponseDto } from './dto/auto-disabled-status.response.dto';

/**
 * S9 ADR-023 — Response DTO shape verification.
 *
 * Inclusion-style assertions: every legitimate field is checked positively
 * (`toHaveProperty`), and every field that must NOT leak is checked
 * negatively (`not.toHaveProperty`). No `toMatchSnapshot` — snapshot diffs
 * are opaque to reviewers, while explicit assertions force any future drift
 * (added/removed property) to be acknowledged on the line that names it.
 *
 * The same shape every endpoint returns is what consumers depend on, so
 * regressions here ARE breaking changes.
 */
describe('Monitoring response DTO shapes', () => {
  describe('MonitorCheckResponseDto (Cas C — Prisma + relations via @Type)', () => {
    const prismaLikeCheck = {
      id: 'chk-1',
      tenantId: 'tnt-1',
      siteId: null,
      assetId: 'ast-1',
      linkId: null,
      kind: MonitorKind.HTTP,
      target: 'https://example.com/health',
      targetPort: null,
      intervalSec: 300,
      enabled: true,
      lastCheckedAt: new Date('2026-05-04T10:00:00Z'),
      nextCheckAt: new Date('2026-05-04T10:05:00Z'),
      lastStatus: MonitorStatus.UP,
      severity: SeverityLevel.WARNING,
      createdById: 'usr-1',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
      // Extraneous Prisma columns NOT exposed in the DTO.
      _internalCounter: 42,
      passwordHash: 'should-never-leak',
      httpConfig: {
        id: 'cfg-1',
        checkId: 'chk-1',
        method: HttpMethod.GET,
        expectedStatus: 200,
        expectedBodyContains: 'ok',
        followRedirects: true,
        timeoutMs: 5000,
        // Extraneous on the embedded relation.
        _hiddenFromClient: 'leak',
      },
      site: null,
      asset: {
        id: 'ast-1',
        name: 'Tour Alto',
        type: 'firewall',
        siteId: 'site-1',
        site: { id: 'site-1', name: 'Saclay', code: 'SAC' },
      },
      link: null,
    };

    const dto = toResponse(MonitorCheckResponseDto, prismaLikeCheck);

    it('exposes scalar columns', () => {
      expect(dto).toHaveProperty('id', 'chk-1');
      expect(dto).toHaveProperty('tenantId', 'tnt-1');
      expect(dto).toHaveProperty('kind', MonitorKind.HTTP);
      expect(dto).toHaveProperty('target', 'https://example.com/health');
      expect(dto).toHaveProperty('intervalSec', 300);
      expect(dto).toHaveProperty('enabled', true);
      expect(dto).toHaveProperty('lastStatus', MonitorStatus.UP);
      expect(dto).toHaveProperty('severity', SeverityLevel.WARNING);
      expect(dto).toHaveProperty('createdAt');
      expect(dto).toHaveProperty('updatedAt');
    });

    it('preserves nullable polymorphic foreign keys', () => {
      expect(dto.siteId).toBeNull();
      expect(dto).toHaveProperty('assetId', 'ast-1');
      expect(dto.linkId).toBeNull();
    });

    it('embeds httpConfig with @Type-mapped sub-DTO', () => {
      expect(dto.httpConfig).toBeDefined();
      expect(dto.httpConfig).toHaveProperty('id', 'cfg-1');
      expect(dto.httpConfig).toHaveProperty('method', HttpMethod.GET);
      expect(dto.httpConfig).toHaveProperty('expectedStatus', 200);
      expect(dto.httpConfig).toHaveProperty('followRedirects', true);
      expect(dto.httpConfig).toHaveProperty('timeoutMs', 5000);
    });

    it('strips extraneous fields from embedded relations', () => {
      expect(dto.httpConfig).not.toHaveProperty('_hiddenFromClient');
    });

    it('embeds asset reference with nested site', () => {
      expect(dto.asset).toBeDefined();
      expect(dto.asset).toHaveProperty('id', 'ast-1');
      expect(dto.asset).toHaveProperty('name', 'Tour Alto');
      expect(dto.asset?.site).toHaveProperty('code', 'SAC');
    });

    it('drops absent relations as null without leaking sentinel', () => {
      expect(dto.site).toBeNull();
      expect(dto.link).toBeNull();
    });

    it('does NOT expose extraneous Prisma columns or sensitive flags', () => {
      expect(dto).not.toHaveProperty('_internalCounter');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenant'); // raw relation skipped
      expect(dto).not.toHaveProperty('results'); // raw relation skipped
    });
  });

  describe('MonitorHistoryItemResponseDto + MonitorHistoryResponseDto (Cas C — paginated)', () => {
    const prismaLikePage = {
      items: [
        {
          id: 'res-1',
          checkId: 'chk-1',
          status: MonitorStatus.UP,
          responseMs: 42,
          error: null,
          checkedAt: new Date('2026-05-04T09:55:00Z'),
          // Extraneous Prisma column.
          _bull_meta: { jobId: 'job-99' },
        },
        {
          id: 'res-2',
          checkId: 'chk-1',
          status: MonitorStatus.DOWN,
          responseMs: null,
          error: 'ECONNREFUSED',
          checkedAt: new Date('2026-05-04T09:50:00Z'),
        },
      ],
      limit: 50,
      nextCursor: 'opaque-base64-cursor',
      hasNext: true,
    };

    it('item DTO exposes the result columns', () => {
      const items = toResponseArray(MonitorHistoryItemResponseDto, prismaLikePage.items);
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveProperty('id', 'res-1');
      expect(items[0]).toHaveProperty('checkId', 'chk-1');
      expect(items[0]).toHaveProperty('status', MonitorStatus.UP);
      expect(items[0]).toHaveProperty('responseMs', 42);
      expect(items[0]).toHaveProperty('checkedAt');
      expect(items[1]).toHaveProperty('status', MonitorStatus.DOWN);
      expect(items[1].responseMs).toBeNull();
    });

    it('item DTO strips extraneous Prisma metadata', () => {
      const items = toResponseArray(MonitorHistoryItemResponseDto, prismaLikePage.items);
      expect(items[0]).not.toHaveProperty('_bull_meta');
    });

    it('paginated envelope preserves cursor + flags + maps items', () => {
      const page = toResponse(MonitorHistoryResponseDto, prismaLikePage);
      expect(page).toHaveProperty('limit', 50);
      expect(page).toHaveProperty('nextCursor', 'opaque-base64-cursor');
      expect(page).toHaveProperty('hasNext', true);
      expect(page.items).toHaveLength(2);
      expect(page.items[0]).toHaveProperty('id', 'res-1');
      // The paginated wrapper must NOT leak the underlying array element's
      // raw extraneous fields either.
      expect(page.items[0]).not.toHaveProperty('_bull_meta');
    });
  });

  describe('toMonitorSummaryResponseDto (Cas B — helper for $queryRaw bigint rows)', () => {
    it('coerces bigint to number and computes uptime', () => {
      const summary = toMonitorSummaryResponseDto([
        { window: '24h', total: 288n, up: 280n },
        { window: '7d', total: 2016n, up: 1900n },
        { window: '30d', total: 8640n, up: 8500n },
      ]);
      expect(summary).toHaveProperty('24h');
      expect(summary['24h']).toEqual({ total: 288, up: 280, uptime: 97.22 });
      expect(summary['7d']).toEqual({ total: 2016, up: 1900, uptime: 94.25 });
      expect(summary['30d'].total).toBe(8640);
      expect(summary['30d'].uptime).toBeCloseTo(98.38, 2);
    });

    it('returns uptime: null when total = 0 (window with no probes)', () => {
      const summary = toMonitorSummaryResponseDto([
        { window: '24h', total: 0n, up: 0n },
      ]);
      expect(summary['24h']).toEqual({ total: 0, up: 0, uptime: null });
    });

    it('produces a shape Swagger / consumers can rely on (3 windows top-level)', () => {
      const summary = toMonitorSummaryResponseDto([
        { window: '24h', total: 1n, up: 1n },
        { window: '7d', total: 1n, up: 1n },
        { window: '30d', total: 1n, up: 1n },
      ]);
      const dto: MonitorSummaryResponseDto = summary;
      expect(Object.keys(dto)).toEqual(expect.arrayContaining(['24h', '7d', '30d']));
    });
  });

  describe('AutoDisabledStatusResponseDto (Cas B — composite from 3 queries)', () => {
    const composite = {
      disabledMonitors: [
        { id: 'm1', target: '10.0.0.1', targetPort: null, kind: MonitorKind.ICMP },
        { id: 'm2', target: '10.0.0.2', targetPort: 22, kind: MonitorKind.TCP },
      ],
      acknowledged: false,
      // Extraneous from internal computation.
      _latestDisableTimestamp: new Date('2026-05-04T08:00:00Z'),
      _latestAckTimestamp: null,
    };

    it('exposes disabledMonitors array + acknowledged flag', () => {
      const dto = toResponse(AutoDisabledStatusResponseDto, composite);
      expect(dto).toHaveProperty('acknowledged', false);
      expect(dto.disabledMonitors).toHaveLength(2);
      expect(dto.disabledMonitors[0]).toHaveProperty('id', 'm1');
      expect(dto.disabledMonitors[0]).toHaveProperty('kind', MonitorKind.ICMP);
      expect(dto.disabledMonitors[1]).toHaveProperty('targetPort', 22);
    });

    it('strips extraneous internal-only fields', () => {
      const dto = toResponse(AutoDisabledStatusResponseDto, composite);
      expect(dto).not.toHaveProperty('_latestDisableTimestamp');
      expect(dto).not.toHaveProperty('_latestAckTimestamp');
    });

    it('asserts the rolling rule: no consumer should see "fields named hash/secret/internal*"', () => {
      const dto = toResponse(AutoDisabledStatusResponseDto, {
        ...composite,
        passwordHash: 'leak-attempt',
        secretKey: 'leak-attempt',
        internalScore: 99,
      });
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('secretKey');
      expect(dto).not.toHaveProperty('internalScore');
    });
  });
});
