import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PrismaClient } from '@prisma/client';
import { MONITOR_QUEUE, JOB_PROBE } from './monitor.scheduler';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';

/**
 * Boot-time orphan job sweep for the `monitor-check` queue.
 *
 * Context : a check can be deleted via the API while a probe job is still
 * waiting/delayed in Redis (UI delete → DB row gone, but the queued job
 * doesn't know). Without sweep, MonitorProcessor handles each orphan
 * synchronously (warns + drops), polluting prod logs and wasting Redis
 * round-trips on the consumer side. This service fixes it once at boot
 * by scanning the queue and removing jobs whose checkId is missing in DB.
 *
 * Heartbeat jobs (job_name = `heartbeat`) carry no checkId payload and
 * are left alone — they self-clean via `removeOnComplete: true`.
 *
 * Runs once on `OnModuleInit`. The 5-min cron + per-job synchronous drop
 * remain in place as safety nets for orphans created post-boot.
 */
@Injectable()
export class OrphanSweepService implements OnModuleInit {
  private readonly logger = new Logger(OrphanSweepService.name);

  constructor(
    private readonly prisma: PrismaClient,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
    private readonly events: WorkerEventLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.sweep();
    } catch (err: any) {
      this.logger.error(`boot sweep failed: ${err?.message}`);
    }
  }

  /**
   * Public for tests. Returns the number of orphan jobs removed.
   */
  async sweep(): Promise<number> {
    // Only the states where a job can still be picked up. We deliberately
    // exclude `completed` and `failed` (terminal) to avoid scanning the
    // long retention window. Heartbeat jobs are filtered out by name below.
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);

    const probeJobs = jobs.filter((j) => j.name === JOB_PROBE && j.data?.checkId);
    if (probeJobs.length === 0) {
      this.events.emit('info', {
        queue: MONITOR_QUEUE,
        event: 'boot-sweep',
        count: 0,
      });
      return 0;
    }

    const checkIds = Array.from(new Set(probeJobs.map((j) => j.data.checkId as string)));
    const present = await this.prisma.monitorCheck.findMany({
      where: { id: { in: checkIds } },
      select: { id: true },
    });
    const existing = new Set(present.map((c) => c.id));

    const orphans = probeJobs.filter((j) => !existing.has(j.data.checkId));
    if (orphans.length === 0) {
      this.events.emit('info', {
        queue: MONITOR_QUEUE,
        event: 'boot-sweep',
        count: 0,
      });
      return 0;
    }

    let removed = 0;
    for (const job of orphans) {
      try {
        await this.removeOrphan(job);
        removed++;
      } catch (err: any) {
        this.logger.warn(
          `failed to drop orphan job ${job.id} (check ${job.data?.checkId}): ${err?.message}`,
        );
      }
    }

    this.events.emit('info', {
      queue: MONITOR_QUEUE,
      event: 'boot-sweep',
      count: removed,
    });
    return removed;
  }

  private async removeOrphan(job: Job): Promise<void> {
    this.events.emit('warn', {
      queue: MONITOR_QUEUE,
      job_id: String(job.id),
      job_name: job.name,
      event: 'orphan-dropped',
      check_id: job.data?.checkId,
    });
    await job.remove();
  }
}
