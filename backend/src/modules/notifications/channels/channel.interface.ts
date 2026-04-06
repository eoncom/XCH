import { NotificationPayload, ChannelConfig } from '../notification-events';

/**
 * Interface for notification channels.
 * Extensible: implement this interface to add new channels (Slack, etc.)
 */
export interface INotificationChannel {
  /** Channel identifier */
  readonly name: string;

  /**
   * Send a notification through this channel.
   * @returns true if sent successfully, false otherwise
   */
  send(payload: NotificationPayload, config: ChannelConfig): Promise<{ success: boolean; error?: string }>;

  /**
   * Test the channel configuration (e.g., send test message)
   */
  test(config: ChannelConfig): Promise<{ success: boolean; error?: string }>;
}
