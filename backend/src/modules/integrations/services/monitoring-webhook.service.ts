import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { HealthAggregationService } from '../health-aggregation.service';
import { NormalizedWebhookEvent } from '../interfaces/integration-provider.interface';
import { parseMonitorName } from '../utils/monitor-name-parser';
import { normalizeConnectivity } from '../../../common/utils/connectivity-migration';
import { HealthStatus as PrismaHealthStatus } from '@prisma/client';

/**
 * Service that processes incoming webhooks from monitoring providers.
 *
 * Flow:
 * 1. Validate shared secret from x-webhook-secret header
 * 2. Normalize the provider-specific payload → NormalizedWebhookEvent
 * 3. Parse monitor name convention [CODE] TYPE LABEL
 * 4. Find site by code
 * 5. Update component cached status in connectivity / asset networkInfo
 * 6. Recalculate site health via HealthAggregationService
 * 7. Save updated health status + breakdown
 */
@Injectable()
export class MonitoringWebhookService {
  private readonly logger = new Logger(MonitoringWebhookService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly healthAggregation: HealthAggregationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Main entry point — called by the controller.
   */
  async processWebhook(
    provider: string,
    headers: Record<string, string>,
    payload: any,
  ): Promise<void> {
    // 1. Validate webhook secret
    this.validateSecret(headers);

    // 2. Normalize payload
    const event = this.normalizePayload(provider, payload);
    if (!event) {
      this.logger.warn(`Unrecognized webhook payload from provider=${provider}`);
      return;
    }

    this.logger.log(
      `Webhook event: monitor="${event.monitorName}" status=${event.status} provider=${provider}`,
    );

    // 3. Parse monitor name convention [CODE] TYPE LABEL
    const parsed = parseMonitorName(event.monitorName);
    if (!parsed) {
      this.logger.warn(
        `Monitor name does not follow [CODE] TYPE LABEL convention: "${event.monitorName}" — skipping`,
      );
      return;
    }

    // 4. Find site by code
    const site = await this.prisma.site.findFirst({
      where: { code: parsed.siteCode },
      include: {
        assets: {
          select: { id: true, name: true, type: true, networkInfo: true },
        },
      },
    });

    if (!site) {
      this.logger.warn(`Site not found for code "${parsed.siteCode}" — skipping webhook`);
      return;
    }

    // 5. Update cached status for the specific component
    const normalizedStatus: 'up' | 'down' | 'unknown' =
      event.status === 'maintenance' ? 'unknown' : event.status;

    const monitorStatusMap: Record<string, { status: 'up' | 'down' | 'unknown'; responseTime?: number }> = {
      [event.monitorName]: {
        status: normalizedStatus,
        responseTime: event.responseTime,
      },
    };

    // Update cached statuses in connectivity
    const updatedConnectivity = this.healthAggregation.updateCachedStatuses(
      site.connectivity,
      monitorStatusMap,
    );

    // Update cached statuses in monitored assets
    for (const asset of site.assets) {
      const networkInfo = asset.networkInfo as any;
      if (networkInfo?.monitorName === event.monitorName) {
        const updatedNetworkInfo = this.healthAggregation.updateAssetMonitorStatus(
          networkInfo,
          monitorStatusMap,
        );
        if (updatedNetworkInfo !== networkInfo) {
          await this.prisma.asset.update({
            where: { id: asset.id },
            data: { networkInfo: updatedNetworkInfo },
          });
        }
      }
    }

    // 6. Recalculate site health using existing aggregation logic
    // Build a full monitor status map from current connectivity + the new event
    const fullMonitorMap = this.buildFullMonitorStatusMap(updatedConnectivity, site.assets, monitorStatusMap);

    const assetsForHealth = site.assets.map((a) => ({
      id: a.id,
      name: a.name ?? undefined,
      type: a.type as string,
      networkInfo: a.networkInfo as any,
    }));

    const breakdown = this.healthAggregation.calculateSiteHealth(
      updatedConnectivity,
      assetsForHealth,
      fullMonitorMap,
    );

    // 7. Save health status + breakdown + updated connectivity
    const metadata = (site.metadata as Record<string, any>) || {};
    metadata.healthBreakdown = breakdown;
    metadata.lastWebhookReceived = new Date().toISOString();

    await this.prisma.site.update({
      where: { id: site.id },
      data: {
        healthStatus: breakdown.overall as PrismaHealthStatus,
        lastHealthCheck: new Date(),
        connectivity: updatedConnectivity,
        metadata,
      },
    });

    this.logger.log(
      `Site ${site.name} (${parsed.siteCode}): health updated to ${breakdown.overall} via webhook`,
    );
  }

  /**
   * Validate the webhook secret from the x-webhook-secret header.
   * If no secret is configured (dev mode), validation is skipped.
   */
  private validateSecret(headers: Record<string, string>): void {
    // Check tenant config for webhook secret first, fallback to env var
    const configuredSecret =
      this.configService.get<string>('MONITORING_WEBHOOK_SECRET');

    if (!configuredSecret) {
      // No secret configured — allow all webhooks (dev/demo mode)
      this.logger.debug('No webhook secret configured — accepting all webhooks');
      return;
    }

    const providedSecret =
      headers['x-webhook-secret'] ||
      headers['X-Webhook-Secret'] ||
      headers['x-webhook-token'] ||
      headers['X-Webhook-Token'];

    if (!providedSecret || providedSecret !== configuredSecret) {
      throw new ForbiddenException('Invalid webhook secret');
    }
  }

  /**
   * Normalize provider-specific payload to common NormalizedWebhookEvent
   */
  private normalizePayload(provider: string, payload: any): NormalizedWebhookEvent | null {
    switch (provider) {
      case 'kuma':
        return this.normalizeKuma(payload);
      case 'gatus':
        return this.normalizeGatus(payload);
      default:
        return null;
    }
  }

  /**
   * Normalize Uptime Kuma webhook payload.
   * Kuma sends: { monitor: { name, url, type }, heartbeat: { status: 0|1|2|3, msg, time, ping } }
   * Status: 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
   */
  private normalizeKuma(payload: any): NormalizedWebhookEvent | null {
    const monitorName = payload?.monitor?.name;
    if (!monitorName) return null;

    const heartbeat = payload?.heartbeat || {};
    const statusMap: Record<number, 'up' | 'down' | 'unknown' | 'maintenance'> = {
      0: 'down',
      1: 'up',
      2: 'unknown',
      3: 'maintenance',
    };

    return {
      monitorName,
      status: statusMap[heartbeat.status] ?? 'unknown',
      message: heartbeat.msg || payload?.msg || '',
      timestamp: heartbeat.time ? new Date(heartbeat.time) : new Date(),
      responseTime: heartbeat.ping ?? undefined,
    };
  }

  /**
   * Normalize Gatus webhook payload.
   * Gatus sends (custom webhook alert): { endpoint_name, condition_results, resolved, triggered }
   * resolved=true means the endpoint is back UP, resolved=false means it went DOWN
   */
  private normalizeGatus(payload: any): NormalizedWebhookEvent | null {
    // Gatus custom webhook format
    const monitorName = payload?.endpoint_name || payload?.name;
    if (!monitorName) return null;

    // resolved=true → UP, resolved=false → DOWN, triggered=true → DOWN
    let status: 'up' | 'down' | 'unknown' = 'unknown';
    if (payload.resolved === true) {
      status = 'up';
    } else if (payload.resolved === false || payload.triggered === true) {
      status = 'down';
    }

    return {
      monitorName,
      status,
      message: payload?.description || payload?.message || '',
      timestamp: new Date(),
    };
  }

  /**
   * Build a full monitor status map from cached connectivity data + new event.
   * This ensures HealthAggregation has all known statuses when recalculating.
   */
  private buildFullMonitorStatusMap(
    connectivity: any,
    assets: Array<{ networkInfo: any }>,
    newEventMap: Record<string, { status: 'up' | 'down' | 'unknown'; responseTime?: number }>,
  ): Record<string, { status: 'up' | 'down' | 'unknown'; responseTime?: number }> {
    const map: Record<string, { status: 'up' | 'down' | 'unknown'; responseTime?: number }> = {};
    const v2 = normalizeConnectivity(connectivity);

    // Collect from links
    for (const link of v2.links) {
      if (link.monitorName && link.status) {
        map[link.monitorName] = { status: link.status as 'up' | 'down' | 'unknown' };
      }
    }

    // Collect from SD-WAN
    if (v2.sdwan?.monitorName && v2.sdwan.status) {
      map[v2.sdwan.monitorName] = { status: v2.sdwan.status as 'up' | 'down' | 'unknown' };
    }

    // Collect from assets
    for (const asset of assets) {
      const ni = asset.networkInfo as any;
      if (ni?.monitorName && ni?.monitorStatus) {
        map[ni.monitorName] = { status: ni.monitorStatus };
      }
    }

    // Override with the new event data (most recent)
    Object.assign(map, newEventMap);

    return map;
  }
}
