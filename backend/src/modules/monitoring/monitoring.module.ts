import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MonitorScheduler, MONITOR_QUEUE } from './monitor.scheduler';
import { MonitorProcessor } from './monitor.processor';
import { MonitorWorkerHealthService } from './monitor-worker-health.service';
import { TcpProbe } from './probes/tcp.probe';
import { HttpProbe } from './probes/http.probe';
import { IcmpProbe } from './probes/icmp.probe';
import { HealthAggregationService } from './health-aggregation.service';

/**
 * Native monitoring (ADR-014 + ADR-016). Loaded ONLY by the worker process
 * — the API does not consume the queue (it only enqueues run-now jobs via
 * MonitorsApiModule which registers the same queue as producer).
 *
 * Exports HealthAggregationService so MonitorProcessor can recompute
 * Site.healthStatus on every UP↔DOWN transition (real-time, ≤1s).
 */
@Module({
  imports: [BullModule.registerQueue({ name: MONITOR_QUEUE })],
  providers: [
    MonitorScheduler,
    MonitorProcessor,
    MonitorWorkerHealthService,
    TcpProbe,
    HttpProbe,
    IcmpProbe,
    HealthAggregationService,
  ],
  exports: [BullModule, HealthAggregationService],
})
export class MonitoringModule {}
