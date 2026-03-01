/**
 * Connectivity V1 → V2 migration utility
 *
 * V1 format: { primary: {type, provider, ref}, backup: {type, provider, ref}, monitoring: {...}, cutProcedure }
 * V2 format: { links: [{id, role, type, provider, ref, bandwidth, assetId, monitorName, status}], sdwan: {...}, cutProcedure }
 *
 * This normalizer detects the format and converts V1 to V2 at read-time.
 * No database migration needed — JSONB columns are extended in place.
 */

import { randomUUID } from 'crypto';

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

interface ConnectivityV1 {
  primary?: { type?: string; provider?: string; ref?: string };
  backup?: { type?: string; provider?: string; ref?: string };
  monitoring?: {
    source?: string;
    monitor?: string;
    lastCheck?: string;
    uptime?: number;
    responseTime?: number;
  };
  cutProcedure?: string;
}

/**
 * Detect whether raw connectivity JSON is V1 or V2 format
 */
export function isV2Format(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return Array.isArray(raw.links);
}

/**
 * Detect whether raw connectivity JSON is V1 format
 */
export function isV1Format(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  // V1 has primary/backup objects but NO links array
  return !Array.isArray(raw.links) && (raw.primary || raw.backup);
}

/**
 * Normalize any connectivity format to V2
 * - V2 input → returned as-is
 * - V1 input → converted to V2
 * - null/undefined → empty V2 structure
 */
export function normalizeConnectivity(raw: any): ConnectivityV2 {
  // Null/undefined → empty V2
  if (!raw || typeof raw !== 'object') {
    return { links: [] };
  }

  // Already V2 format
  if (isV2Format(raw)) {
    return {
      links: raw.links || [],
      sdwan: raw.sdwan || undefined,
      cutProcedure: raw.cutProcedure || undefined,
    };
  }

  // V1 format → convert
  const v1 = raw as ConnectivityV1;
  const links: ConnectivityLinkV2[] = [];

  if (v1.primary && hasContent(v1.primary)) {
    const link: ConnectivityLinkV2 = {
      id: randomUUID(),
      role: 'primary',
      type: v1.primary.type,
      provider: v1.primary.provider,
      ref: v1.primary.ref,
    };
    // Migrate monitoring.monitor to primary link's monitorName
    if (v1.monitoring?.monitor) {
      link.monitorName = v1.monitoring.monitor;
    }
    links.push(link);
  }

  if (v1.backup && hasContent(v1.backup)) {
    links.push({
      id: randomUUID(),
      role: 'backup',
      type: v1.backup.type,
      provider: v1.backup.provider,
      ref: v1.backup.ref,
    });
  }

  return {
    links,
    cutProcedure: v1.cutProcedure || undefined,
  };
}

/**
 * Convert V2 connectivity back to include V1 legacy fields for backward compat
 * Used when returning data to frontend that might still use V1 fields
 */
export function toV1Compat(v2: ConnectivityV2): any {
  const primaryLink = v2.links.find(l => l.role === 'primary');
  const backupLink = v2.links.find(l => l.role === 'backup');

  return {
    // V2 fields
    links: v2.links,
    sdwan: v2.sdwan,
    cutProcedure: v2.cutProcedure,
    // V1 legacy fields
    primary: primaryLink
      ? { type: primaryLink.type, provider: primaryLink.provider, ref: primaryLink.ref }
      : undefined,
    backup: backupLink
      ? { type: backupLink.type, provider: backupLink.provider, ref: backupLink.ref }
      : undefined,
    monitoring: primaryLink?.monitorName
      ? { source: 'uptime_kuma', monitor: primaryLink.monitorName }
      : undefined,
  };
}

/**
 * Check if an object has any non-empty content
 */
function hasContent(obj: Record<string, any>): boolean {
  return Object.values(obj).some(v => v !== undefined && v !== null && v !== '');
}

/**
 * Extract all monitor names from a V2 connectivity structure
 * Returns an array of { monitorName, target } for health aggregation
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

  // Links with monitorName
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

  // SD-WAN with monitorName
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
