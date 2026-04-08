import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { NotificationConfigService } from './notification-config.service';
import { EmailChannel } from './channels/email.channel';
import { TeamsChannel } from './channels/teams.channel';
import { INotificationChannel } from './channels/channel.interface';
import {
  NotificationPayload,
  NotificationChannel,
  NotificationEventType,
  ChannelConfig,
} from './notification-events';

/**
 * Central Notification Service — dispatches notifications to configured channels.
 * Graceful degradation: if a channel fails, others still fire. Never blocks the caller.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly channelMap: Map<string, INotificationChannel>;

  constructor(
    private prisma: PrismaClient,
    private configService: NotificationConfigService,
    private emailChannel: EmailChannel,
    private teamsChannel: TeamsChannel,
  ) {
    this.channelMap = new Map<string, INotificationChannel>([
      [NotificationChannel.EMAIL, this.emailChannel],
      [NotificationChannel.TEAMS, this.teamsChannel],
    ]);
  }

  /**
   * Dispatch a notification.
   * Resolves config based on scope context, then sends to all enabled channels.
   * Non-blocking: errors are logged but never thrown.
   */
  async dispatch(payload: NotificationPayload): Promise<void> {
    try {
      // Resolve delegationId from scope context
      const delegationId = await this.resolveScopeContext(payload);

      // Resolve effective config with inheritance
      const config = await this.configService.resolveConfig(payload.tenantId, delegationId);

      // Check if the event is enabled
      const eventConfig = config.events[payload.eventType];
      if (!eventConfig || !eventConfig.enabled) {
        this.logger.debug(`Event ${payload.eventType} is disabled — skipping`);
        return;
      }

      // Send to each enabled channel
      const channelsToSend = eventConfig.channels || [];
      const promises = channelsToSend.map(async (channelName) => {
        const channelImpl = this.channelMap.get(channelName);
        if (!channelImpl) {
          this.logger.warn(`Unknown channel: ${channelName}`);
          return;
        }

        const channelConfig = config.channels[channelName as keyof typeof config.channels];
        if (!channelConfig || !channelConfig.enabled) {
          this.logger.debug(`Channel ${channelName} is disabled — skipping`);
          return;
        }

        try {
          const result = await channelImpl.send(payload, channelConfig);
          // Log the notification
          await this.logNotification(payload, channelName, channelConfig, result);
        } catch (err: any) {
          this.logger.error(`Error dispatching to ${channelName}: ${err.message}`);
          await this.logNotification(payload, channelName, channelConfig, {
            success: false,
            error: err.message,
          });
        }
      });

      // Fire and don't wait (non-blocking)
      Promise.all(promises).catch((err) =>
        this.logger.error(`Notification dispatch error: ${err.message}`),
      );
    } catch (err: any) {
      // Never crash the caller
      this.logger.error(`Notification system error: ${err.message}`, err.stack);
    }
  }

  /**
   * Test a specific channel configuration.
   */
  async testChannel(channelName: string, config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    const channel = this.channelMap.get(channelName);
    if (!channel) {
      return { success: false, error: `Unknown channel: ${channelName}` };
    }
    return channel.test(config);
  }

  /**
   * Get list of available channels and their status.
   */
  getAvailableChannels() {
    return Array.from(this.channelMap.entries()).map(([name, impl]) => ({
      name,
      label: name === 'email' ? 'Email' : name === 'teams' ? 'Microsoft Teams' : name,
    }));
  }

  // ──────────────── Private helpers ────────────────

  /**
   * Resolve delegation context from the payload (find delegationId from site if needed).
   */
  private async resolveScopeContext(
    payload: NotificationPayload,
  ): Promise<string | undefined> {
    // If explicit delegationId is provided, use it
    if (payload.scopeContext?.delegationId) {
      return payload.scopeContext.delegationId;
    }

    // Try to resolve from site
    if (payload.scopeContext?.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: payload.scopeContext.siteId },
        select: { delegationId: true },
      });
      if (site?.delegationId) {
        return site.delegationId;
      }
    }

    return undefined;
  }

  /**
   * Log notification to database.
   */
  private async logNotification(
    payload: NotificationPayload,
    channel: string,
    channelConfig: ChannelConfig,
    result: { success: boolean; error?: string },
  ) {
    try {
      const recipient =
        channel === 'email'
          ? (channelConfig.recipients || []).join(', ')
          : channelConfig.webhookUrl || 'N/A';

      await this.prisma.notificationLog.create({
        data: {
          tenantId: payload.tenantId,
          eventType: payload.eventType,
          channel,
          recipient: recipient.substring(0, 500),
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
      this.logger.error(`Failed to log notification: ${err.message}`);
    }
  }
}
