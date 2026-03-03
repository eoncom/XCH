import { Injectable, Logger } from '@nestjs/common';
import {
  normalizeConnectivity,
  extractMonitorNames,
  ConnectivityV2,
  ConnectivityLinkV2,
} from '../../common/utils/connectivity-migration';

/**
 * Health Status Aggregation Engine
 *
 * Calculates intelligent site health from multiple components:
 * - Connectivity links (primary/backup) with their Uptime Kuma status
 * - SD-WAN status (derived from component firewalls)
 * - Monitored assets (equipment)
 *
 * Rules:
 * 1. CRITICAL if: ALL links DOWN (total connectivity loss)
 * 2. WARNING if: primary link DOWN but backup UP, OR SD-WAN degraded/DOWN,
 *    OR any equipment DOWN (equipment never causes CRITICAL)
 * 3. HEALTHY if: everything is UP
 * 4. UNKNOWN if: no monitoring configured
 *
 * SD-WAN: status is derived from component firewalls on the site.
 * If 2 firewalls and 1 is UP → "degraded" (WARNING).
 */

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface HealthComponent {
  type: 'link' | 'sdwan' | 'asset';
  id: string;
  name: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  role?: string;
  impact: 'critical' | 'warning' | 'none';
  monitorName?: string;
  detail?: string; // e.g. "1/2 UP" for SD-WAN composite
}

export interface HealthBreakdown {
  overall: HealthStatus;
  timestamp: string;
  components: HealthComponent[];
}

interface MonitorStatusMap {
  [monitorName: string]: {
    status: 'up' | 'down' | 'unknown';
    responseTime?: number;
  };
}

@Injectable()
export class HealthAggregationService {
  private readonly logger = new Logger(HealthAggregationService.name);

  /**
   * Calculate site health from all monitored components
   *
   * @param connectivity Raw connectivity JSON from the site
   * @param siteAssets Assets belonging to the site (with networkInfo)
   * @param monitorStatuses Map of monitor name → status from Uptime Kuma
   */
  calculateSiteHealth(
    connectivity: any,
    siteAssets: Array<{
      id: string;
      name?: string;
      type: string;
      networkInfo?: any;
    }>,
    monitorStatuses: MonitorStatusMap,
  ): HealthBreakdown {
    const components: HealthComponent[] = [];
    const v2 = normalizeConnectivity(connectivity);

    // 1. Evaluate connectivity links
    for (const link of v2.links) {
      // Determine effective monitorName: link's own, or inherited from associated asset
      let effectiveMonitorName = link.monitorName;
      if (!effectiveMonitorName && link.assetId) {
        const associatedAsset = siteAssets.find(a => a.id === link.assetId);
        const assetNetInfo = associatedAsset?.networkInfo as any;
        if (assetNetInfo?.monitorName) {
          effectiveMonitorName = assetNetInfo.monitorName;
        }
      }

      const status = this.resolveMonitorStatus(effectiveMonitorName, link.status, monitorStatuses);
      const linkName = `${link.type || 'Link'} ${link.provider || ''}`.trim();

      components.push({
        type: 'link',
        id: link.id,
        name: linkName,
        status,
        role: link.role,
        impact: this.calculateLinkImpact(link, v2.links, status),
        monitorName: effectiveMonitorName,
      });
    }

    // 2. Evaluate SD-WAN — derive status from component firewalls
    if (v2.sdwan?.enabled) {
      const sdwanFirewalls = siteAssets.filter(
        a => a.type === 'FIREWALL' && (a.networkInfo as any)?.monitorName,
      );

      let sdwanStatus: 'up' | 'down' | 'degraded' | 'unknown';
      let sdwanImpact: 'critical' | 'warning' | 'none' = 'none';
      let sdwanDetail: string | undefined;
      const sdwanBaseName = `SD-WAN ${v2.sdwan.provider || ''}`.trim();

      if (sdwanFirewalls.length > 0) {
        // Derive SD-WAN status from its component firewalls
        const fwStatuses = sdwanFirewalls.map(fw =>
          this.resolveMonitorStatus(
            (fw.networkInfo as any).monitorName,
            (fw.networkInfo as any).monitorStatus,
            monitorStatuses,
          ),
        );
        const upCount = fwStatuses.filter(s => s === 'up').length;
        const downCount = fwStatuses.filter(s => s === 'down').length;
        const total = sdwanFirewalls.length;

        sdwanDetail = `${upCount}/${total} UP`;

        if (upCount === total) {
          sdwanStatus = 'up';
        } else if (downCount === total) {
          sdwanStatus = 'down';
          sdwanImpact = 'warning';
        } else if (upCount > 0) {
          // Partial — degraded
          sdwanStatus = 'degraded';
          sdwanImpact = 'warning';
        } else {
          sdwanStatus = 'unknown';
        }
      } else {
        // No firewalls with monitors — fall back to SD-WAN's own monitor
        const fallbackStatus = this.resolveMonitorStatus(
          v2.sdwan.monitorName,
          v2.sdwan.status,
          monitorStatuses,
        );
        sdwanStatus = fallbackStatus;
        sdwanImpact = fallbackStatus === 'down' ? 'warning' : 'none';
      }

      components.push({
        type: 'sdwan',
        id: 'sdwan',
        name: sdwanBaseName,
        status: sdwanStatus,
        impact: sdwanImpact,
        monitorName: v2.sdwan.monitorName,
        detail: sdwanDetail,
      });
    }

    // 3. Evaluate monitored assets
    for (const asset of siteAssets) {
      const networkInfo = asset.networkInfo as any;
      if (!networkInfo?.monitorName) continue;

      const status = this.resolveMonitorStatus(
        networkInfo.monitorName,
        networkInfo.monitorStatus,
        monitorStatuses,
      );

      components.push({
        type: 'asset',
        id: asset.id,
        name: asset.name || `${asset.type}`,
        status,
        impact: this.calculateAssetImpact(asset.type, status),
        monitorName: networkInfo.monitorName,
      });
    }

    // 4. Calculate overall health
    const overall = this.calculateOverallHealth(components, v2);

    return {
      overall,
      timestamp: new Date().toISOString(),
      components,
    };
  }

  /**
   * Resolve monitor status from:
   * 1. No monitorName → not monitored → 'unknown'
   * 2. Live monitor statuses map (from Uptime Kuma fetch)
   * 3. Cached status in the entity (from previous sync)
   * 4. Default to 'unknown'
   */
  private resolveMonitorStatus(
    monitorName: string | undefined,
    cachedStatus: string | undefined,
    monitorStatuses: MonitorStatusMap,
  ): 'up' | 'down' | 'unknown' {
    // No monitor configured → not monitored → unknown
    if (!monitorName) return 'unknown';

    // Priority 1: live status from Uptime Kuma
    if (monitorStatuses[monitorName]) {
      return monitorStatuses[monitorName].status;
    }

    // Priority 2: cached status from previous sync
    if (cachedStatus === 'up' || cachedStatus === 'down') {
      return cachedStatus;
    }

    return 'unknown';
  }

  /**
   * Calculate the impact of a link being down
   * - If it's the ONLY link → critical
   * - If it's primary but backup exists and is up → warning
   * - If it's backup → warning (degraded redundancy)
   */
  private calculateLinkImpact(
    link: ConnectivityLinkV2,
    allLinks: ConnectivityLinkV2[],
    status: 'up' | 'down' | 'unknown',
  ): 'critical' | 'warning' | 'none' {
    if (status === 'up' || status === 'unknown') return 'none';

    // Link is down
    if (allLinks.length <= 1) return 'critical'; // Only link → critical

    if (link.role === 'primary') {
      // Primary down — check if any backup is up
      // Impact is just 'warning' because we have backup; overall calc handles both-down
      return 'warning';
    }

    // Backup link down → warning (reduced redundancy)
    return 'warning';
  }

  /**
   * Calculate impact of an asset being down.
   * Equipment DOWN is always WARNING (never CRITICAL).
   * Only connectivity links can cause CRITICAL status.
   */
  private calculateAssetImpact(
    assetType: string,
    status: 'up' | 'down' | 'unknown',
  ): 'critical' | 'warning' | 'none' {
    if (status === 'up' || status === 'unknown') return 'none';

    // Any asset down → warning (equipment never causes CRITICAL)
    return 'warning';
  }

  /**
   * Calculate overall health status from all components
   */
  private calculateOverallHealth(
    components: HealthComponent[],
    connectivity: ConnectivityV2,
  ): HealthStatus {
    // No components with monitoring → UNKNOWN
    if (components.length === 0) return 'UNKNOWN';

    // Check if ALL components are unknown (no actual monitoring data)
    const allUnknown = components.every(c => c.status === 'unknown');
    if (allUnknown) return 'UNKNOWN';

    // CRITICAL condition: ALL connectivity links are DOWN (total loss)
    const links = components.filter(c => c.type === 'link');
    if (links.length > 0 && links.every(l => l.status === 'down')) {
      return 'CRITICAL';
    }

    // WARNING conditions: any component with warning impact, or degraded status
    const hasWarningImpact = components.some(c => c.impact === 'warning');
    const hasDegraded = components.some(c => c.status === 'degraded');
    if (hasWarningImpact || hasDegraded) return 'WARNING';

    // All components either UP or unknown (with at least one UP)
    const hasUp = components.some(c => c.status === 'up');
    if (hasUp) return 'HEALTHY';

    return 'UNKNOWN';
  }

  /**
   * Build a monitor status map from Uptime Kuma monitors
   */
  buildMonitorStatusMap(
    monitors: Array<{ name: string; status: 'up' | 'down' | 'unknown'; responseTime?: number }>,
  ): MonitorStatusMap {
    const map: MonitorStatusMap = {};
    for (const monitor of monitors) {
      map[monitor.name] = {
        status: monitor.status,
        responseTime: monitor.responseTime,
      };
    }
    return map;
  }

  /**
   * Update cached statuses in connectivity links and SD-WAN
   * Returns the modified connectivity object (for saving to DB)
   */
  updateCachedStatuses(
    connectivity: any,
    monitorStatuses: MonitorStatusMap,
  ): any {
    const v2 = normalizeConnectivity(connectivity);

    // Update link statuses
    for (const link of v2.links) {
      if (link.monitorName && monitorStatuses[link.monitorName]) {
        link.status = monitorStatuses[link.monitorName].status;
      }
    }

    // Update SD-WAN status
    if (v2.sdwan?.monitorName && monitorStatuses[v2.sdwan.monitorName]) {
      v2.sdwan.status = monitorStatuses[v2.sdwan.monitorName].status;
    }

    return v2;
  }

  /**
   * Update cached monitor statuses in asset networkInfo
   * Returns updated networkInfo object
   */
  updateAssetMonitorStatus(
    networkInfo: any,
    monitorStatuses: MonitorStatusMap,
  ): any {
    if (!networkInfo?.monitorName) return networkInfo;
    const monitorName = networkInfo.monitorName;
    if (monitorStatuses[monitorName]) {
      return {
        ...networkInfo,
        monitorStatus: monitorStatuses[monitorName].status,
        lastHealthCheck: new Date().toISOString(),
      };
    }
    return networkInfo;
  }
}
