import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { NotificationChannelKind } from '@prisma/client';
import { CryptoService } from '../../common/crypto/crypto.service';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { INotificationChannel } from './channels/channel.interface';
import {
  NotificationPayload,
  RuntimeChannelConfig,
  NOTIFICATION_EVENTS_META,
} from './notification-events';
import { NOTIFICATIONS_QUEUE, JOB_DISPATCH } from './notification.processor';

/**
 * NotificationService — public façade for callers (ADR-020).
 *
 * `queueDispatch()` is what the 5 caller modules (tasks/assets/sites/
 * monitoring/auth) invoke. It pushes a job onto the BullMQ `notifications`
 * queue and returns immediately (~ms). The actual fan-out + send + log
 * happens in NotificationProcessor.
 *
 * `testChannel()` stays synchronous — testing is a UI affordance that
 * needs the result inline.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly channelMap: Map<NotificationChannelKind, INotificationChannel>;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private queue: Queue<NotificationPayload>,
    private emailChannel: EmailChannel,
    private teamsChannel: TeamsChannel,
    private crypto: CryptoService,
  ) {
    this.channelMap = new Map<NotificationChannelKind, INotificationChannel>([
      [NotificationChannelKind.EMAIL, this.emailChannel],
      [NotificationChannelKind.TEAMS, this.teamsChannel],
    ]);
  }

  /**
   * Enqueue a notification for asynchronous dispatch.
   * Non-blocking : returns once the job is pushed to Redis.
   * Errors thrown by the channels are handled in the processor.
   */
  async queueDispatch(payload: NotificationPayload): Promise<void> {
    try {
      await this.queue.add(JOB_DISPATCH, payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 }, // keep 1h or 1k jobs
        removeOnFail: { age: 86400 }, // keep 1 day for debug
      });
    } catch (err: any) {
      // Don't crash the caller if Redis is momentarily unavailable.
      this.logger.error(`Failed to enqueue notification : ${err.message}`);
    }
  }

  /**
   * Test a channel configuration synchronously. The DTO comes from the
   * UI form and is already in plaintext (recipients / webhookUrl).
   */
  async testChannel(
    kind: NotificationChannelKind,
    config: { recipients?: string[]; webhookUrl?: string | null },
  ): Promise<{ success: boolean; error?: string }> {
    const channel = this.channelMap.get(kind);
    if (!channel) {
      return { success: false, error: `Unknown channel kind: ${kind}` };
    }
    const runtimeConfig: RuntimeChannelConfig = {
      kind,
      recipients: config.recipients ?? [],
      webhookUrl: config.webhookUrl ?? null,
    };
    return channel.test(runtimeConfig);
  }

  /**
   * UI helper — list channels supported by the running build.
   */
  getAvailableChannels() {
    return Array.from(this.channelMap.entries()).map(([kind, impl]) => ({
      kind,
      label:
        kind === NotificationChannelKind.EMAIL
          ? 'Email'
          : kind === NotificationChannelKind.TEAMS
            ? 'Microsoft Teams'
            : kind,
    }));
  }

  /**
   * UI helper — list event metadata. Stays here so callers don't have to
   * import notification-events directly.
   */
  getEventCatalog() {
    return NOTIFICATION_EVENTS_META;
  }
}
