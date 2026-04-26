import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';

export const HEALTH_FILE_SCHEDULER = '/tmp/xch-worker-alive';
export const HEALTH_FILE_CONSUMER = '/tmp/xch-worker-consumer-alive';

/**
 * Worker healthcheck (ADR-014 §6 — option C).
 *
 * The worker exposes no HTTP, so the Docker healthcheck reads the mtime of
 * two files instead:
 *   - HEALTH_FILE_SCHEDULER  → touched by MonitorScheduler every 30s.
 *   - HEALTH_FILE_CONSUMER   → touched by MonitorProcessor when it consumes
 *                              a `worker-heartbeat` job (enqueued every 60s).
 * Both must be < N seconds old for the container to be `healthy`. This
 * detects (a) scheduler dead and (b) BullMQ consumer decoupled — the two
 * most common silent-failure modes.
 *
 * `/tmp/xch-worker-alive` and `/tmp/xch-worker-consumer-alive` live on the
 * container's tmpfs — ephemeral, no volume needed.
 */
@Injectable()
export class MonitorWorkerHealthService implements OnModuleInit {
  private readonly logger = new Logger(MonitorWorkerHealthService.name);

  async onModuleInit() {
    // Initial touch so the healthcheck has a fresh mtime even before the
    // first scheduler tick fires (avoids unhealthy state during start_period).
    await Promise.all([
      this.touchScheduler().catch((e) => this.logger.warn(`init touch scheduler failed: ${e.message}`)),
      this.touchConsumer().catch((e) => this.logger.warn(`init touch consumer failed: ${e.message}`)),
    ]);
  }

  async touchScheduler(): Promise<void> {
    await this.touch(HEALTH_FILE_SCHEDULER);
  }

  async touchConsumer(): Promise<void> {
    await this.touch(HEALTH_FILE_CONSUMER);
  }

  private async touch(path: string): Promise<void> {
    const now = new Date();
    try {
      // utimes throws ENOENT if the file doesn't exist yet — create it first.
      await fs.utimes(path, now, now);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.writeFile(path, '');
      } else {
        throw err;
      }
    }
  }
}
