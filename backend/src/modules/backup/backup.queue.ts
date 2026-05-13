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
  };
}

export interface BackupSiteJobData {
  tenantId: string;
  siteId: string;
  userId?: string;
}

export interface RestoreFullJobData {
  tenantId: string;
  backupId: string;
  userId?: string;
  options: {
    dryRun?: boolean;
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
