import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient, NotificationChannelKind } from '@prisma/client';
import { NotificationSettingsService } from './notification-settings.service';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { INotificationChannel } from './channels/channel.interface';
import { NotificationPayload, RuntimeChannelConfig } from './notification-events';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const JOB_DISPATCH = 'notification-dispatch';

/**
 * Consumes the `notifications` BullMQ queue (ADR-020).
 *
 * Job `notification-dispatch` :
 *   1. Resolve the rule for (tenantId, delegationId, eventType).
 *   2. If disabled → log + return success.
 *   3. Resolve runtime configs for each channel kind in the rule.
 *   4. Fan-out : Promise.all of channel.send() — each writes its own
 *      NotificationLog row.
 *   5. If at least one channel failed transiently, throw → BullMQ retries
 *      (3 attempts, exponential backoff).
 *
 * Retry policy (set when adding the job, see notification.service.ts) :
 *   { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly channelMap: Map<NotificationChannelKind, INotificationChannel>;

  constructor(
    private prisma: PrismaClient,
    private settingsService: NotificationSettingsService,
    private emailChannel: EmailChannel,
    private teamsChannel: TeamsChannel,
    private events: WorkerEventLogger,
  ) {
    this.channelMap = new Map<NotificationChannelKind, INotificationChannel>([
      [NotificationChannelKind.EMAIL, this.emailChannel],
      [NotificationChannelKind.TEAMS, this.teamsChannel],
    ]);
  }

  @Process(JOB_DISPATCH)
  async dispatch(job: Job<NotificationPayload>): Promise<{ sent: number; failed: number }> {
    const payload = job.data;
    this.logger.debug(
      `dispatch ${payload.eventType} for tenant=${payload.tenantId} ` +
        `(attempt ${job.attemptsMade + 1})`,
    );

    // Enrich delegationId from siteId if needed
    const delegationId = await this.resolveDelegationFromContext(payload);

    const resolved = await this.settingsService.resolveSettings(
      payload.tenantId,
      delegationId,
    );

    const rule = resolved.rules.find((r) => r.eventType === payload.eventType);
    if (!rule || !rule.enabled) {
      this.logger.debug(
        `Event ${payload.eventType} disabled for tenant=${payload.tenantId} — skipping`,
      );
      return { sent: 0, failed: 0 };
    }

    // Index resolved channels by kind for fast lookup
    const configByKind = new Map<NotificationChannelKind, RuntimeChannelConfig & { enabled: boolean }>();
    for (const c of resolved.channels) {
      configByKind.set(c.kind, c);
    }

    let sent = 0;
    let failed = 0;
    const transientFailures: string[] = [];

    await Promise.all(
      rule.channels.map(async (kind) => {
        const channelImpl = this.channelMap.get(kind);
        if (!channelImpl) {
          this.logger.warn(`Unknown channel kind: ${kind}`);
          return;
        }
        const cfg = configByKind.get(kind);
        if (!cfg || !cfg.enabled) {
          this.logger.debug(`Channel ${kind} disabled at this scope — skipping`);
          return;
        }

        try {
          const result = await channelImpl.send(payload, cfg);
          await this.logResult(payload, kind, cfg, result);
          if (result.success) {
            sent++;
          } else {
            failed++;
            transientFailures.push(`${kind}: ${result.error ?? 'unknown'}`);
          }
        } catch (err: any) {
          this.logger.error(`Channel ${kind} threw : ${err?.message}`);
          failed++;
          transientFailures.push(`${kind}: ${err?.message ?? 'thrown'}`);
          await this.logResult(payload, kind, cfg, {
            success: false,
            error: err?.message ?? 'thrown',
          });
        }
      }),
    );

    // BullMQ retry only fires when we throw. We throw only on the last
    // attempt's worth of failures so we don't retry a permanent issue
    // (bad recipient, wrong webhook URL) endlessly. Heuristic : retry
    // until we exhaust attempts, BullMQ will mark `failed` after.
    if (failed > 0 && job.attemptsMade < (job.opts.attempts ?? 1) - 1) {
      throw new Error(
        `Notification dispatch had ${failed} failed channel(s) : ${transientFailures.join(' | ')}`,
      );
    }

    return { sent, failed };
  }

  @OnQueueCompleted()
  onCompleted(
    job: Job<NotificationPayload>,
    result: { sent: number; failed: number } | undefined,
  ) {
    const duration_ms = job.processedOn ? Math.max(0, Date.now() - job.processedOn) : 0;
    this.events.jobCompleted(
      NOTIFICATIONS_QUEUE,
      String(job.id),
      job.name,
      duration_ms,
      job.attemptsMade + 1,
      {
        tenant_id: job.data?.tenantId,
        event_type: job.data?.eventType,
        channels_sent: result?.sent,
        channels_failed: result?.failed,
      },
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<NotificationPayload>, err: Error) {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const duration_ms = job.processedOn ? Math.max(0, Date.now() - job.processedOn) : 0;
    this.events.jobFailed(
      NOTIFICATIONS_QUEUE,
      String(job.id),
      job.name,
      err,
      job.attemptsMade,
      {
        tenant_id: job.data?.tenantId,
        event_type: job.data?.eventType,
        duration_ms,
      },
    );
  }

  // ──────────────── Helpers ────────────────

  private async resolveDelegationFromContext(
    payload: NotificationPayload,
  ): Promise<string | null> {
    if (payload.scopeContext?.delegationId) {
      return payload.scopeContext.delegationId;
    }
    if (payload.scopeContext?.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: payload.scopeContext.siteId },
        select: { delegationId: true },
      });
      return site?.delegationId ?? null;
    }
    return null;
  }

  private async logResult(
    payload: NotificationPayload,
    kind: NotificationChannelKind,
    cfg: RuntimeChannelConfig,
    result: { success: boolean; error?: string },
  ) {
    try {
      const recipient =
        kind === NotificationChannelKind.EMAIL
          ? (cfg.recipients ?? []).join(', ')
          : cfg.webhookUrl ?? 'N/A';
      await this.prisma.notificationLog.create({
        data: {
          tenantId: payload.tenantId,
          eventType: payload.eventType,
          channel: kind.toLowerCase(), // keep legacy lowercase for log queries
          recipient: (recipient ?? '').substring(0, 500),
          subject: payload.title.substring(0, 500),
          success: result.success,
          errorMessage: result.error || null,
          context: {
            entityType: payload.entity.type,
            entityId: payload.entity.id,
            entityName: payload.entity.name,
            actorId: payload.actor?.id,
            actorName: payload.actor?.name,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to log notification : ${err.message}`);
    }
  }
}
