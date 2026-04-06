import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  NotificationChannel,
  NotificationChannelsConfig,
  NotificationEventsConfig,
  ChannelConfig,
  EventConfig,
  getDefaultConfig,
  NOTIFICATION_EVENTS,
} from './notification-events';

export interface ResolvedConfig {
  channels: NotificationChannelsConfig;
  events: NotificationEventsConfig;
  /** Indicates where each setting comes from */
  inheritance: {
    channels: Record<string, { source: string; scopeType: string; scopeId: string }>;
    events: Record<string, { source: string; scopeType: string; scopeId: string }>;
  };
}

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);

  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create notification config for a scope.
   */
  async getConfig(tenantId: string, scopeType: string, scopeId: string) {
    let config = await this.prisma.notificationConfig.findUnique({
      where: { tenantId_scopeType_scopeId: { tenantId, scopeType, scopeId } },
    });

    if (!config) {
      // Return default config (not persisted until saved)
      const defaults = getDefaultConfig();
      return {
        id: null,
        tenantId,
        scopeType,
        scopeId,
        channels: scopeType === 'TENANT' ? defaults.channels : this.inheritAllChannels(),
        events: scopeType === 'TENANT' ? defaults.events : this.inheritAllEvents(),
        isDefault: true,
      };
    }

    return {
      ...config,
      isDefault: false,
    };
  }

  /**
   * Save notification config for a scope.
   */
  async saveConfig(tenantId: string, scopeType: string, scopeId: string, data: { channels: any; events: any }) {
    return this.prisma.notificationConfig.upsert({
      where: { tenantId_scopeType_scopeId: { tenantId, scopeType, scopeId } },
      create: {
        tenantId,
        scopeType,
        scopeId,
        channels: data.channels,
        events: data.events,
      },
      update: {
        channels: data.channels,
        events: data.events,
      },
    });
  }

  /**
   * Delete notification config for a scope (reverts to inheritance).
   */
  async deleteConfig(tenantId: string, scopeType: string, scopeId: string) {
    try {
      await this.prisma.notificationConfig.delete({
        where: { tenantId_scopeType_scopeId: { tenantId, scopeType, scopeId } },
      });
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }

  /**
   * Resolve the effective configuration for a given scope, applying inheritance.
   * Resolution order: delegation → division → tenant → defaults
   */
  async resolveConfig(
    tenantId: string,
    scopeContext?: { delegationId?: string; divisionId?: string },
  ): Promise<ResolvedConfig> {
    const defaults = getDefaultConfig();
    const inheritance: ResolvedConfig['inheritance'] = { channels: {}, events: {} };

    // 1. Start with tenant config
    const tenantConfig = await this.prisma.notificationConfig.findUnique({
      where: { tenantId_scopeType_scopeId: { tenantId, scopeType: 'TENANT', scopeId: tenantId } },
    });

    let resolvedChannels: NotificationChannelsConfig = tenantConfig
      ? (tenantConfig.channels as any)
      : defaults.channels;
    let resolvedEvents: NotificationEventsConfig = tenantConfig
      ? (tenantConfig.events as any)
      : defaults.events;

    // Mark tenant as source
    for (const ch of Object.keys(resolvedChannels)) {
      inheritance.channels[ch] = { source: 'tenant', scopeType: 'TENANT', scopeId: tenantId };
    }
    for (const ev of Object.keys(resolvedEvents)) {
      inheritance.events[ev] = { source: 'tenant', scopeType: 'TENANT', scopeId: tenantId };
    }

    // 2. Apply division override if present
    if (scopeContext?.divisionId) {
      const divConfig = await this.prisma.notificationConfig.findUnique({
        where: {
          tenantId_scopeType_scopeId: {
            tenantId,
            scopeType: 'DIVISION',
            scopeId: scopeContext.divisionId,
          },
        },
      });

      if (divConfig) {
        const divChannels = divConfig.channels as any;
        const divEvents = divConfig.events as any;

        resolvedChannels = this.mergeChannels(resolvedChannels, divChannels);
        resolvedEvents = this.mergeEvents(resolvedEvents, divEvents);

        // Update inheritance for overridden items
        for (const [ch, cfg] of Object.entries(divChannels)) {
          if (!(cfg as any).inherit) {
            inheritance.channels[ch] = { source: 'division', scopeType: 'DIVISION', scopeId: scopeContext.divisionId };
          }
        }
        for (const [ev, cfg] of Object.entries(divEvents)) {
          if (!(cfg as any).inherit) {
            inheritance.events[ev] = { source: 'division', scopeType: 'DIVISION', scopeId: scopeContext.divisionId };
          }
        }
      }
    }

    // 3. Apply delegation override if present
    if (scopeContext?.delegationId) {
      const delConfig = await this.prisma.notificationConfig.findUnique({
        where: {
          tenantId_scopeType_scopeId: {
            tenantId,
            scopeType: 'DELEGATION',
            scopeId: scopeContext.delegationId,
          },
        },
      });

      if (delConfig) {
        const delChannels = delConfig.channels as any;
        const delEvents = delConfig.events as any;

        resolvedChannels = this.mergeChannels(resolvedChannels, delChannels);
        resolvedEvents = this.mergeEvents(resolvedEvents, delEvents);

        for (const [ch, cfg] of Object.entries(delChannels)) {
          if (!(cfg as any).inherit) {
            inheritance.channels[ch] = { source: 'delegation', scopeType: 'DELEGATION', scopeId: scopeContext.delegationId };
          }
        }
        for (const [ev, cfg] of Object.entries(delEvents)) {
          if (!(cfg as any).inherit) {
            inheritance.events[ev] = { source: 'delegation', scopeType: 'DELEGATION', scopeId: scopeContext.delegationId };
          }
        }
      }
    }

    return { channels: resolvedChannels, events: resolvedEvents, inheritance };
  }

  /**
   * Get all configs for a tenant (for admin overview).
   */
  async getAllConfigs(tenantId: string) {
    return this.prisma.notificationConfig.findMany({
      where: { tenantId },
      orderBy: { scopeType: 'asc' },
    });
  }

  /**
   * Get notification logs for a tenant.
   */
  async getLogs(tenantId: string, params?: { page?: number; pageSize?: number; eventType?: string }) {
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

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  // ──────────────── Private helpers ────────────────

  private mergeChannels(
    parent: NotificationChannelsConfig,
    child: Record<string, ChannelConfig>,
  ): NotificationChannelsConfig {
    const result = { ...parent };
    for (const [key, cfg] of Object.entries(child)) {
      if (!cfg.inherit) {
        result[key as keyof NotificationChannelsConfig] = cfg;
      }
    }
    return result;
  }

  private mergeEvents(
    parent: NotificationEventsConfig,
    child: Record<string, EventConfig>,
  ): NotificationEventsConfig {
    const result = { ...parent };
    for (const [key, cfg] of Object.entries(child)) {
      if (!cfg.inherit) {
        result[key] = cfg;
      }
    }
    return result;
  }

  private inheritAllChannels(): Record<string, ChannelConfig> {
    return {
      email: { inherit: true, enabled: false },
      teams: { inherit: true, enabled: false },
    };
  }

  private inheritAllEvents(): Record<string, EventConfig> {
    return Object.fromEntries(
      Object.keys(NOTIFICATION_EVENTS).map((key) => [
        key,
        { inherit: true, enabled: false, channels: [] },
      ]),
    );
  }
}
