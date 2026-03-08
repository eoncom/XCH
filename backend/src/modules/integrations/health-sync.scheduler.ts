import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { MonitoringProviderFactory } from './providers/monitoring-provider.factory';

/**
 * Scheduled job that automatically syncs site health status from the active monitoring provider.
 * Runs every 5 minutes to keep healthStatus up-to-date without manual intervention.
 * Acts as a safety net alongside webhooks (poll-based fallback).
 */
@Injectable()
export class HealthSyncScheduler {
  private readonly logger = new Logger(HealthSyncScheduler.name);
  private isRunning = false;

  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly monitoringFactory: MonitoringProviderFactory,
    private readonly prisma: PrismaClient,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleHealthSync() {
    // Prevent overlapping runs
    if (this.isRunning) {
      this.logger.debug('Health sync already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Get the first (and typically only) tenant — single-tenant MVP
      const tenant = await this.prisma.tenant.findFirst({
        select: { id: true, config: true },
      });

      if (!tenant) {
        this.logger.debug('No tenant found, skipping health sync');
        return;
      }

      // Check if any monitoring provider is configured (new or legacy format)
      const config = tenant.config as Record<string, any> | null;
      const activeProvider = this.monitoringFactory.getActiveProvider(config);

      if (!activeProvider) {
        this.logger.debug('No monitoring provider configured, skipping health sync');
        return;
      }

      this.logger.log(`Starting scheduled health sync (provider: ${activeProvider.getName()})...`);
      const result = await this.integrationsService.syncAllSitesHealth(tenant.id);
      this.logger.log(
        `Scheduled health sync completed: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Scheduled health sync failed: ${msg}`);
    } finally {
      this.isRunning = false;
    }
  }
}
