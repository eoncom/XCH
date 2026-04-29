import { NotificationPayload, RuntimeChannelConfig } from '../notification-events';

/**
 * Sender interface for notification channels (ADR-020).
 *
 * Channels receive a `RuntimeChannelConfig` with secrets already decrypted —
 * they never touch the DB or CryptoService directly. Adding a new channel
 * (Slack, Discord, …) means : (1) extend NotificationChannelKind enum, (2)
 * implement this interface, (3) register it in NotificationProcessor.
 */
export interface INotificationChannel {
  /** Channel identifier (must match NotificationChannelKind value). */
  readonly kind: string;

  /** Send a notification. Returns success/error — never throws. */
  send(
    payload: NotificationPayload,
    config: RuntimeChannelConfig,
  ): Promise<{ success: boolean; error?: string }>;

  /** Test the configuration (e.g. send a probe message). */
  test(config: RuntimeChannelConfig): Promise<{ success: boolean; error?: string }>;
}
