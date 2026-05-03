import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { HealthAggregationService } from './health-aggregation.service';

/**
 * Belt-and-suspenders refresh of Site.healthStatus every 5 minutes
 * (ADR-016 + ADR-022). The MonitorProcessor enqueues recomputes in real-
 * time on every UP↔DOWN transition — this cron rattrape un trigger raté
 * (worker restart, transient DB error, etc.).
 *
 * Post-ADR-022 : enqueue every site through the same coalesced
 * `health-recompute` queue. Bull dedup → if a site already has a delayed/
 * active recompute (just triggered by a probe), the cron's enqueue is a
 * no-op. Otherwise, the recompute fires after the 300 ms debounce. Per-
 * site serialisation prevents the cron + a probe-triggered recompute
 * racing on the same row.
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
    let enqueued = 0;
    let failed = 0;

    try {
      const sites = await this.prisma.site.findMany({ select: { id: true } });
      for (const { id } of sites) {
        try {
          await this.aggregator.enqueueRecompute(id, 'health-sync-cron');
          enqueued++;
        } catch (e: any) {
          failed++;
          this.logger.warn(`enqueueRecompute(${id}) failed: ${e.message}`);
        }
      }
      this.logger.log(
        `Health sync: ${enqueued} sites enqueued, ${failed} failed in ${Date.now() - start}ms`,
      );
    } catch (e: any) {
      this.logger.error(`Health sync top-level failure: ${e.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
