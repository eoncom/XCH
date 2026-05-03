import {
  Process,
  Processor,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { HealthAggregationService } from './health-aggregation.service';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';
import { HEALTH_RECOMPUTE_QUEUE, JOB_RECOMPUTE } from './health-recompute.constants';

export { HEALTH_RECOMPUTE_QUEUE, JOB_RECOMPUTE };

/**
 * Per-site serialized recompute pipeline (ADR-022).
 *
 * Why a dedicated queue : every probe transition triggers a `recomputeSite`,
 * and on a network blip a single site can fire N parallel recomputes that
 * race each other (R1 read → R2 read → R1 write CRITICAL → R2 write
 * HEALTHY = stale écrase fresh). Bull's `jobId` deduplication serialises
 * us per-site for free :
 *
 *   - `jobId = siteId` → only one job per site can be in waiting/delayed/
 *      active state at a time. Subsequent enqueue calls return the existing
 *      job (no new processing scheduled).
 *   - `delay: 300` → debounce window. A burst of N transitions in <300 ms
 *      collapses to ONE recompute that reads the converged DB state.
 *   - `removeOnComplete: true` → frees the jobId immediately after success
 *      so the next transition can enqueue cleanly.
 *
 * Trade-off : a transition arriving DURING active processing of the same
 * site won't trigger a new recompute (its enqueue dedupes against the
 * still-active job). The 5-min `HealthSyncScheduler` cron remains as a
 * safety net to catch any miss.
 */
@Processor(HEALTH_RECOMPUTE_QUEUE)
export class HealthRecomputeProcessor {
  private readonly logger = new Logger(HealthRecomputeProcessor.name);

  constructor(
    private readonly aggregator: HealthAggregationService,
    private readonly events: WorkerEventLogger,
  ) {}

  @Process(JOB_RECOMPUTE)
  async handle(job: Job<{ siteId: string; source: string }>): Promise<void> {
    const { siteId } = job.data;
    await this.aggregator.recomputeSite(siteId);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<{ siteId: string; source?: string }>) {
    const duration_ms = job.processedOn ? Math.max(0, Date.now() - job.processedOn) : 0;
    this.events.jobCompleted(
      HEALTH_RECOMPUTE_QUEUE,
      String(job.id),
      job.name,
      duration_ms,
      job.attemptsMade + 1,
      { site_id: job.data?.siteId },
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<{ siteId: string; source?: string }>, err: Error) {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const duration_ms = job.processedOn ? Math.max(0, Date.now() - job.processedOn) : 0;
    this.events.jobFailed(
      HEALTH_RECOMPUTE_QUEUE,
      String(job.id),
      job.name,
      err,
      job.attemptsMade,
      { site_id: job.data?.siteId, duration_ms },
    );
  }
}
