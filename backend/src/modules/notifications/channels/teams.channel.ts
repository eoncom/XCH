import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INotificationChannel } from './channel.interface';
import { NotificationPayload, ChannelConfig } from '../notification-events';
import { validateUrl, makeSafeAxios } from '../../../common/security/network';

/**
 * MS Teams Webhook Channel.
 * Uses Incoming Webhook connector — no OAuth/App Registration needed.
 * Sends Adaptive Cards for rich formatting.
 *
 * Security (ADR-016) : the operator-supplied webhookUrl is validated against
 * the SSRF allowlist BEFORE every send/test (allowInternal=false — Teams
 * webhooks always target *.webhook.office.com, never LAN). The actual POST
 * goes through `makeSafeAxios` so the resolved IP is re-checked at connect
 * time via the safe-lookup hook — defeats DNS rebinding.
 */
@Injectable()
export class TeamsChannel implements INotificationChannel {
  readonly name = 'teams';
  private readonly logger = new Logger(TeamsChannel.name);

  constructor(private config: ConfigService) {}

  async send(payload: NotificationPayload, config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      return { success: false, error: 'No Teams webhook URL configured' };
    }

    const validation = validateUrl(webhookUrl, false);
    if (!validation.ok) {
      this.logger.warn(`Teams webhook URL rejected: ${validation.reason}`);
      return { success: false, error: `Webhook URL rejected: ${validation.reason}` };
    }

    const card = this.buildAdaptiveCard(payload);
    return this.postCard(webhookUrl, card);
  }

  async test(config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      return { success: false, error: 'No Teams webhook URL configured' };
    }

    const validation = validateUrl(webhookUrl, false);
    if (!validation.ok) {
      return { success: false, error: `Webhook URL rejected: ${validation.reason}` };
    }

    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: '✅ Test de notification XCH',
                weight: 'bolder',
                size: 'large',
                color: 'good',
              },
              {
                type: 'TextBlock',
                text: 'La configuration du webhook Teams est fonctionnelle.',
                wrap: true,
              },
            ],
          },
        },
      ],
    };

    return this.postCard(webhookUrl, card);
  }

  private async postCard(webhookUrl: string, card: any): Promise<{ success: boolean; error?: string }> {
    const { client, cleanup } = makeSafeAxios(false, { timeoutMs: 10000 });
    try {
      const res = await client.post(webhookUrl, card, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status >= 200 && res.status < 300) return { success: true };
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
      return { success: false, error: `Teams webhook returned ${res.status}: ${body}` };
    } catch (err: any) {
      this.logger.error(`Failed to send Teams notification: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      cleanup();
    }
  }

  private buildAdaptiveCard(payload: NotificationPayload): any {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');

    const actions: any[] = [];
    if (payload.actionUrl) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'Voir dans XCH',
        url: `${frontendUrl}${payload.actionUrl}`,
      });
    }

    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'ColumnSet',
                columns: [
                  {
                    type: 'Column',
                    width: 'auto',
                    items: [
                      {
                        type: 'TextBlock',
                        text: '🔔 XCH',
                        weight: 'bolder',
                        color: 'accent',
                      },
                    ],
                  },
                  {
                    type: 'Column',
                    width: 'stretch',
                    items: [
                      {
                        type: 'TextBlock',
                        text: payload.title,
                        weight: 'bolder',
                        size: 'medium',
                        wrap: true,
                      },
                    ],
                  },
                ],
              },
              {
                type: 'TextBlock',
                text: payload.bodyText,
                wrap: true,
                spacing: 'medium',
              },
              ...(payload.actor
                ? [
                    {
                      type: 'TextBlock',
                      text: `Par : ${payload.actor.name}`,
                      isSubtle: true,
                      size: 'small',
                      spacing: 'small',
                    },
                  ]
                : []),
              ...(payload.metadata?.details
                ? [
                    {
                      type: 'FactSet',
                      facts: Object.entries(payload.metadata.details).map(([title, value]) => ({
                        title,
                        value: String(value),
                      })),
                      spacing: 'medium',
                    },
                  ]
                : []),
            ],
            actions,
          },
        },
      ],
    };
  }
}
