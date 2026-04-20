/**
 * Connectivity normalization utility.
 *
 * Phase 6.5 (2026-04-20): the legacy `Site.connectivity` JSONB column was
 * dropped. The structured `ConnectivityLink[]` table is now the single source
 * of truth. This utility adapts `ConnectivityLink[]` rows to a V2 shape the
 * health-aggregation and monitoring-webhook services consume.
 *
 * Phase 6.6 (2026-04-20): SD-WAN moved to its own Prisma models
 * (`SdwanConfig` + `SdwanFirewall`); the V2 shape no longer carries a `sdwan`
 * field. Health aggregation receives `sdwanConfig` as a separate argument.
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

// Phase 6.6: SD-WAN moved to its own Prisma models (SdwanConfig + SdwanFirewall).
// The V2 shape no longer carries a `sdwan` field — HealthAggregationService
// receives sdwanConfig as a separate argument.
export interface ConnectivityV2 {
  links: ConnectivityLinkV2[];
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
  assetId?: string | null;
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
    assetId: l.assetId || undefined,
    monitorName: l.monitorName || undefined,
    status: (l.status as any) || undefined,
  }));

  return {
    links: v2Links,
    cutProcedure: cutProcedure || undefined,
  };
}

