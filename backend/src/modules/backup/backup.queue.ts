/**
 * Bull v3 queue constants + job data types for Track D.1 streaming backup
 * pipeline. Mirror of `monitor.scheduler.ts` MONITOR_QUEUE pattern.
 *
 * Track D.1 Phase 1 step 5 — Bull v3 wiring.
 */

export const BACKUP_QUEUE = 'backup-jobs';

export const JOB_BACKUP_FULL = 'backup-full';
export const JOB_BACKUP_SITE = 'backup-site';
export const JOB_RESTORE_FULL = 'restore-full';
export const JOB_RESTORE_SITE = 'restore-site';

/**
 * Per-handler concurrency on the backup-jobs queue (Bull v3 `@Process({ concurrency })`).
 *
 * D.1 shipped with the default `1` — single-threaded. Track D.2 Step 6
 * bumps to `2` based on the measured worker RSS (< 1 GB on a 5 GB
 * backup during D.1 round-trip integration tests, leaving comfortable
 * headroom for two concurrent jobs in the typical 4 GB container).
 *
 * **CONDITIONAL** at merge time: the bump only ships if the post-deploy
 * soak (≥ 2026-05-21, 1 week after v2.2.0) confirms RSS p95 < 50% of the
 * container limit AND zero OOM kills on `backend-worker`. If the gate
 * fails, revert the commit that introduced this constant before tagging
 * v2.3.0 — backing it down to `1` is sufficient.
 *
 * Note: per-handler concurrency × handlers = worst-case parallelism.
 * With 4 handlers (full backup, site backup, full restore, site
 * restore — though site-restore is currently a stub) all set to 2,
 * the worker may host up to 8 jobs simultaneously. The bottleneck
 * is RSS, not file descriptors or CPU.
 */
export const BACKUP_QUEUE_CONCURRENCY = 2;

/**
 * Standard Bull v3 add() options applied to every backup-jobs job by the
 * controller (no retry, 2h timeout, no removal of completed/failed for
 * audit visibility).
 *
 * Concurrency 1 is the Bull v3 default (per-process worker) — no jobs
 * run in parallel on the backup-jobs queue. Critical : N concurrent
 * backups would contend on the tmpfs + RAM, and N concurrent restores
 * could collide on DB writes despite phase transactions.
 */
export const BACKUP_JOB_OPTIONS = {
  attempts: 1, // No retry — a 5GB backup re-running silently would burn ops.
  timeout: 2 * 60 * 60 * 1000, // 2h hard cap.
  removeOnComplete: false,
  removeOnFail: false,
} as const;

export interface BackupFullJobData {
  tenantId: string;
  userId?: string;
  options: {
    dbOnly?: boolean;
    /**
     * Track D.2 Step 2 — AES-256-GCM streaming encryption.
     * Server-rejected (HTTP 412) at controller-time if XCH_MASTER_KEY is
     * absent, so the worker can trust the option at face value.
     */
    encrypt?: boolean;
  };
}

export interface BackupSiteJobData {
  tenantId: string;
  siteId: string;
  userId?: string;
}

export interface RestoreFullJobData {
  tenantId: string;
  /**
   * Backup catalog row id. EITHER `backupId` (D.1+ JSON path, downloads
   * from xch-backups) OR `tmpUploadPath` (Track D.2 Step 4.5 multipart
   * upload, processor reads the local tmp ZIP). Mutually exclusive —
   * controller enforces exactly one is set.
   */
  backupId?: string;
  userId?: string;
  /**
   * Track D.2 Step 4.5 — local tmp ZIP path produced by the multipart
   * upload endpoint. The processor reads from this path instead of
   * downloading from MinIO via `backupId`. Cleaned up via try/finally
   * in the processor after the restore completes (or fails).
   * Mutually exclusive with `backupId`.
   */
  tmpUploadPath?: string;
  /**
   * Track D.2 Step 4.5 — optional sidecar JSON path for encrypted ZIP
   * uploads. Required when the uploaded ZIP is encrypted; the
   * restoreFullBackupV2 reads it instead of `fetchSidecar` from MinIO.
   * Cleaned up alongside `tmpUploadPath`.
   */
  tmpSidecarPath?: string;
  options: {
    dryRun?: boolean;
    /**
     * Track D.2 Step 4 — cross-tenant restore. When set, the source
     * delegation is remapped to this target delegation in the live DB.
     * Permission-gated server-side: the target must belong to the caller's
     * tenantId (controller verifies via prisma.delegation.findFirst).
     * Users from the source are NOT imported in this mode.
     */
    targetDelegationId?: string;
  };
}

export interface RestoreSiteJobData {
  tenantId: string;
  backupId: string;
  userId?: string;
}

/**
 * Bull v3 `job.progress(value)` payload shape used by BackupProcessor.
 * Matches the `JobProgressResponseDto` Cas C wire shape from step 1.
 */
export interface BackupJobProgress {
  phase: string;
  current: number;
  total: number;
  percent: number;
  message: string;
}
