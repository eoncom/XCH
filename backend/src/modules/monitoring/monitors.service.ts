import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, MonitorKind, MonitorStatus, Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  CreateMonitorCheckDto,
  UpdateMonitorCheckDto,
  FilterMonitorCheckDto,
  HistoryQueryDto,
} from './dto/create-monitor-check.dto';
import { validateTarget } from './probes/target-validator';
import { MONITOR_QUEUE, JOB_PROBE } from './monitor.scheduler';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';

// S5 PR4 R1 — Keyset cursor encode/decode pour MonitorResult history.
// Format : base64url("<iso checkedAt>|<id>"). Opaque côté client.
export function encodeHistoryCursor(checkedAt: Date, id: string): string {
  return Buffer.from(`${checkedAt.toISOString()}|${id}`, 'utf8').toString(
    'base64url',
  );
}

export function decodeHistoryCursor(
  cursor: string,
): { checkedAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = decoded.lastIndexOf('|');
    if (sep < 0) return null;
    const isoAt = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    const checkedAt = new Date(isoAt);
    if (Number.isNaN(checkedAt.getTime()) || !id) return null;
    return { checkedAt, id };
  } catch {
    return null;
  }
}

// Includes the parent's site too — needed by the UI to group / display
// "Site Tour Alto" even when the check is rattaché to an asset or a link.
const CHECK_INCLUDE = {
  httpConfig: true,
  site: { select: { id: true, name: true, code: true, delegationId: true } },
  asset: {
    select: {
      id: true,
      name: true,
      type: true,
      siteId: true,
      site: { select: { id: true, name: true, code: true } },
    },
  },
  link: {
    select: {
      id: true,
      role: true,
      provider: true,
      type: true,
      siteId: true,
      site: { select: { id: true, name: true, code: true } },
    },
  },
};

@Injectable()
export class MonitorsService {
  constructor(
    private prisma: PrismaClient,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
    private perm: PermissionService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────
  async create(tenantId: string, userId: string, dto: CreateMonitorCheckDto) {
    this.requireExactlyOneTarget(dto);

    if (dto.kind === MonitorKind.TCP && !dto.targetPort) {
      throw new BadRequestException('TCP probes require a targetPort');
    }
    if (dto.kind !== MonitorKind.TCP && dto.targetPort != null) {
      throw new BadRequestException('targetPort is only valid for kind=TCP');
    }
    if (dto.kind !== MonitorKind.HTTP && dto.httpConfig) {
      throw new BadRequestException('httpConfig is only valid for kind=HTTP');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { allowInternalNetworkTargets: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const validation = validateTarget(dto.target, dto.kind, tenant.allowInternalNetworkTargets);
    if (!validation.ok) {
      throw new BadRequestException(`Invalid target: ${validation.reason}`);
    }

    // Verify the parent entity exists and belongs to the tenant.
    await this.assertParentTenantOwnership(tenantId, dto);

    // Insert check + (optional) http config in a single transaction.
    const created = await this.prisma.$transaction(async (tx) => {
      const check = await tx.monitorCheck.create({
        data: {
          tenantId,
          siteId: dto.siteId ?? null,
          assetId: dto.assetId ?? null,
          linkId: dto.linkId ?? null,
          kind: dto.kind,
          target: dto.target,
          targetPort: dto.targetPort ?? null,
          intervalSec: dto.intervalSec ?? 300,
          enabled: dto.enabled ?? true,
          severity: dto.severity, // undefined → Prisma default (WARNING)
          createdById: userId,
          // First probe runs at next scheduler tick (≤ 30s).
          nextCheckAt: new Date(),
        },
      });
      if (dto.kind === MonitorKind.HTTP && dto.httpConfig) {
        await tx.monitorHttpConfig.create({
          data: {
            checkId: check.id,
            method: dto.httpConfig.method,
            expectedStatus: dto.httpConfig.expectedStatus,
            expectedBodyContains: dto.httpConfig.expectedBodyContains,
            followRedirects: dto.httpConfig.followRedirects,
            timeoutMs: dto.httpConfig.timeoutMs,
          },
        });
      }
      return check;
    });

    return this.findOne(tenantId, created.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────────
  async findAll(
    tenantId: string,
    filters: FilterMonitorCheckDto,
    accessibleSiteIds: string[] | null,
  ) {
    const where: Prisma.MonitorCheckWhereInput = { tenantId };
    if (filters.assetId) where.assetId = filters.assetId;
    if (filters.linkId) where.linkId = filters.linkId;
    if (filters.kind) where.kind = filters.kind;
    if (filters.enabled !== undefined) where.enabled = filters.enabled;

    // ADR-016 follow-up — `?siteId=X` is inclusive: catches checks attached
    // directly to the site, AND via an asset on that site, AND via a link
    // on that site (the "Surveillance" tab on a site detail page would
    // otherwise miss most of its monitors).
    const siteFilter = filters.siteId;

    // Combine site filter and access scoping: both contribute the same
    // OR-on-effective-site shape. Intersect with the user's accessible scope.
    let effectiveSiteIds: string[] | null = null;
    if (accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      effectiveSiteIds = siteFilter
        ? accessibleSiteIds.filter((id) => id === siteFilter)
        : accessibleSiteIds;
      if (effectiveSiteIds.length === 0) return [];
    } else if (siteFilter) {
      effectiveSiteIds = [siteFilter];
    }

    if (effectiveSiteIds !== null) {
      where.OR = [
        { siteId: { in: effectiveSiteIds } },
        { asset: { siteId: { in: effectiveSiteIds } } },
        { link: { siteId: { in: effectiveSiteIds } } },
      ];
    }

    return this.prisma.monitorCheck.findMany({
      where,
      include: CHECK_INCLUDE,
      orderBy: [{ enabled: 'desc' }, { lastCheckedAt: 'desc' }],
    });
  }

  async findOne(tenantId: string, id: string, callerCtx?: CallerCtx) {
    const check = await this.prisma.monitorCheck.findFirst({
      where: { id, tenantId },
      include: CHECK_INCLUDE,
    });
    if (!check) throw new NotFoundException('Monitor check not found');

    // ADR-021 — guess-by-id defense. MonitorCheck is polymorphic
    // (siteId | assetId | linkId — exactly one). Resolve the effective siteId
    // from whichever parent is set; if all are null (rare misformed row),
    // skip the assertion rather than refuse.
    if (callerCtx) {
      const resolvedSiteId =
        check.siteId ?? check.asset?.siteId ?? check.link?.siteId ?? null;
      if (resolvedSiteId) {
        await this.perm.assertCanReadSite(callerCtx, resolvedSiteId);
      }
    }

    return check;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────
  async update(tenantId: string, id: string, dto: UpdateMonitorCheckDto, callerCtx?: CallerCtx) {
    const existing = await this.prisma.monitorCheck.findFirst({
      where: { id, tenantId },
      include: {
        httpConfig: true,
        asset: { select: { siteId: true } },
        link: { select: { siteId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Monitor check not found');

    // ADR-021 — write access on the resolved parent site.
    if (callerCtx) {
      const resolvedSiteId =
        existing.siteId ?? existing.asset?.siteId ?? existing.link?.siteId ?? null;
      if (resolvedSiteId) {
        await this.perm.assertCanWriteSite(callerCtx, resolvedSiteId);
      }
    }

    // Don't allow re-targeting (changing siteId/assetId/linkId) — would break
    // history continuity. To re-target, the user deletes and recreates.
    if (
      (dto.siteId && dto.siteId !== existing.siteId) ||
      (dto.assetId && dto.assetId !== existing.assetId) ||
      (dto.linkId && dto.linkId !== existing.linkId)
    ) {
      throw new BadRequestException(
        'Cannot re-target an existing monitor check (delete + recreate instead)',
      );
    }

    const newKind = dto.kind ?? existing.kind;
    const newTarget = dto.target ?? existing.target;
    const newPort = dto.targetPort !== undefined ? dto.targetPort : existing.targetPort;

    if (newKind === MonitorKind.TCP && !newPort) {
      throw new BadRequestException('TCP probes require a targetPort');
    }
    if (newKind !== MonitorKind.TCP && newPort != null) {
      throw new BadRequestException('targetPort is only valid for kind=TCP');
    }

    if (dto.target || dto.kind) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { allowInternalNetworkTargets: true },
      });
      const validation = validateTarget(newTarget, newKind, tenant!.allowInternalNetworkTargets);
      if (!validation.ok) {
        throw new BadRequestException(`Invalid target: ${validation.reason}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.monitorCheck.update({
        where: { id },
        data: {
          kind: dto.kind,
          target: dto.target,
          targetPort: dto.targetPort,
          intervalSec: dto.intervalSec,
          enabled: dto.enabled,
          severity: dto.severity, // undefined → unchanged (Prisma semantics)
        },
      });

      // Handle httpConfig upsert/delete based on new kind.
      if (newKind === MonitorKind.HTTP && dto.httpConfig) {
        await tx.monitorHttpConfig.upsert({
          where: { checkId: id },
          create: {
            checkId: id,
            method: dto.httpConfig.method,
            expectedStatus: dto.httpConfig.expectedStatus,
            expectedBodyContains: dto.httpConfig.expectedBodyContains,
            followRedirects: dto.httpConfig.followRedirects,
            timeoutMs: dto.httpConfig.timeoutMs,
          },
          update: {
            method: dto.httpConfig.method,
            expectedStatus: dto.httpConfig.expectedStatus,
            expectedBodyContains: dto.httpConfig.expectedBodyContains,
            followRedirects: dto.httpConfig.followRedirects,
            timeoutMs: dto.httpConfig.timeoutMs,
          },
        });
      } else if (newKind !== MonitorKind.HTTP && existing.httpConfig) {
        await tx.monitorHttpConfig.delete({ where: { checkId: id } });
      }
    });

    return this.findOne(tenantId, id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string, callerCtx?: CallerCtx) {
    const existing = await this.prisma.monitorCheck.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        siteId: true,
        asset: { select: { siteId: true } },
        link: { select: { siteId: true } },
      },
    });
    if (!existing) throw new NotFoundException('Monitor check not found');

    // ADR-021 — write access on the resolved parent site.
    if (callerCtx) {
      const resolvedSiteId =
        existing.siteId ?? existing.asset?.siteId ?? existing.link?.siteId ?? null;
      if (resolvedSiteId) {
        await this.perm.assertCanWriteSite(callerCtx, resolvedSiteId);
      }
    }

    // Cascade deletes httpConfig and results via Prisma onDelete: Cascade.
    await this.prisma.monitorCheck.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────────────
  // S5 PR4 R1 — Keyset pagination (remplace OFFSET).
  //
  // Avant : findMany skip:offset + count séparés. À 1M rows monitor_results
  //   et page 100 (offset=5000), Postgres devait scanner 5000 lignes
  //   inutilement avant le LIMIT. count() faisait un full scan en plus.
  //
  // Maintenant : keyset cursor sur (checkedAt DESC, id DESC). Le client
  //   passe le dernier `(checkedAt, id)` vu en cursor opaque base64. Une
  //   seule findMany Index Range Scan, plus de count, terminée en O(limit)
  //   peu importe la profondeur de pagination.
  //
  // L'index (checkId, checkedAt DESC) existe déjà — couvre exactement la
  // query avec ordering.
  //
  // Breaking interne sur l'API : `offset` retiré, `cursor` ajouté.
  // `total` retiré du retour, `nextCursor` + `hasNext` ajoutés. Frontend
  // XCH unique consommateur documenté → pas de bump major.
  async history(tenantId: string, id: string, query: HistoryQueryDto) {
    await this.assertCheckTenantOwnership(tenantId, id);
    const limit = query.limit ?? 50;
    const where: Prisma.MonitorResultWhereInput = { checkId: id };
    if (query.status && Object.values(MonitorStatus).includes(query.status as MonitorStatus)) {
      where.status = query.status as MonitorStatus;
    }

    if (query.cursor) {
      const decoded = decodeHistoryCursor(query.cursor);
      if (!decoded) {
        throw new BadRequestException('Invalid history cursor');
      }
      // Strictement APRÈS (= plus ancien que) le cursor : (checkedAt, id) < (cursorAt, cursorId)
      where.AND = [
        {
          OR: [
            { checkedAt: { lt: decoded.checkedAt } },
            {
              AND: [
                { checkedAt: decoded.checkedAt },
                { id: { lt: decoded.id } },
              ],
            },
          ],
        },
      ];
    }

    // +1 pour détecter hasNext sans query supplémentaire
    const items = await this.prisma.monitorResult.findMany({
      where,
      orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasNext = items.length > limit;
    if (hasNext) items.pop();
    const last = items[items.length - 1];
    const nextCursor =
      hasNext && last ? encodeHistoryCursor(last.checkedAt, last.id) : null;
    return { items, limit, nextCursor, hasNext };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY (uptime % over rolling windows)
  // ─────────────────────────────────────────────────────────────────────────
  async summary(tenantId: string, id: string) {
    await this.assertCheckTenantOwnership(tenantId, id);

    const rows = await this.prisma.$queryRaw<
      Array<{ window: string; total: bigint; up: bigint }>
    >(Prisma.sql`
      SELECT '24h'  AS window,
             COUNT(*)::bigint AS total,
             COUNT(*) FILTER (WHERE status = 'UP')::bigint AS up
        FROM "monitor_results"
       WHERE "checkId" = ${id}
         AND "checkedAt" > now() - interval '24 hours'
      UNION ALL
      SELECT '7d'   AS window,
             COUNT(*)::bigint, COUNT(*) FILTER (WHERE status = 'UP')::bigint
        FROM "monitor_results"
       WHERE "checkId" = ${id}
         AND "checkedAt" > now() - interval '7 days'
      UNION ALL
      SELECT '30d'  AS window,
             COUNT(*)::bigint, COUNT(*) FILTER (WHERE status = 'UP')::bigint
        FROM "monitor_results"
       WHERE "checkId" = ${id}
         AND "checkedAt" > now() - interval '30 days'
    `);

    const out: Record<string, { total: number; up: number; uptime: number | null }> = {};
    for (const r of rows) {
      const total = Number(r.total);
      const up = Number(r.up);
      out[r.window] = {
        total,
        up,
        uptime: total === 0 ? null : Math.round((up / total) * 10000) / 100,
      };
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RUN NOW (immediate enqueue)
  // ─────────────────────────────────────────────────────────────────────────
  async runNow(tenantId: string, id: string) {
    await this.assertCheckTenantOwnership(tenantId, id);
    await this.queue.add(
      JOB_PROBE,
      { checkId: id },
      {
        removeOnComplete: true,
        removeOnFail: 10,
        attempts: 1, // No retry on manual run-now — we want the raw result.
      },
    );
    return { enqueued: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────
  private requireExactlyOneTarget(dto: CreateMonitorCheckDto) {
    const set = [dto.siteId, dto.assetId, dto.linkId].filter(Boolean).length;
    if (set !== 1) {
      throw new BadRequestException(
        'Exactly one of siteId / assetId / linkId must be provided',
      );
    }
  }

  private async assertParentTenantOwnership(tenantId: string, dto: CreateMonitorCheckDto) {
    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, tenantId },
        select: { id: true },
      });
      if (!site) throw new NotFoundException('Parent site not found');
    } else if (dto.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, tenantId },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException('Parent asset not found');
    } else if (dto.linkId) {
      const link = await this.prisma.connectivityLink.findFirst({
        where: { id: dto.linkId, tenantId },
        select: { id: true },
      });
      if (!link) throw new NotFoundException('Parent connectivity link not found');
    }
  }

  private async assertCheckTenantOwnership(tenantId: string, id: string) {
    const exists = await this.prisma.monitorCheck.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Monitor check not found');
  }
}
