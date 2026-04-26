import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

const ACTIONS = {
  AUTO_DISABLED: 'MONITOR_AUTO_DISABLED',
  AUTO_DISABLED_ACK: 'MONITOR_AUTO_DISABLED_ACK',
  BULK_ENABLED: 'MONITOR_BULK_ENABLED',
} as const;

const ASSET_ACTIVE = new Set(['IN_SERVICE']);
const SITE_ACTIVE = new Set(['ACTIVE', 'PREPARATION']);

export interface AutoDisabledStatus {
  /** Monitors currently disabled by an auto-disable event for this entity. */
  disabledMonitors: Array<{
    id: string;
    target: string;
    targetPort: number | null;
    kind: string;
  }>;
  /** True when the user has acknowledged the latest auto-disable event. */
  acknowledged: boolean;
}

/**
 * Monitor reactions to entity status changes (ADR-016 §E).
 *
 * Called from AssetsService.update / SitesService.update after a status
 * transition. The frontend banner reads `getAutoDisabledStatus` to know
 * whether to display the persistent re-enable prompt.
 */
@Injectable()
export class MonitorReactionsService {
  private readonly logger = new Logger(MonitorReactionsService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /** Direct prisma call so we can use custom action strings (the
   *  AuditLogService.log API enforces CREATE/UPDATE/DELETE). */
  private async writeAudit(entry: {
    tenantId: string;
    userId?: string;
    action: string;
    entityType: string;
    entityId: string;
    changes?: Record<string, any>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: entry.changes
          ? (entry.changes as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  /**
   * Asset status changed. If the new status leaves the IN_SERVICE bucket,
   * disable every enabled MonitorCheck for this asset and log the audit
   * event so the banner can later prompt for re-enable. Returns the count
   * of monitors disabled (used by the asset response payload to toast the user).
   */
  async onAssetStatusChange(
    tenantId: string,
    assetId: string,
    oldStatus: string | null | undefined,
    newStatus: string,
    userId?: string,
  ): Promise<{ disabledCount: number }> {
    const wasActive = oldStatus ? ASSET_ACTIVE.has(oldStatus) : true;
    const isActive = ASSET_ACTIVE.has(newStatus);
    if (!wasActive || isActive) return { disabledCount: 0 };

    const result = await this.prisma.monitorCheck.updateMany({
      where: { tenantId, assetId, enabled: true },
      data: { enabled: false },
    });
    if (result.count > 0) {
      await this.writeAudit({
        tenantId,
        userId,
        action: ACTIONS.AUTO_DISABLED,
        entityType: 'asset',
        entityId: assetId,
        changes: { reason: 'asset_status_change', newStatus, count: result.count },
      });
      this.logger.log(
        `auto-disabled ${result.count} monitor(s) for asset ${assetId} (${oldStatus} → ${newStatus})`,
      );
    }
    return { disabledCount: result.count };
  }

  /**
   * Site status changed. CLOSED → disable every enabled MonitorCheck linked
   * to this site (direct, via assets, via links). ACTIVE/PREPARATION leaves
   * monitors alone.
   */
  async onSiteStatusChange(
    tenantId: string,
    siteId: string,
    oldStatus: string | null | undefined,
    newStatus: string,
    userId?: string,
  ): Promise<{ disabledCount: number }> {
    const wasActive = oldStatus ? SITE_ACTIVE.has(oldStatus) : true;
    const isActive = SITE_ACTIVE.has(newStatus);
    if (!wasActive || isActive) return { disabledCount: 0 };

    const result = await this.prisma.monitorCheck.updateMany({
      where: {
        tenantId,
        enabled: true,
        OR: [
          { siteId },
          { asset: { siteId } },
          { link: { siteId } },
        ],
      },
      data: { enabled: false },
    });
    if (result.count > 0) {
      await this.writeAudit({
        tenantId,
        userId,
        action: ACTIONS.AUTO_DISABLED,
        entityType: 'site',
        entityId: siteId,
        changes: { reason: 'site_status_change', newStatus, count: result.count },
      });
      this.logger.log(
        `auto-disabled ${result.count} monitor(s) for site ${siteId} (${oldStatus} → ${newStatus})`,
      );
    }
    return { disabledCount: result.count };
  }

  /**
   * Compute banner state for the entity detail page. The banner shows iff:
   *  - There are MonitorChecks currently disabled AND attached to this entity,
   *    AND
   *  - The latest MONITOR_AUTO_DISABLED audit log is more recent than the
   *    latest MONITOR_AUTO_DISABLED_ACK audit log.
   */
  async getAutoDisabledStatus(
    tenantId: string,
    entityType: 'asset' | 'site',
    entityId: string,
  ): Promise<AutoDisabledStatus> {
    const where = this.checksWhereForEntity(entityType, entityId, tenantId, false);
    const disabled = await this.prisma.monitorCheck.findMany({
      where,
      select: { id: true, target: true, targetPort: true, kind: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (disabled.length === 0) return { disabledMonitors: [], acknowledged: true };

    const [latestDisable, latestAck] = await Promise.all([
      this.prisma.auditLog.findFirst({
        where: { tenantId, entityType, entityId, action: ACTIONS.AUTO_DISABLED },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
      this.prisma.auditLog.findFirst({
        where: { tenantId, entityType, entityId, action: ACTIONS.AUTO_DISABLED_ACK },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ]);

    const acknowledged =
      !latestDisable ||
      (latestAck != null && latestAck.timestamp >= latestDisable.timestamp);

    return {
      disabledMonitors: disabled.map((d) => ({
        id: d.id,
        target: d.target,
        targetPort: d.targetPort,
        kind: d.kind as string,
      })),
      acknowledged,
    };
  }

  /**
   * User chose "Garder désactivés" — record an ack so the banner disappears.
   */
  async ackBanner(
    tenantId: string,
    entityType: 'asset' | 'site',
    entityId: string,
    userId?: string,
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      userId,
      action: ACTIONS.AUTO_DISABLED_ACK,
      entityType,
      entityId,
    });
  }

  /**
   * User chose "Réactiver les N monitors" — bulk re-enable + audit + ack so
   * the banner disappears.
   */
  async bulkEnable(
    tenantId: string,
    entityType: 'asset' | 'site',
    entityId: string,
    userId?: string,
  ): Promise<{ count: number }> {
    const where = this.checksWhereForEntity(entityType, entityId, tenantId, false);
    const result = await this.prisma.monitorCheck.updateMany({
      where,
      data: { enabled: true, nextCheckAt: new Date() },
    });
    if (result.count > 0) {
      await this.writeAudit({
        tenantId,
        userId,
        action: ACTIONS.BULK_ENABLED,
        entityType,
        entityId,
        changes: { count: result.count },
      });
    }
    // Always ack so the banner disappears even if 0 were re-enabled.
    await this.ackBanner(tenantId, entityType, entityId, userId);
    return { count: result.count };
  }

  private checksWhereForEntity(
    entityType: 'asset' | 'site',
    entityId: string,
    tenantId: string,
    enabled: boolean,
  ) {
    if (entityType === 'asset') {
      return { tenantId, assetId: entityId, enabled };
    }
    return {
      tenantId,
      enabled,
      OR: [{ siteId: entityId }, { asset: { siteId: entityId } }, { link: { siteId: entityId } }],
    };
  }
}
