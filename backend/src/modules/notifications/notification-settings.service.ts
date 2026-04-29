import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  PrismaClient,
  NotificationChannel as PrismaNotificationChannel,
  NotificationRule as PrismaNotificationRule,
  NotificationChannelKind,
  NotificationEventType,
} from '@prisma/client';
import { validateUrl } from '../../common/security/network';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NOTIFICATION_EVENTS_META, RuntimeChannelConfig } from './notification-events';

/**
 * ADR-020 — Notification settings CRUD + resolution.
 *
 * Replaces the legacy NotificationConfigService. Two normalized tables :
 *   - NotificationChannel (per kind: EMAIL, TEAMS) — webhookUrl encrypted
 *     scalar (CryptoService).
 *   - NotificationRule (per eventType) — channels[] enum array.
 *
 * Inheritance : a row at (tenantId, delegationId, …) overrides a row at
 * (tenantId, NULL, …) which itself falls back to NOTIFICATION_EVENTS_META
 * defaults if no global row exists.
 */
@Injectable()
export class NotificationSettingsService {
  private readonly logger = new Logger(NotificationSettingsService.name);

  constructor(
    private prisma: PrismaClient,
    private crypto: CryptoService,
  ) {}

  // ──────────────── CRUD shape returned to the controller ────────────────

  /**
   * Get raw settings for a scope (tenant + optional delegation).
   * Channels' webhookUrl is decrypted before returning to the UI.
   */
  async getSettings(tenantId: string, delegationId: string | null) {
    const [channels, rules] = await Promise.all([
      this.prisma.notificationChannel.findMany({
        where: { tenantId, delegationId },
        orderBy: { kind: 'asc' },
      }),
      this.prisma.notificationRule.findMany({
        where: { tenantId, delegationId },
        orderBy: { eventType: 'asc' },
      }),
    ]);

    return {
      scope: { tenantId, delegationId },
      channels: channels.map((c) => this.shapeChannelForApi(c)),
      rules: rules.map((r) => this.shapeRuleForApi(r)),
      isDefault: channels.length === 0 && rules.length === 0,
    };
  }

  /**
   * List every settings row across all scopes (super-admin overview).
   */
  async getAllSettings(tenantId: string) {
    const [channels, rules] = await Promise.all([
      this.prisma.notificationChannel.findMany({
        where: { tenantId },
        orderBy: [{ delegationId: 'asc' }, { kind: 'asc' }],
      }),
      this.prisma.notificationRule.findMany({
        where: { tenantId },
        orderBy: [{ delegationId: 'asc' }, { eventType: 'asc' }],
      }),
    ]);

    return {
      channels: channels.map((c) => this.shapeChannelForApi(c)),
      rules: rules.map((r) => this.shapeRuleForApi(r)),
    };
  }

  /**
   * Upsert channels + rules in a single transaction. Replaces the prior
   * setting at this scope (kinds/events not present in the DTO are deleted).
   * webhookUrl is encrypted at-rest (ADR-019) before persist.
   */
  async saveSettings(
    tenantId: string,
    delegationId: string | null,
    dto: SaveSettingsInput,
  ) {
    // ADR-016 SSRF defense — Teams webhook URL must be public *.webhook.office.com
    // Re-validated at every send anyway, but reject early so we don't store junk.
    for (const ch of dto.channels) {
      if (ch.kind === NotificationChannelKind.TEAMS && ch.webhookUrl) {
        const validation = validateUrl(ch.webhookUrl, false);
        if (!validation.ok) {
          throw new BadRequestException(
            `Teams webhook URL rejected: ${validation.reason}`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const incomingKinds = new Set(dto.channels.map((c) => c.kind));
      const incomingEvents = new Set(dto.rules.map((r) => r.eventType));

      // Delete channels/rules that are no longer in the payload
      await tx.notificationChannel.deleteMany({
        where: {
          tenantId,
          delegationId,
          kind: { notIn: Array.from(incomingKinds) },
        },
      });
      await tx.notificationRule.deleteMany({
        where: {
          tenantId,
          delegationId,
          eventType: { notIn: Array.from(incomingEvents) },
        },
      });

      // Upsert each channel
      for (const ch of dto.channels) {
        await tx.notificationChannel.upsert({
          where: {
            tenantId_delegationId_kind: { tenantId, delegationId, kind: ch.kind },
          },
          create: {
            tenantId,
            delegationId,
            kind: ch.kind,
            enabled: ch.enabled ?? true,
            recipients: ch.recipients ?? [],
            webhookUrl: this.crypto.encryptIfPlain(ch.webhookUrl ?? null),
          },
          update: {
            enabled: ch.enabled ?? true,
            recipients: ch.recipients ?? [],
            webhookUrl: this.crypto.encryptIfPlain(ch.webhookUrl ?? null),
          },
        });
      }

      // Upsert each rule
      for (const rule of dto.rules) {
        await tx.notificationRule.upsert({
          where: {
            tenantId_delegationId_eventType: {
              tenantId,
              delegationId,
              eventType: rule.eventType,
            },
          },
          create: {
            tenantId,
            delegationId,
            eventType: rule.eventType,
            enabled: rule.enabled ?? true,
            channels: rule.channels ?? [],
          },
          update: {
            enabled: rule.enabled ?? true,
            channels: rule.channels ?? [],
          },
        });
      }

      return this.getSettings(tenantId, delegationId);
    });
  }

  /**
   * Delete every channel + rule at this scope (revert to inheritance).
   */
  async deleteSettings(tenantId: string, delegationId: string | null) {
    const [c, r] = await Promise.all([
      this.prisma.notificationChannel.deleteMany({ where: { tenantId, delegationId } }),
      this.prisma.notificationRule.deleteMany({ where: { tenantId, delegationId } }),
    ]);
    return { deletedChannels: c.count, deletedRules: r.count };
  }

  // ──────────────── Resolution (used by processor + UI debug view) ────────────────

  /**
   * Resolve effective channels + rules for a given (tenant, delegation).
   * Inheritance order : delegation > global (delegationId=null) > defaults.
   *
   * For channels : delegation row overrides a global row of the same kind.
   * For rules : delegation row overrides a global row of the same eventType.
   * Falls back to NOTIFICATION_EVENTS_META.defaultChannels for events with
   * no row at any level.
   *
   * webhookUrl is decrypted to plaintext for downstream senders.
   */
  async resolveSettings(tenantId: string, delegationId: string | null | undefined) {
    const [globalChannels, globalRules, delChannels, delRules] = await Promise.all([
      this.prisma.notificationChannel.findMany({
        where: { tenantId, delegationId: null },
      }),
      this.prisma.notificationRule.findMany({
        where: { tenantId, delegationId: null },
      }),
      delegationId
        ? this.prisma.notificationChannel.findMany({
            where: { tenantId, delegationId },
          })
        : Promise.resolve([] as PrismaNotificationChannel[]),
      delegationId
        ? this.prisma.notificationRule.findMany({
            where: { tenantId, delegationId },
          })
        : Promise.resolve([] as PrismaNotificationRule[]),
    ]);

    // Channel resolution : delegation > global
    const channelByKind = new Map<NotificationChannelKind, PrismaNotificationChannel>();
    for (const c of globalChannels) channelByKind.set(c.kind, c);
    for (const c of delChannels) channelByKind.set(c.kind, c); // override

    // Rule resolution : delegation > global > meta default
    const ruleByEvent = new Map<NotificationEventType, ResolvedRule>();
    for (const r of globalRules) ruleByEvent.set(r.eventType, this.toResolvedRule(r, 'global'));
    for (const r of delRules) ruleByEvent.set(r.eventType, this.toResolvedRule(r, 'delegation'));
    for (const eventType of Object.keys(NOTIFICATION_EVENTS_META) as NotificationEventType[]) {
      if (!ruleByEvent.has(eventType)) {
        ruleByEvent.set(eventType, {
          eventType,
          enabled: true,
          channels: NOTIFICATION_EVENTS_META[eventType].defaultChannels,
          source: 'default',
        });
      }
    }

    return {
      channels: Array.from(channelByKind.values()).map((c) => this.toRuntimeConfig(c)),
      rules: Array.from(ruleByEvent.values()),
    };
  }

  // ──────────────── NotificationLog queries ────────────────

  async getLogs(
    tenantId: string,
    params?: { page?: number; pageSize?: number; eventType?: string },
  ) {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const where: any = { tenantId };
    if (params?.eventType) where.eventType = params.eventType;

    const [data, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ──────────────── Shape helpers ────────────────

  /**
   * Decrypted shape for the API. webhookUrl is in plaintext so the UI can
   * compute a hint (***last4) ; the front never gets the v1: envelope.
   */
  private shapeChannelForApi(c: PrismaNotificationChannel) {
    const plainWebhook = this.crypto.decryptOrLegacy(c.webhookUrl);
    return {
      id: c.id,
      kind: c.kind,
      enabled: c.enabled,
      recipients: c.recipients,
      webhookUrl: plainWebhook,
      webhookUrlSet: !!plainWebhook,
      webhookUrlHint: plainWebhook ? `…${plainWebhook.slice(-12)}` : null,
    };
  }

  private shapeRuleForApi(r: PrismaNotificationRule) {
    return {
      id: r.id,
      eventType: r.eventType,
      enabled: r.enabled,
      channels: r.channels,
    };
  }

  private toRuntimeConfig(c: PrismaNotificationChannel): RuntimeChannelConfig & {
    enabled: boolean;
  } {
    return {
      kind: c.kind,
      recipients: c.recipients,
      webhookUrl: this.crypto.decryptOrLegacy(c.webhookUrl),
      enabled: c.enabled,
    };
  }

  private toResolvedRule(r: PrismaNotificationRule, source: ResolvedRule['source']): ResolvedRule {
    return {
      eventType: r.eventType,
      enabled: r.enabled,
      channels: r.channels,
      source,
    };
  }
}

// ──────────────── Types ────────────────

export interface SaveSettingsChannelInput {
  kind: NotificationChannelKind;
  enabled?: boolean;
  recipients?: string[];
  webhookUrl?: string | null;
}

export interface SaveSettingsRuleInput {
  eventType: NotificationEventType;
  enabled?: boolean;
  channels?: NotificationChannelKind[];
}

export interface SaveSettingsInput {
  channels: SaveSettingsChannelInput[];
  rules: SaveSettingsRuleInput[];
}

export interface ResolvedRule {
  eventType: NotificationEventType;
  enabled: boolean;
  channels: NotificationChannelKind[];
  source: 'global' | 'delegation' | 'default';
}
