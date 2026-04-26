import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaClient } from '@prisma/client';
import { MonitorWorkerHealthService } from './monitor-worker-health.service';

export const MONITOR_QUEUE = 'monitor-check';
export const JOB_PROBE = 'probe';
export const JOB_HEARTBEAT = 'heartbeat';

const SCHEDULER_BATCH = 500;
const HEARTBEAT_EVERY_TICKS = 2; // 30s tick × 2 = heartbeat every 60s

/**
 * Picks every 30s the MonitorChecks whose `nextCheckAt` is due, enqueues them
 * on the BullMQ `monitor-check` queue, and immediately advances `nextCheckAt`
 * to avoid double-prises (a slow probe must not be re-enqueued on the next
 * tick). Also touches `/tmp/xch-worker-alive` and self-pings the queue every
 * 60s — both feed the Docker healthcheck (ADR-014 §6).
 */
@Injectable()
export class MonitorScheduler {
  private readonly logger = new Logger(MonitorScheduler.name);
  private tickCount = 0;

  constructor(
    private readonly prisma: PrismaClient,
    @InjectQueue(MONITOR_QUEUE) private readonly queue: Queue,
    private readonly health: MonitorWorkerHealthService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick() {
    this.tickCount++;

    // Heartbeat — proves the scheduler is alive even if no checks are due.
    await this.health.touchScheduler().catch((e) =>
      this.logger.warn(`scheduler heartbeat touch failed: ${e.message}`),
    );

    // Self-ping the queue every 60s to verify the consumer is also alive.
    if (this.tickCount % HEARTBEAT_EVERY_TICKS === 0) {
      try {
        await this.queue.add(
          JOB_HEARTBEAT,
          { ts: Date.now() },
          {
            removeOnComplete: true,
            removeOnFail: true,
            attempts: 1,
          },
        );
      } catch (e: any) {
        this.logger.warn(`enqueue heartbeat failed: ${e.message}`);
      }
    }

    // Pick due checks. We deliberately use raw findMany rather than a
    // SELECT FOR UPDATE because the scheduler is the only writer of
    // nextCheckAt — there's no concurrent dispatcher.
    const now = new Date();
    const due = await this.prisma.monitorCheck.findMany({
      where: {
        enabled: true,
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
      },
      select: { id: true, intervalSec: true },
      take: SCHEDULER_BATCH,
    });

    if (due.length === 0) return;

    // Advance nextCheckAt FIRST (idempotency: even if enqueue fails, the
    // next tick won't pick the same row again — we'll lose at most one
    // probe cycle, which is acceptable). Doing it in a single bulk update
    // would be cheaper but each row has its own intervalSec — so we batch.
    await this.prisma.$transaction(
      due.map((c) =>
        this.prisma.monitorCheck.update({
          where: { id: c.id },
          data: { nextCheckAt: new Date(now.getTime() + c.intervalSec * 1000) },
          select: { id: true },
        }),
      ),
    );

    await Promise.all(
      due.map((c) =>
        this.queue
          .add(
            JOB_PROBE,
            { checkId: c.id },
            {
              removeOnComplete: true,
              removeOnFail: 50, // keep last 50 failures for debugging
              attempts: 3,
              backoff: { type: 'exponential', delay: 500 },
            },
          )
          .catch((e) => this.logger.warn(`enqueue probe ${c.id} failed: ${e.message}`)),
      ),
    );

    this.logger.debug(`enqueued ${due.length} probe job(s)`);
  }
}
