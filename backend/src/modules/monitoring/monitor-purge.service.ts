import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient, Prisma } from '@prisma/client';

const RETENTION_DAYS = 90;
const BATCH_SIZE = 10000;
const MAX_BATCHES_PER_RUN = 100; // hard ceiling — 1M rows per nightly run

/**
 * Daily 03:00 purge of MonitorResult rows older than RETENTION_DAYS,
 * preserving the latest result per check (so `lastStatus` stays coherent
 * even for monitors that have been inactive for > 90 days).
 *
 * Batched (10k per iteration) to avoid long table-level locks during pic
 * traffic. ADR-014 §7.
 */
@Injectable()
export class MonitorPurgeService {
  private readonly logger = new Logger(MonitorPurgeService.name);

  constructor(private readonly prisma: PrismaClient) {}

  @Cron('0 3 * * *')
  async purge() {
    let totalDeleted = 0;
    let batches = 0;
    const start = Date.now();

    while (batches < MAX_BATCHES_PER_RUN) {
      const result = await this.prisma.$executeRaw(Prisma.sql`
        WITH victims AS (
          SELECT id FROM "monitor_results"
          WHERE "checkedAt" < now() - make_interval(days => ${RETENTION_DAYS})
            AND id NOT IN (
              SELECT MAX(id) FROM "monitor_results" GROUP BY "checkId"
            )
          LIMIT ${BATCH_SIZE}
        )
        DELETE FROM "monitor_results"
        WHERE id IN (SELECT id FROM victims)
      `);
      const deleted = Number(result);
      totalDeleted += deleted;
      batches++;
      if (deleted < BATCH_SIZE) break;
    }

    this.logger.log(
      `monitor_results purge: ${totalDeleted} rows deleted in ${batches} batch(es) (${Date.now() - start}ms)`,
    );
  }
}
