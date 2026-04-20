/**
 * Connectivity normalization utility.
 *
 * In phase 6.5 (2026-04-20) the legacy `Site.connectivity` JSONB column was
 * dropped. The structured `ConnectivityLink[]` table is now the single source
 * of truth. This utility used to convert V1 JSON → V2 JSON in-memory; it now
 * just adapts `ConnectivityLink[]` rows to the V2 shape expected by the
 * downstream health-aggregation and monitoring-webhook services so they
 * didn't need an internal refactor.
 *
 * Public API (kept backward compatible):
 * - normalizeConnectivity(links) → ConnectivityV2
 * - extractMonitorNames(v2)      → monitor targets for health aggregation
 */

export interface ConnectivityLinkV2 {
  id: string;
  role: 'primary' | 'backup';
  type?: string;
  provider?: string;
  ref?: string;
  bandwidth?: string;
  assetId?: string;
  monitorName?: string;
  status?: 'up' | 'down' | 'unknown';
}

export interface SdwanConfigV2 {
  enabled: boolean;
  provider?: string;
  firewallIds: string[];
  monitorName?: string;
  status?: 'up' | 'down' | 'unknown';
  notes?: string;
}

export interface ConnectivityV2 {
  links: ConnectivityLinkV2[];
  sdwan?: SdwanConfigV2;
  cutProcedure?: string;
}

/**
 * Row shape coming from Prisma `ConnectivityLink` select. Kept loose on
 * purpose so the adapter works whether the caller selected all fields or
 * a subset (`provider`, `type`, `role`, `publicIp`, `monitorName`, `status`…).
 */
type DbConnectivityLink = {
  id: string;
  role: string;              // 'PRIMARY' | 'BACKUP' | 'OTHER' in the enum
  type?: string | null;
  provider?: string | null;
  contractRef?: string | null;
  bandwidthDown?: number | null;
  bandwidthUp?: number | null;
  publicIp?: string | null;
  monitorName?: string | null;
  status?: string | null;
};

/**
 * Adapter: structured ConnectivityLink[] rows → V2 shape.
 * `cutProcedure` now lives on Site.cutProcedure (passed separately when needed).
 */
export function normalizeConnectivity(
  links: DbConnectivityLink[] | null | undefined,
  cutProcedure?: string | null,
): ConnectivityV2 {
  if (!Array.isArray(links) || links.length === 0) {
    return { links: [], cutProcedure: cutProcedure || undefined };
  }

  const v2Links: ConnectivityLinkV2[] = links.map((l) => ({
    id: l.id,
    // Enum values PRIMARY/BACKUP/OTHER → lowercase role recognised by downstream code.
    // OTHER is treated as 'backup' for compat with the legacy 2-role aggregator.
    role: (l.role === 'PRIMARY' ? 'primary' : 'backup') as 'primary' | 'backup',
    type: l.type || undefined,
    provider: l.provider || undefined,
    ref: l.contractRef || l.publicIp || undefined,
    bandwidth:
      l.bandwidthDown
        ? `${l.bandwidthDown}${l.bandwidthUp ? `/${l.bandwidthUp}` : ''}`
        : undefined,
    monitorName: l.monitorName || undefined,
    status: (l.status as any) || undefined,
  }));

  return {
    links: v2Links,
    cutProcedure: cutProcedure || undefined,
    // SD-WAN info is out of scope for ConnectivityLink rows — keep undefined
    // until a proper model is added (current monitoring handles it from firewall assets).
  };
}

/**
 * Extract monitor targets from a V2 connectivity structure.
 * Unchanged from phase 5 — still used by HealthAggregationService.
 */
export function extractMonitorNames(connectivity: ConnectivityV2): Array<{
  monitorName: string;
  targetType: 'link' | 'sdwan';
  targetId: string;
  targetName: string;
  role?: string;
}> {
  const monitors: Array<{
    monitorName: string;
    targetType: 'link' | 'sdwan';
    targetId: string;
    targetName: string;
    role?: string;
  }> = [];

  for (const link of connectivity.links) {
    if (link.monitorName) {
      monitors.push({
        monitorName: link.monitorName,
        targetType: 'link',
        targetId: link.id,
        targetName: `${link.type || 'Link'} ${link.provider || ''}`.trim(),
        role: link.role,
      });
    }
  }

  if (connectivity.sdwan?.monitorName) {
    monitors.push({
      monitorName: connectivity.sdwan.monitorName,
      targetType: 'sdwan',
      targetId: 'sdwan',
      targetName: `SD-WAN ${connectivity.sdwan.provider || ''}`.trim(),
    });
  }

  return monitors;
}
