import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationEventType, NotificationPayload } from './notification-events';

/**
 * Helper service to build and emit notification payloads.
 * Used by business services (tasks, sites, assets, auth).
 */
@Injectable()
export class NotificationEmitter {
  private readonly logger = new Logger(NotificationEmitter.name);

  constructor(private notificationService: NotificationService) {}

  // ──────────────── Task events ────────────────

  async taskAssigned(params: {
    tenantId: string;
    task: { id: string; title: string; siteId?: string };
    assignee: { id: string; name: string; email: string };
    actor?: { id: string; name: string; email: string };
  }) {
    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.TASK_ASSIGNED,
      scopeContext: { siteId: params.task.siteId },
      entity: { type: 'task', id: params.task.id, name: params.task.title },
      title: `Tâche assignée : ${params.task.title}`,
      bodyHtml: `<p>La tâche <strong>${params.task.title}</strong> a été assignée à <strong>${params.assignee.name}</strong>.</p>`,
      bodyText: `La tâche "${params.task.title}" a été assignée à ${params.assignee.name}.`,
      actionUrl: `/dashboard/tasks/${params.task.id}`,
      actor: params.actor,
      metadata: {
        details: {
          'Tâche': params.task.title,
          'Assignée à': params.assignee.name,
          'Email': params.assignee.email,
        },
      },
    });
  }

  async taskStatusChanged(params: {
    tenantId: string;
    task: { id: string; title: string; siteId?: string };
    oldStatus: string;
    newStatus: string;
    actor?: { id: string; name: string; email: string };
  }) {
    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.TASK_STATUS_CHANGED,
      scopeContext: { siteId: params.task.siteId },
      entity: { type: 'task', id: params.task.id, name: params.task.title },
      title: `Tâche "${params.task.title}" : ${params.oldStatus} → ${params.newStatus}`,
      bodyHtml: `<p>Le statut de la tâche <strong>${params.task.title}</strong> est passé de <code>${params.oldStatus}</code> à <code>${params.newStatus}</code>.</p>`,
      bodyText: `Tâche "${params.task.title}" : ${params.oldStatus} → ${params.newStatus}`,
      actionUrl: `/dashboard/tasks/${params.task.id}`,
      actor: params.actor,
      metadata: {
        details: {
          'Tâche': params.task.title,
          'Ancien statut': params.oldStatus,
          'Nouveau statut': params.newStatus,
        },
      },
    });
  }

  // ──────────────── Site events ────────────────

  async siteStatusChanged(params: {
    tenantId: string;
    site: { id: string; name: string; delegationId?: string };
    oldStatus: string;
    newStatus: string;
    actor?: { id: string; name: string; email: string };
  }) {
    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.SITE_STATUS_CHANGED,
      scopeContext: { siteId: params.site.id },
      entity: { type: 'site', id: params.site.id, name: params.site.name },
      title: `Site "${params.site.name}" : ${params.oldStatus} → ${params.newStatus}`,
      bodyHtml: `<p>Le statut du site <strong>${params.site.name}</strong> est passé de <code>${params.oldStatus}</code> à <code>${params.newStatus}</code>.</p>`,
      bodyText: `Site "${params.site.name}" : ${params.oldStatus} → ${params.newStatus}`,
      actionUrl: `/dashboard/sites/${params.site.id}`,
      actor: params.actor,
      metadata: {
        details: {
          'Site': params.site.name,
          'Ancien statut': params.oldStatus,
          'Nouveau statut': params.newStatus,
        },
      },
    });
  }

  // ──────────────── Asset events ────────────────

  async assetCritical(params: {
    tenantId: string;
    asset: { id: string; name: string; type: string; siteId?: string };
    reason: string;
    actor?: { id: string; name: string; email: string };
  }) {
    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.ASSET_CRITICAL,
      scopeContext: { siteId: params.asset.siteId },
      entity: { type: 'asset', id: params.asset.id, name: params.asset.name },
      title: `⚠️ Asset critique : ${params.asset.name}`,
      bodyHtml: `<p>L'équipement <strong>${params.asset.name}</strong> (${params.asset.type}) est en état critique.</p><p>Raison : ${params.reason}</p>`,
      bodyText: `Asset critique : ${params.asset.name} (${params.asset.type}). Raison : ${params.reason}`,
      actionUrl: `/dashboard/assets/${params.asset.id}`,
      actor: params.actor,
      metadata: {
        details: {
          'Équipement': params.asset.name,
          'Type': params.asset.type,
          'Raison': params.reason,
        },
      },
    });
  }

  // Monitoring events — MONITOR_DOWN / MONITOR_UP are dispatched directly
  // by the worker's MonitorProcessor (ADR-014 §7). The legacy
  // monitoringAlert(MONITORING_ALERT) helper was removed in ADR-016.

  // ──────────────── Auth events ────────────────

  async userInvited(params: {
    tenantId: string;
    user: { id: string; name: string; email: string };
    inviteLink: string;
    actor?: { id: string; name: string; email: string };
  }) {
    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.USER_INVITED,
      entity: { type: 'user', id: params.user.id, name: params.user.name },
      title: `Invitation : ${params.user.name}`,
      bodyHtml: `<p><strong>${params.user.name}</strong> (${params.user.email}) a été invité(e) à rejoindre XCH.</p>`,
      bodyText: `${params.user.name} (${params.user.email}) a été invité(e) à rejoindre XCH.`,
      actor: params.actor,
    });
  }

  // ──────────────── Backup events (Track E.4 Pass 9) ────────────────

  /**
   * Émis par `BackupProcessor.@OnQueueCompleted()` après JOB_BACKUP_FULL ou
   * JOB_BACKUP_SITE. Pattern figé ADR-020 + Track E.4 plan v0.1 Pass 9 wiring.
   *
   * NotificationEventType.BACKUP_COMPLETED (migration 7a_notification_event_backup_completed).
   * Le système de notification existant route ensuite vers les NotificationChannel
   * actifs pour le tenant (EMAIL / TEAMS) selon les NotificationRule configurées.
   */
  async backupCompleted(params: {
    tenantId: string;
    jobId: string;
    jobKind: 'full' | 'site';
    durationMs: number;
    sizeBytes?: number;
    actor?: { id: string; name: string; email: string };
  }) {
    const sizeLabel = params.sizeBytes
      ? ` (${(params.sizeBytes / (1024 * 1024)).toFixed(2)} MB)`
      : '';
    const durationLabel = `${(params.durationMs / 1000).toFixed(2)}s`;
    const kindLabel = params.jobKind === 'full' ? 'complet' : 'site';

    await this.notificationService.queueDispatch({
      tenantId: params.tenantId,
      eventType: NotificationEventType.BACKUP_COMPLETED,
      entity: { type: 'backup', id: params.jobId, name: `Backup ${kindLabel} ${params.jobId}` },
      title: `✅ Backup ${kindLabel} terminé`,
      bodyHtml: `<p>Le backup ${kindLabel} <code>${params.jobId}</code> s'est terminé avec succès en <strong>${durationLabel}</strong>${sizeLabel}.</p>`,
      bodyText: `Backup ${kindLabel} ${params.jobId} terminé en ${durationLabel}${sizeLabel}.`,
      actionUrl: `/dashboard/settings#backup-history`,
      actor: params.actor,
      metadata: {
        details: {
          'Type': kindLabel,
          'Job ID': params.jobId,
          'Durée': durationLabel,
          ...(params.sizeBytes ? { 'Taille': `${(params.sizeBytes / (1024 * 1024)).toFixed(2)} MB` } : {}),
        },
      },
    });
  }
}
