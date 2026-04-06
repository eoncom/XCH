import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INotificationChannel } from './channel.interface';
import { NotificationPayload, ChannelConfig } from '../notification-events';

/**
 * MS Teams Webhook Channel.
 * Uses Incoming Webhook connector — no OAuth/App Registration needed.
 * Sends Adaptive Cards for rich formatting.
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

    try {
      const card = this.buildAdaptiveCard(payload);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Teams webhook returned ${response.status}: ${text}`);
      }

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to send Teams notification`, err);
      return { success: false, error: err.message };
    }
  }

  async test(config: ChannelConfig): Promise<{ success: boolean; error?: string }> {
    const webhookUrl = config.webhookUrl;
    if (!webhookUrl) {
      return { success: false, error: 'No Teams webhook URL configured' };
    }

    try {
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

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Teams webhook returned ${response.status}: ${text}`);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private buildAdaptiveCard(payload: NotificationPayload): any {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    const categoryColors: Record<string, string> = {
      tasks: 'accent',
      sites: 'warning',
      assets: 'attention',
      monitoring: 'attention',
      auth: 'good',
    };

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
