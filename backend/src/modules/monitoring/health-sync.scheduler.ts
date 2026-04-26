import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { HealthAggregationService } from './health-aggregation.service';

/**
 * Belt-and-suspenders refresh of Site.healthStatus every 5 minutes
 * (ADR-016). The MonitorProcessor pushes recomputeSite() in real-time on
 * every UP↔DOWN transition (lot F) — this cron rattrape un trigger raté
 * (worker restart, transient DB error, etc.).
 *
 * Iterates every site; HealthAggregationService.recomputeSite handles each
 * one independently (a failure on one site does not block the others).
 */
@Injectable()
export class HealthSyncScheduler {
  private readonly logger = new Logger(HealthSyncScheduler.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly aggregator: HealthAggregationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshAllSites() {
    if (this.isRunning) {
      this.logger.debug('Health sync already running, skipping tick');
      return;
    }
    this.isRunning = true;

    const start = Date.now();
    let updated = 0;
    let failed = 0;

    try {
      const sites = await this.prisma.site.findMany({ select: { id: true } });
      for (const { id } of sites) {
        try {
          await this.aggregator.recomputeSite(id);
          updated++;
        } catch (e: any) {
          failed++;
          this.logger.warn(`recomputeSite(${id}) failed: ${e.message}`);
        }
      }
      this.logger.log(
        `Health sync: ${updated} sites updated, ${failed} failed in ${Date.now() - start}ms`,
      );
    } catch (e: any) {
      this.logger.error(`Health sync top-level failure: ${e.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
