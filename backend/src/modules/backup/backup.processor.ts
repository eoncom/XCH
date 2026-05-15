import { Process, Processor, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as Sentry from '@sentry/node';
import { BackupService } from './backup.service';
import { WorkerEventLogger } from '../../common/observability/worker-event-logger.service';
import {
  BACKUP_QUEUE,
  BACKUP_QUEUE_CONCURRENCY,
  JOB_BACKUP_FULL,
  JOB_BACKUP_SITE,
  JOB_RESTORE_FULL,
  JOB_RESTORE_SITE,
  BackupFullJobData,
  BackupSiteJobData,
  RestoreFullJobData,
  RestoreSiteJobData,
  BackupJobProgress,
} from './backup.queue';

/** Wall-clock duration since the job started processing. */
function computeDurationMs(job: Job): number {
  const start = job.processedOn ?? job.timestamp;
  return Date.now() - start;
}

/**
 * Bull v3 processor for the `backup-jobs` queue.
 *
 * Pattern repris à l'identique de `MonitorProcessor`
 * ([monitor.processor.ts:47](backend/src/modules/monitoring/monitor.processor.ts)) :
 *   - `@Processor(QUEUE)` class
 *   - `@Process(JOB_NAME)` handler per job kind
 *   - `@OnQueueCompleted` + `@OnQueueFailed` lifecycle hooks emitting
 *     structured events via `WorkerEventLogger`
 *
 * **GlitchTip / Sentry capture gratuite** : `WorkerEventLogger.jobFailed`
 * appelle `Sentry.captureException` avec les tags `mode=worker`,
 * `queue=backup-jobs`, `job_name=...` (cf ADR-024). Aucun code Sentry
 * à écrire ici.
 *
 * Progress reporting : chaque handler passe un `onProgress` callback à
 * la BackupService method, qui invoque `job.progress({...})`. Le
 * frontend `useBackupJob(jobId)` hook polle `GET /backup/jobs/:jobId`
 * toutes les 2 s et lit ce payload.
 *
 * Track D.1 Phase 1 step 5.
 */
@Processor(BACKUP_QUEUE)
export class BackupProcessor {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private readonly backup: BackupService,
    private readonly events: WorkerEventLogger,
  ) {}

  // -------------------------------------------------------------------------
  // Backup handlers
  // -------------------------------------------------------------------------

  @Process({ name: JOB_BACKUP_FULL, concurrency: BACKUP_QUEUE_CONCURRENCY })
  async handleBackupFull(job: Job<BackupFullJobData>): Promise<unknown> {
    const { tenantId, userId, options } = job.data;
    this.logger.log(
      `Processing ${JOB_BACKUP_FULL} job ${job.id} for tenant ${tenantId}`,
    );
    // Track D.2 Step 3 — wrap the handler in a Sentry transaction so the
    // 5 phase sub-spans emitted inside `createFullBackupV2` become children
    // of this parent. `op: 'backup'` makes the `tracesSampler` in init.ts
    // sample at 100%. PII-light tags only (tenant id is a UUID).
    return Sentry.startSpan(
      {
        name: 'backup.full',
        op: 'backup',
        attributes: {
          tenant_id: tenantId,
          backup_format_version: 2,
          encrypted: options?.encrypt ?? false,
          job_id: String(job.id),
        },
      },
      () =>
        this.backup.createFullBackupV2(
          tenantId,
          userId,
          options ?? {},
          this.makeProgressCallback(job),
        ),
    );
  }

  @Process({ name: JOB_BACKUP_SITE, concurrency: BACKUP_QUEUE_CONCURRENCY })
  async handleBackupSite(job: Job<BackupSiteJobData>): Promise<unknown> {
    const { tenantId, siteId, userId } = job.data;
    this.logger.log(
      `Processing ${JOB_BACKUP_SITE} job ${job.id} for tenant ${tenantId} site ${siteId}`,
    );
    // V1 path : site-specific streaming v2 is deferred to a future Phase
    // (Track D.1 scope is full-backup v2 ; site-backup gets the async
    // enqueue wrapper but the underlying body stays v1 — coexistence).
    // We still wrap it in a parent transaction so the trace appears in
    // GlitchTip alongside the full backup ones for ops parity.
    return Sentry.startSpan(
      {
        name: 'backup.site',
        op: 'backup',
        attributes: {
          tenant_id: tenantId,
          site_id: siteId,
          job_id: String(job.id),
        },
      },
      () => this.backup.createSiteBackup(tenantId, siteId, userId),
    );
  }

  // -------------------------------------------------------------------------
  // Restore handlers
  // -------------------------------------------------------------------------

  @Process({ name: JOB_RESTORE_FULL, concurrency: BACKUP_QUEUE_CONCURRENCY })
  async handleRestoreFull(job: Job<RestoreFullJobData>): Promise<unknown> {
    const { tenantId, backupId, userId, options, tmpUploadPath, tmpSidecarPath } = job.data;
    const isMultipart = !!tmpUploadPath;
    this.logger.log(
      `Processing ${JOB_RESTORE_FULL} job ${job.id} for tenant ${tenantId} ` +
        (isMultipart
          ? `from multipart upload ${tmpUploadPath}`
          : `from backup ${backupId}`) +
        ` (dryRun=${options?.dryRun ?? false})`,
    );
    return Sentry.startSpan(
      {
        name: 'backup.restore.full',
        op: 'backup',
        attributes: {
          tenant_id: tenantId,
          backup_id: backupId ?? '',
          source: isMultipart ? 'multipart-upload' : 'catalog',
          dry_run: options?.dryRun ?? false,
          backup_format_version: 2,
          job_id: String(job.id),
        },
      },
      () =>
        this.backup.restoreFullBackupV2(
          tenantId,
          backupId ?? null,
          options ?? {},
          this.makeProgressCallback(job),
          userId,
          isMultipart
            ? { tmpZipPath: tmpUploadPath!, tmpSidecarPath }
            : undefined,
        ),
    );
  }

  @Process({ name: JOB_RESTORE_SITE, concurrency: BACKUP_QUEUE_CONCURRENCY })
  async handleRestoreSite(_job: Job<RestoreSiteJobData>): Promise<never> {
    // Site restore async path is parked — current site-restore endpoint is
    // multipart-only and stays synchronous in step 5 (per scope decision).
    // Future D.2 may add JSON-mode `{backupId}` site restore behind this job
    // name. For now, refuse explicitly rather than silently misbehaving.
    throw new Error(
      `${JOB_RESTORE_SITE} not yet implemented — use POST /backup/site/restore ` +
        `multipart endpoint (synchronous v1 path)`,
    );
  }

  // -------------------------------------------------------------------------
  // Queue lifecycle hooks → structured events (Loki + Sentry via ADR-024)
  // -------------------------------------------------------------------------

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    const duration_ms = computeDurationMs(job);
    this.events.jobCompleted(
      BACKUP_QUEUE,
      String(job.id),
      job.name,
      duration_ms,
      job.attemptsMade + 1,
      { tenant_id: job.data?.tenantId },
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    // Mirror MonitorProcessor logic : only emit on FINAL failure (after
    // retries exhausted). With BACKUP_JOB_OPTIONS.attempts=1 this fires
    // immediately on the first failure — no retry storm of 5GB jobs.
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const duration_ms = computeDurationMs(job);
    this.events.jobFailed(
      BACKUP_QUEUE,
      String(job.id),
      job.name,
      err,
      job.attemptsMade,
      { tenant_id: job.data?.tenantId, duration_ms },
    );
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Build a `ProgressCallback` that forwards each step into `job.progress`
   * with a derived `percent` (0–100). The `BackupJobProgress` shape mirrors
   * `JobProgressResponseDto` so the frontend hook can consume it directly.
   */
  private makeProgressCallback(
    job: Job,
  ): (phase: string, current: number, total: number, message: string) => void {
    return (phase, current, total, message) => {
      const percent =
        total > 0 ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;
      const payload: BackupJobProgress = { phase, current, total, percent, message };
      // Bull v3 progress is fire-and-forget for our purposes ; we don't
      // await because the BackupService body can't backpressure on it.
      job.progress(payload).catch((err: unknown) => {
        this.logger.warn(
          `Failed to update job ${job.id} progress: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    };
  }
}
