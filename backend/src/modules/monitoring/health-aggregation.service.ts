import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, MonitorStatus, HealthStatus } from '@prisma/client';

/**
 * Health Status Aggregation Engine — native edition (ADR-016).
 *
 * Computes Site.healthStatus from the structured `MonitorCheck.lastStatus`
 * column (single source of truth, no provider abstraction). Self-contained:
 * give it a siteId and it loads everything, aggregates, persists, and
 * returns the breakdown.
 *
 * Rules (unchanged from the legacy ADR-014 era — only the data source moves):
 *  1. CRITICAL : ALL connectivity links are DOWN (total connectivity loss)
 *  2. WARNING  : a primary link DOWN (backup OK), or SD-WAN degraded,
 *                or any monitored equipment DOWN. Equipment never causes CRITICAL.
 *  3. HEALTHY  : at least one component UP and nothing in WARNING/CRITICAL
 *  4. UNKNOWN  : no monitor configured anywhere on the site, or all unknown
 *
 * Per-entity aggregation: an asset / link / site can have multiple
 * MonitorCheck rows. Worst-case wins — any DOWN → DOWN, else any UP → UP,
 * else UNKNOWN.
 */

export interface HealthComponent {
  type: 'link' | 'sdwan' | 'asset';
  id: string;
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  role?: string;
  impact: 'critical' | 'warning' | 'none';
  detail?: string;
}

export interface HealthBreakdown {
  overall: HealthStatus;
  timestamp: string;
  components: HealthComponent[];
}

type Triplet = 'up' | 'down' | 'unknown';

@Injectable()
export class HealthAggregationService {
  private readonly logger = new Logger(HealthAggregationService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Recompute one site's health from current MonitorCheck.lastStatus values,
   * persist it, and return the breakdown. Called by:
   *  - MonitorProcessor on every UP↔DOWN transition (real-time, ≤1s latency)
   *  - HealthSyncScheduler cron 5min (refresh garanti, filet de sécurité)
   *  - Any explicit force-refresh (admin action)
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
              select: { lastStatus: true },
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
              select: { lastStatus: true },
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
          select: { id: true, target: true, lastStatus: true },
        },
        metadata: true,
      },
    });

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    const components: HealthComponent[] = [];

    // 1. Connectivity links — aggregate across multiple checks per link.
    const linkComponents = site.connectivityLinks.map((link) => {
      const status = aggregateChecks(link.monitorChecks);
      const name = `${link.type || 'Lien'} ${link.provider || ''}`.trim();
      return {
        type: 'link' as const,
        id: link.id,
        name,
        status,
        role: link.role,
        impact: linkImpact(link.role, status, site.connectivityLinks.length),
      };
    });
    components.push(...linkComponents);

    // 2. SD-WAN — derive from attached firewalls' MonitorChecks.
    if (site.sdwanConfig?.enabled && site.sdwanConfig.firewalls.length > 0) {
      const firewallStatuses = site.sdwanConfig.firewalls
        .map((fw) => site.assets.find((a) => a.id === fw.assetId))
        .filter((a): a is NonNullable<typeof a> => !!a)
        .map((a) => aggregateChecks(a.monitorChecks))
        .filter((s) => s !== 'unknown'); // Only monitored firewalls contribute.

      if (firewallStatuses.length > 0) {
        const upCount = firewallStatuses.filter((s) => s === 'up').length;
        const total = firewallStatuses.length;
        let sdwanStatus: HealthComponent['status'];
        let sdwanImpact: HealthComponent['impact'] = 'none';
        if (upCount === total) sdwanStatus = 'up';
        else if (upCount === 0) {
          sdwanStatus = 'down';
          sdwanImpact = 'warning';
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
      const status = aggregateChecks(asset.monitorChecks);
      components.push({
        type: 'asset',
        id: asset.id,
        name: asset.name || asset.type,
        status,
        impact: assetImpact(status),
      });
    }

    // 4. Site-level checks (rare — surveillance d'un service global du site).
    // Surfaced as pseudo-components keyed on the check itself.
    for (const check of site.monitorChecks) {
      const triplet = monitorStatusToTriplet(check.lastStatus);
      components.push({
        type: 'asset',
        id: `site-check-${check.id}`,
        name: `Surveillance site (${check.target})`,
        status: triplet,
        impact: assetImpact(triplet),
      });
    }

    const overall = computeOverall(components);
    const breakdown: HealthBreakdown = {
      overall,
      timestamp: new Date().toISOString(),
      components,
    };

    // Persist Site.healthStatus + lastHealthCheck (denormalised aggregates)
    // and upsert the full SiteHealthSnapshot (ADR-018 — typed table replaces
    // the former Site.metadata.healthBreakdown JSON).
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
          componentsJson: components as any,
          computedAt,
        },
        update: {
          overall,
          componentsJson: components as any,
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
 * Worst-case aggregation across N checks for a single entity.
 * Any DOWN → DOWN. Else any UP → UP. Else UNKNOWN.
 */
function aggregateChecks(checks: Array<{ lastStatus: MonitorStatus }>): Triplet {
  if (checks.length === 0) return 'unknown';
  const triplets = checks.map((c) => monitorStatusToTriplet(c.lastStatus));
  if (triplets.includes('down')) return 'down';
  if (triplets.includes('up')) return 'up';
  return 'unknown';
}

function linkImpact(role: string, status: Triplet, totalLinks: number): HealthComponent['impact'] {
  if (status === 'up' || status === 'unknown') return 'none';
  // status === 'down'
  if (totalLinks <= 1) return 'critical';
  // Multiple links: degraded redundancy → warning. Total loss handled in computeOverall.
  return 'warning';
}

function assetImpact(status: Triplet): HealthComponent['impact'] {
  if (status === 'up' || status === 'unknown') return 'none';
  return 'warning';
}

function computeOverall(components: HealthComponent[]): HealthStatus {
  if (components.length === 0) return HealthStatus.UNKNOWN;
  if (components.every((c) => c.status === 'unknown')) return HealthStatus.UNKNOWN;

  const links = components.filter((c) => c.type === 'link');
  if (links.length > 0 && links.every((l) => l.status === 'down')) return HealthStatus.CRITICAL;

  const hasWarning = components.some((c) => c.impact === 'warning' || c.impact === 'critical');
  const hasDegraded = components.some((c) => c.status === 'degraded');
  if (hasWarning || hasDegraded) return HealthStatus.WARNING;

  if (components.some((c) => c.status === 'up')) return HealthStatus.HEALTHY;
  return HealthStatus.UNKNOWN;
}
