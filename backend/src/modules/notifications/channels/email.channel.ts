import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { INotificationChannel } from './channel.interface';
import {
  NotificationChannelKind,
  NotificationPayload,
  RuntimeChannelConfig,
} from '../notification-events';

@Injectable()
export class EmailChannel implements INotificationChannel {
  readonly kind = NotificationChannelKind.EMAIL;
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailChannel.name);
  private readonly fromAddress: string;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    this.fromAddress = this.config.get('SMTP_FROM', 'noreply@xch.local');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get('SMTP_PORT', 587),
        secure: this.config.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
      this.logger.log(`Email channel configured: ${host}:${this.config.get('SMTP_PORT', 587)}`);
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async send(
    payload: NotificationPayload,
    config: RuntimeChannelConfig,
  ): Promise<{ success: boolean; error?: string }> {
    const recipients = config.recipients || [];
    if (recipients.length === 0) {
      return { success: false, error: 'No email recipients configured' };
    }

    const subject = `[XCH] ${payload.title}`;
    const html = this.buildEmailHtml(payload);

    if (!this.transporter) {
      this.logger.log(`[EMAIL-LOG] To: ${recipients.join(', ')} | Subject: ${subject}\n${payload.bodyText}`);
      return { success: true }; // logged, not actually sent
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipients.join(', '),
        subject,
        html,
      });
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${recipients.join(', ')}`, err);
      return { success: false, error: err.message };
    }
  }

  async test(config: RuntimeChannelConfig): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP not configured. Set SMTP_HOST in environment.' };
    }

    const recipients = config.recipients || [];
    if (recipients.length === 0) {
      return { success: false, error: 'No recipients configured' };
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipients[0],
        subject: '[XCH] Test de notification',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#2563eb;color:white;padding:20px;border-radius:8px 8px 0 0;">
              <h2 style="margin:0;">✅ Test de notification XCH</h2>
            </div>
            <div style="padding:20px;background:#f8fafc;border-radius:0 0 8px 8px;">
              <p>Ce message confirme que la configuration email est fonctionnelle.</p>
              <p style="color:#6b7280;font-size:12px;">Envoyé depuis XCH Notification System</p>
            </div>
          </div>
        `,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private buildEmailHtml(payload: NotificationPayload): string {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3001');
    const actionLink = payload.actionUrl
      ? `<a href="${frontendUrl}${payload.actionUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Voir dans XCH</a>`
      : '';

    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2563eb;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">${payload.title}</h2>
        </div>
        <div style="padding:20px;background:#f8fafc;border-radius:0 0 8px 8px;">
          ${payload.bodyHtml}
          ${actionLink}
          ${payload.actor ? `<p style="color:#6b7280;font-size:12px;margin-top:20px;">Par : ${payload.actor.name} (${payload.actor.email})</p>` : ''}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="color:#9ca3af;font-size:11px;">XCH — Gestion IT Sites</p>
        </div>
      </div>
    `;
  }
}
