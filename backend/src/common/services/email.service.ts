import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    const host = this.configService.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get('SMTP_PORT', 587),
        secure: this.configService.get('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS'),
        },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const from = this.configService.get('SMTP_FROM', 'noreply@xch.local');
    if (!this.transporter) {
      this.logger.log(`[EMAIL-LOG] To: ${to} | Subject: ${subject}\n${html}`);
      return true;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, html });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
      return false;
    }
  }

  async sendInvitation(to: string, name: string, token: string, tenantName?: string) {
    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3001');
    const link = `${baseUrl}/invite?token=${token}`;
    const html = `
      <h2>Bienvenue sur XCH${tenantName ? ` — ${tenantName}` : ''}</h2>
      <p>Bonjour ${name},</p>
      <p>Vous avez été invité(e) à rejoindre la plateforme XCH.</p>
      <p>Cliquez sur le lien ci-dessous pour définir votre mot de passe et activer votre compte :</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Activer mon compte</a></p>
      <p>Ce lien est valable 72 heures.</p>
      <p><small>Si vous n'avez pas demandé cet accès, ignorez ce message.</small></p>
    `;
    return this.sendEmail(to, 'Invitation XCH — Activez votre compte', html);
  }

  async sendPasswordReset(to: string, name: string, token: string) {
    const baseUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3001');
    const link = `${baseUrl}/reset-password?token=${token}`;
    const html = `
      <h2>Réinitialisation de mot de passe</h2>
      <p>Bonjour ${name},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien est valable 1 heure.</p>
      <p><small>Si vous n'avez pas fait cette demande, ignorez ce message.</small></p>
    `;
    return this.sendEmail(to, 'XCH — Réinitialisation de mot de passe', html);
  }
}
