import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { MonitorPurgeService } from './monitor-purge.service';
import { HealthAggregationService } from './health-aggregation.service';
import { HealthSyncScheduler } from './health-sync.scheduler';
import { MONITOR_QUEUE } from './monitor.scheduler';

/**
 * API-side monitoring module (ADR-014). Loaded by AppModule.
 *
 * Hosts the CRUD controller, the service (which enqueues run-now jobs on
 * the shared Redis queue) and the daily purge cron. Does NOT include the
 * BullMQ processor or the scheduler — those live in MonitoringModule and
 * run in the worker process only.
 *
 * Both modules call BullModule.registerQueue('monitor-check') — they share
 * the same Redis queue (one as producer, the other as consumer).
 */
@Module({
  imports: [BullModule.registerQueue({ name: MONITOR_QUEUE })],
  controllers: [MonitorsController],
  providers: [MonitorsService, MonitorPurgeService, HealthAggregationService, HealthSyncScheduler],
  exports: [MonitorsService, HealthAggregationService],
})
export class MonitorsApiModule {}
