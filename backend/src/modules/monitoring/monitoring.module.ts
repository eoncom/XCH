import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MonitorScheduler, MONITOR_QUEUE } from './monitor.scheduler';
import { MonitorProcessor } from './monitor.processor';
import { MonitorWorkerHealthService } from './monitor-worker-health.service';
import { TcpProbe } from './probes/tcp.probe';
import { HttpProbe } from './probes/http.probe';
import { IcmpProbe } from './probes/icmp.probe';

/**
 * Native monitoring (ADR-014). Loaded ONLY by the worker process — the API
 * does not consume the queue (it only enqueues run-now jobs through the
 * exported BullModule.registerQueue, wired separately in lot 4).
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
  ],
  exports: [BullModule],
})
export class MonitoringModule {}
