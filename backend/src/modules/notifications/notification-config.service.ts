import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  inheritance: {
    channels: Record<string, { source: string; delegationId: string | null }>;
    events: Record<string, { source: string; delegationId: string | null }>;
  };
}

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);

  constructor(private prisma: PrismaClient) {}

  /**
   * Get notification config for a delegation (or global if delegationId=null).
   */
  async getConfig(tenantId: string, delegationId: string | null) {
    const config = await this.prisma.notificationConfig.findFirst({
      where: { tenantId, delegationId },
    });

    if (!config) {
      const defaults = getDefaultConfig();
      return {
        id: null,
        tenantId,
        delegationId,
        channels: delegationId === null ? defaults.channels : this.inheritAllChannels(),
        events: delegationId === null ? defaults.events : this.inheritAllEvents(),
        isDefault: true,
      };
    }

    return { ...config, isDefault: false };
  }

  /**
   * Save notification config for a delegation (or global).
   */
  async saveConfig(tenantId: string, delegationId: string | null, data: { channels: any; events: any }) {
    // Find existing config
    const existing = await this.prisma.notificationConfig.findFirst({
      where: { tenantId, delegationId },
    });

    if (existing) {
      return this.prisma.notificationConfig.update({
        where: { id: existing.id },
        data: {
          channels: data.channels,
          events: data.events,
        },
      });
    }

    return this.prisma.notificationConfig.create({
      data: {
        tenantId,
        delegationId,
        channels: data.channels,
        events: data.events,
      } as any,
    });
  }

  /**
   * Delete notification config for a delegation (reverts to inheritance).
   */
  async deleteConfig(tenantId: string, delegationId: string | null) {
    try {
      const config = await this.prisma.notificationConfig.findFirst({
        where: { tenantId, delegationId },
      });
      if (config) {
        await this.prisma.notificationConfig.delete({ where: { id: config.id } });
      }
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }

  /**
   * Resolve effective config for a delegation with inheritance (R4).
   * Resolution order: delegation → global (tenant, delegationId=null) → defaults
   */
  async resolveConfig(tenantId: string, delegationId?: string): Promise<ResolvedConfig> {
    const defaults = getDefaultConfig();
    const inheritance: ResolvedConfig['inheritance'] = { channels: {}, events: {} };

    // 1. Start with global config (delegationId=null)
    const globalConfig = await this.prisma.notificationConfig.findFirst({
      where: { tenantId, delegationId: null },
    });

    let resolvedChannels: NotificationChannelsConfig = globalConfig
      ? (globalConfig.channels as any)
      : defaults.channels;
    let resolvedEvents: NotificationEventsConfig = globalConfig
      ? (globalConfig.events as any)
      : defaults.events;

    // Mark global as source
    for (const ch of Object.keys(resolvedChannels)) {
      inheritance.channels[ch] = { source: 'global', delegationId: null };
    }
    for (const ev of Object.keys(resolvedEvents)) {
      inheritance.events[ev] = { source: 'global', delegationId: null };
    }

    // 2. Apply delegation override if present
    if (delegationId) {
      const delConfig = await this.prisma.notificationConfig.findFirst({
        where: { tenantId, delegationId },
      });

      if (delConfig) {
        const delChannels = delConfig.channels as any;
        const delEvents = delConfig.events as any;

        resolvedChannels = this.mergeChannels(resolvedChannels, delChannels);
        resolvedEvents = this.mergeEvents(resolvedEvents, delEvents);

        for (const [ch, cfg] of Object.entries(delChannels)) {
          if (!(cfg as any).inherit) {
            inheritance.channels[ch] = { source: 'delegation', delegationId };
          }
        }
        for (const [ev, cfg] of Object.entries(delEvents)) {
          if (!(cfg as any).inherit) {
            inheritance.events[ev] = { source: 'delegation', delegationId };
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
      orderBy: { createdAt: 'asc' },
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
