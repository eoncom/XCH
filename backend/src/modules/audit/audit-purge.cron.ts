import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Audit log monthly purge (Track E.4 PR1 Pass 9).
 *
 * D4.3 figé RSI (cf XCH_TRACK_E_PREPROD_READINESS_2026_05_15) :
 *   - Rétention 1 an
 *   - Purge cron mensuelle (1er du mois 03h00 UTC)
 *
 * Dry-run mode protection (premier mois) :
 *   - `AUDIT_PURGE_DRY_RUN=true` (default) : log count attendu, ne supprime PAS
 *   - `AUDIT_PURGE_DRY_RUN=false` : exécution réelle DELETE
 *
 * Bascule en production : opérateur valide premier mois dry-run, puis flip
 * `AUDIT_PURGE_DRY_RUN=false` au M+1 pour activation réelle.
 *
 * Pattern dérivé monitor-purge.service.ts (ADR-014 §7) : @Cron + batch +
 * structured logging + ceiling de sécurité.
 *
 * Sémantique nullability préservée per ADR-028 §B.0 — purge frappe TOUTES
 * les rows > 1 an indépendamment de delegationId (Cat 1/2/3/4/5/SYSTEM_CTX
 * traitées uniformément).
 */
@Injectable()
export class AuditPurgeService {
  private readonly logger = new Logger(AuditPurgeService.name);
  private readonly retentionDays = 365;
  private readonly batchSize = 10000;
  private readonly maxBatchesPerRun = 100;

  constructor(private readonly prisma: PrismaClient) {}

  private isDryRun(): boolean {
    // Default true (safe) — opérateur doit explicitement set false pour activer
    const env = process.env.AUDIT_PURGE_DRY_RUN;
    return env !== 'false';
  }

  /**
   * Cron mensuel 1er du mois 03h00 UTC.
   * Cron expression `0 3 1 * *` = at 03:00 on day-of-month 1.
   */
  @Cron('0 3 1 * *', { name: 'audit-purge-monthly' })
  async purgeMonthly() {
    const dryRun = this.isDryRun();
    const start = Date.now();

    if (dryRun) {
      const candidates = await this.prisma.auditLog.count({
        where: {
          timestamp: {
            lt: new Date(Date.now() - this.retentionDays * 24 * 3600 * 1000),
          },
        },
      });
      this.logger.log(
        `audit_logs purge (DRY-RUN) : ${candidates} row(s) would be deleted ` +
          `(retention ${this.retentionDays} days). Set AUDIT_PURGE_DRY_RUN=false to enable real DELETE.`,
      );
      return { dryRun: true, candidates, deleted: 0 };
    }

    let totalDeleted = 0;
    let batches = 0;

    while (batches < this.maxBatchesPerRun) {
      const result = await this.prisma.$executeRaw(Prisma.sql`
        WITH victims AS (
          SELECT id FROM "audit_logs"
          WHERE "timestamp" < NOW() - make_interval(days => ${this.retentionDays})
          LIMIT ${this.batchSize}
        )
        DELETE FROM "audit_logs"
        WHERE id IN (SELECT id FROM victims)
      `);
      const deleted = Number(result);
      totalDeleted += deleted;
      batches++;
      if (deleted < this.batchSize) break;
    }

    this.logger.log(
      `audit_logs purge (LIVE) : ${totalDeleted} row(s) deleted in ${batches} batch(es) ` +
        `(${Date.now() - start}ms, retention ${this.retentionDays} days)`,
    );
    return { dryRun: false, candidates: totalDeleted, deleted: totalDeleted };
  }
}
