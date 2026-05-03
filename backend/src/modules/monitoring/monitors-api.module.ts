import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { MonitorPurgeService } from './monitor-purge.service';
import { HealthAggregationService } from './health-aggregation.service';
import { HealthSyncScheduler } from './health-sync.scheduler';
import { MonitorReactionsService } from './monitor-reactions.service';
import { MONITOR_QUEUE } from './monitor.scheduler';
import { HEALTH_RECOMPUTE_QUEUE } from './health-recompute.processor';

/**
 * API-side monitoring module (ADR-014). Loaded by AppModule.
 *
 * Hosts the CRUD controller, the service (which enqueues run-now jobs on
 * the shared Redis queue) and the daily purge cron. Does NOT include the
 * BullMQ processor or the scheduler — those live in MonitoringModule and
 * run in the worker process only.
 *
 * Both API + worker call BullModule.registerQueue() on the shared queues
 * (`monitor-check` for probes, `health-recompute` for site aggregation
 * coalescing — ADR-022). API is producer, worker is consumer.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: MONITOR_QUEUE }),
    BullModule.registerQueue({ name: HEALTH_RECOMPUTE_QUEUE }),
  ],
  controllers: [MonitorsController],
  providers: [
    MonitorsService,
    MonitorPurgeService,
    HealthAggregationService,
    HealthSyncScheduler,
    MonitorReactionsService,
  ],
  exports: [MonitorsService, HealthAggregationService, MonitorReactionsService],
})
export class MonitorsApiModule {}
