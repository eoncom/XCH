import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  PrismaClient,
  MonitorStatus,
  HealthStatus,
  SeverityLevel,
  Prisma,
} from '@prisma/client';
import {
  HEALTH_RECOMPUTE_QUEUE,
  JOB_RECOMPUTE,
} from './health-recompute.constants';

/**
 * Health Status Aggregation Engine — refonte ADR-022.
 *
 * Computes Site.healthStatus from MonitorCheck.lastStatus + MonitorCheck.severity.
 * Self-contained : give it a siteId and it loads everything, aggregates,
 * persists, and returns the breakdown.
 *
 * Sémantique cible (ADR-022, remplaçant les heuristiques v1.9.x) :
 *   HEALTHY  : tout ce qui est monitoré est UP (peu importe la couverture).
 *   CRITICAL : ≥ 1 check `severity=CRITICAL` est DOWN
 *              — PRIMARY link DOWN, asset critique, override admin
 *              — OU SD-WAN tous firewalls DOWN (cas spécial aggregator)
 *   WARNING  : ≥ 1 check `severity=WARNING` DOWN (BACKUP, asset, site-level)
 *   UNKNOWN  : aucun check actif (rien monitoré)
 *
 * Concurrence : `enqueueRecompute(siteId)` push un job sur la queue
 * `health-recompute` avec `jobId=siteId` + `delay=300ms`. Bull dédupe →
 * exécution sérialisée par site, coalesce de bursts en une seule recompute.
 *
 * Per-entity aggregation (worst-case wins) : un asset / link / site avec
 * plusieurs MonitorCheck → si UN check est DOWN, l'entité est down. La
 * severity reportée est celle du PIRE (CRITICAL > WARNING > INFO) parmi
 * les checks DOWN.
 */

export interface HealthComponent {
  type: 'link' | 'sdwan' | 'asset' | 'site-monitor';
  id: string;
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  role?: string;
  /**
   * Operational impact when this component is DOWN/degraded.
   * - 'critical' : escalates Site.healthStatus to CRITICAL
   * - 'warning'  : escalates Site.healthStatus to WARNING
   * - 'info'     : soft signal, no escalation (forward-compat)
   * - 'none'     : component is UP / unknown / unmonitored — no impact
   */
  impact: 'critical' | 'warning' | 'info' | 'none';
  detail?: string;
}

export interface HealthBreakdown {
  overall: HealthStatus;
  timestamp: string;
  components: HealthComponent[];
}

type Triplet = 'up' | 'down' | 'unknown';

/** Worst severity wins when aggregating across multiple checks for one entity. */
const SEVERITY_RANK: Record<SeverityLevel, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

@Injectable()
export class HealthAggregationService {
  private readonly logger = new Logger(HealthAggregationService.name);

  constructor(
    private readonly prisma: PrismaClient,
    @InjectQueue(HEALTH_RECOMPUTE_QUEUE) private readonly recomputeQueue: Queue,
  ) {}

  /**
   * Async recompute trigger. Pushes a debounced job onto `health-recompute`
   * queue. Multiple calls for the same siteId within 300 ms collapse to ONE
   * processed recompute. Concurrent calls for the same siteId NEVER race :
   * the active job's read-modify-write completes before any subsequent
   * enqueue fires (Bull jobId dedup).
   *
   * Used by : MonitorProcessor (probe transition), HealthSyncScheduler
   * (cron 5 min). Returns immediately (~ms).
   */
  async enqueueRecompute(siteId: string, source: string): Promise<void> {
    try {
      await this.recomputeQueue.add(
        JOB_RECOMPUTE,
        { siteId, source },
        {
          jobId: siteId,
          delay: 300,
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 2,
          backoff: { type: 'exponential', delay: 500 },
        },
      );
    } catch (e: any) {
      this.logger.warn(`enqueueRecompute(${siteId}) from ${source} failed: ${e.message}`);
    }
  }

  /**
   * Synchronous recompute. Loads site + checks, aggregates, persists,
   * returns the breakdown. Called by :
   *   - HealthRecomputeProcessor (worker — async path via enqueueRecompute)
   *   - Tests (direct sync invocation)
   *   - Future force-refresh admin actions (if added)
   *
   * NOT for direct probe-transition use — go through `enqueueRecompute()`
   * to benefit from coalescing + per-site serialisation.
   */
  async recomputeSite(siteId: string): Promise<HealthBreakdown> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        connectivityLinks: {
          select: {
            id: true,
            role: true,
            type: true,
            provider: true,
            monitorChecks: {
              where: { enabled: true },
              select: { lastStatus: true, severity: true },
            },
          },
        },
        assets: {
          select: {
            id: true,
            name: true,
            type: true,
            monitorChecks: {
              where: { enabled: true },
              select: { lastStatus: true, severity: true },
            },
          },
        },
        sdwanConfig: {
          select: {
            enabled: true,
            provider: true,
            firewalls: { select: { assetId: true, role: true } },
          },
        },
        monitorChecks: {
          where: { enabled: true },
          select: { id: true, target: true, lastStatus: true, severity: true },
        },
      },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    const components: HealthComponent[] = [];

    // 1. Connectivity links — aggregate status + severity across multiple checks per link.
    const linkComponents = site.connectivityLinks.map((link) => {
      const status = aggregateStatus(link.monitorChecks);
      const severity = worstSeverityWhenDown(link.monitorChecks, status);
      const name = `${link.type || 'Lien'} ${link.provider || ''}`.trim();
      return {
        type: 'link' as const,
        id: link.id,
        name,
        status,
        role: link.role,
        impact: severityToImpact(status, severity),
      };
    });
    components.push(...linkComponents);

    // 2. SD-WAN — derive from attached firewalls' MonitorChecks. Special
    // aggregator rule (per ADR-022 §"Cas spécial SD-WAN") :
    //   - all firewalls DOWN → CRITICAL (perte accès Internet via SD-WAN)
    //   - some DOWN → WARNING (degraded redundancy)
    //   - all UP → no impact
    // Individual firewall MonitorCheck.severity is NOT consulted for the
    // SD-WAN aggregate impact (would conflate per-check intent with the
    // network-level invariant). Admin override on a single firewall check
    // can still escalate via its own component listing if attached.
    if (site.sdwanConfig?.enabled && site.sdwanConfig.firewalls.length > 0) {
      const firewallStatuses = site.sdwanConfig.firewalls
        .map((fw) => site.assets.find((a) => a.id === fw.assetId))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => aggregateStatus(a.monitorChecks))
        .filter((s) => s !== 'unknown'); // Only monitored firewalls contribute.

      if (firewallStatuses.length > 0) {
        const upCount = firewallStatuses.filter((s) => s === 'up').length;
        const total = firewallStatuses.length;
        let sdwanStatus: HealthComponent['status'];
        let sdwanImpact: HealthComponent['impact'] = 'none';
        if (upCount === total) sdwanStatus = 'up';
        else if (upCount === 0) {
          sdwanStatus = 'down';
          sdwanImpact = 'critical';
        } else {
          sdwanStatus = 'degraded';
          sdwanImpact = 'warning';
        }
        components.push({
          type: 'sdwan',
          id: 'sdwan',
          name: `SD-WAN ${site.sdwanConfig.provider || ''}`.trim(),
          status: sdwanStatus,
          impact: sdwanImpact,
          detail: `${upCount}/${total} UP`,
        });
      }
    }

    // 3. Assets — skip those already counted in SD-WAN to avoid double-impact.
    const sdwanFirewallIds = new Set((site.sdwanConfig?.firewalls ?? []).map((f) => f.assetId));
    for (const asset of site.assets) {
      if (sdwanFirewallIds.has(asset.id)) continue;
      if (asset.monitorChecks.length === 0) continue; // Not monitored → not counted.
      const status = aggregateStatus(asset.monitorChecks);
      const severity = worstSeverityWhenDown(asset.monitorChecks, status);
      components.push({
        type: 'asset',
        id: asset.id,
        name: asset.name || asset.type,
        status,
        impact: severityToImpact(status, severity),
      });
    }

    // 4. Site-level checks (surveillance d'un service global du site,
    // ex: ping vers DNS public, HTTP vers service tiers). Pas attaché à
    // un asset ni à un lien.
    for (const check of site.monitorChecks) {
      const triplet = monitorStatusToTriplet(check.lastStatus);
      const severity = triplet === 'down' ? check.severity : null;
      components.push({
        type: 'site-monitor',
        id: `site-check-${check.id}`,
        name: `Surveillance site (${check.target})`,
        status: triplet,
        impact: severityToImpact(triplet, severity),
      });
    }

    const overall = computeOverall(components);
    const breakdown: HealthBreakdown = {
      overall,
      timestamp: new Date().toISOString(),
      components,
    };

    // Persist Site.healthStatus + lastHealthCheck (denormalised aggregates)
    // and upsert the full SiteHealthSnapshot (ADR-018).
    const computedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.site.update({
        where: { id: siteId },
        data: {
          healthStatus: overall,
          lastHealthCheck: computedAt,
        },
      }),
      this.prisma.siteHealthSnapshot.upsert({
        where: { siteId },
        create: {
          siteId,
          overall,
          componentsJson: components as unknown as Prisma.InputJsonValue,
          computedAt,
        },
        update: {
          overall,
          componentsJson: components as unknown as Prisma.InputJsonValue,
          computedAt,
        },
      }),
    ]);

    return breakdown;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────

function monitorStatusToTriplet(s: MonitorStatus): Triplet {
  if (s === 'UP') return 'up';
  if (s === 'DOWN') return 'down';
  return 'unknown';
}

/**
 * Worst-case status aggregation across N checks for a single entity.
 * Any DOWN → DOWN. Else any UP → UP. Else UNKNOWN.
 */
function aggregateStatus(checks: Array<{ lastStatus: MonitorStatus }>): Triplet {
  if (checks.length === 0) return 'unknown';
  const triplets = checks.map((c) => monitorStatusToTriplet(c.lastStatus));
  if (triplets.includes('down')) return 'down';
  if (triplets.includes('up')) return 'up';
  return 'unknown';
}

/**
 * Highest severity among DOWN checks. Returns null if status is up/unknown
 * (impact is 'none', severity irrelevant). When status is down/degraded,
 * picks the worst severity among the checks that are actually DOWN.
 */
function worstSeverityWhenDown(
  checks: Array<{ lastStatus: MonitorStatus; severity: SeverityLevel }>,
  status: Triplet,
): SeverityLevel | null {
  if (status !== 'down') return null;
  const downChecks = checks.filter((c) => c.lastStatus === 'DOWN');
  if (downChecks.length === 0) return null;
  let worst: SeverityLevel = downChecks[0].severity;
  for (const c of downChecks) {
    if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[worst]) {
      worst = c.severity;
    }
  }
  return worst;
}

function severityToImpact(
  status: Triplet,
  severity: SeverityLevel | null,
): HealthComponent['impact'] {
  if (status !== 'down' || !severity) return 'none';
  if (severity === 'CRITICAL') return 'critical';
  if (severity === 'WARNING') return 'warning';
  return 'info';
}

export function computeOverall(components: HealthComponent[]): HealthStatus {
  if (components.length === 0) return HealthStatus.UNKNOWN;
  if (components.every((c) => c.status === 'unknown')) return HealthStatus.UNKNOWN;

  // 1. Total connectivity loss : tous les liens monitorés sont down.
  // Cas d'agrégat — escalade CRITICAL même si chaque lien individuel
  // n'est que WARNING (BACKUP). « Plus aucun lien UP » = service site
  // perdu globalement.
  const links = components.filter((c) => c.type === 'link');
  if (links.length > 0 && links.every((l) => l.status === 'down')) return HealthStatus.CRITICAL;

  // 2. ≥ 1 composant impact='critical' (ADR-022 sémantique severity).
  // Couvre :
  //   - PRIMARY link DOWN (severity=CRITICAL via backfill / config)
  //   - SD-WAN tous firewalls DOWN (cas spécial aggregator)
  //   - Asset / site-level explicitement marqué CRITICAL via override admin
  if (components.some((c) => c.impact === 'critical')) return HealthStatus.CRITICAL;

  // 3. WARNING : impact='warning' OU n'importe quel composant degraded.
  const hasWarning = components.some((c) => c.impact === 'warning');
  const hasDegraded = components.some((c) => c.status === 'degraded');
  if (hasWarning || hasDegraded) return HealthStatus.WARNING;

  // 4. HEALTHY si au moins un composant UP. Les `info` impacts ne dégradent
  //    pas (forward-compat — soft signals).
  if (components.some((c) => c.status === 'up')) return HealthStatus.HEALTHY;
  return HealthStatus.UNKNOWN;
}
