'use client';

import { useEffect, useRef, useState } from 'react';
import { backupApi, type BackupJobStatus } from '@/lib/api/backup';

/**
 * Polling interval for `GET /backup/jobs/:jobId`. 2 seconds matches the
 * BullMQ progress update cadence used by `BackupProcessor.makeProgressCallback`
 * and keeps DB load reasonable for parallel admin sessions.
 */
const POLL_INTERVAL_MS = 2000;

export interface UseBackupJobState {
  /** Latest BackupJobStatus payload, or `null` until the first poll resolves. */
  status: BackupJobStatus | null;
  /** True while the job is `waiting` or `active`. */
  isRunning: boolean;
  /** True when the job reached `completed` state. */
  isCompleted: boolean;
  /** True when the job reached `failed` state. */
  isFailed: boolean;
  /** True when the polling encountered a hard error (404, network, …). */
  isUnknown: boolean;
  /** Human-readable error message if `isFailed` or `isUnknown` is true. */
  error: string | null;
  /** Job result payload (job.returnvalue) when `isCompleted`. */
  result: unknown;
}

/**
 * Subscribe to a backup job's status via 2 s polling.
 *
 * Track D.1 step 7. Frontend side of the async Bull v3 pipeline :
 *  - `BackupProcessor` emits `job.progress({phase, percent, current, total, message})`
 *  - `GET /backup/jobs/:jobId` returns `BackupJobStatus`
 *  - This hook polls every 2 s and stops on `completed` / `failed` / `unknown`
 *
 * `unknown` covers the case where Bull has dropped the job (Redis flush,
 * job not yet flushed to disk after worker crash, etc.) — surfaces a
 * "Job introuvable" hint instead of polling indefinitely.
 *
 * Polling is cleaned up on unmount and on jobId change (the latter
 * happens when the user launches a new backup while watching a previous
 * one — the new jobId triggers a fresh subscription).
 *
 * Pass `null` as jobId to disable polling entirely (e.g. before any job
 * has been enqueued).
 */
export function useBackupJob(jobId: string | null): UseBackupJobState {
  const [status, setStatus] = useState<BackupJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUnknown, setIsUnknown] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset state when jobId changes (including transition to null).
    setStatus(null);
    setError(null);
    setIsUnknown(false);

    if (!jobId) return;

    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const next = await backupApi.getJobStatus(jobId);
        if (cancelled) return;
        setStatus(next);
        if (next.state === 'completed' || next.state === 'failed') {
          // Terminal state — stop polling.
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err: unknown) {
        if (cancelled) return;
        // 404 (job not in queue), 5xx, network failure — stop polling and
        // surface a clear "unknown" state. Avoids burning CPU on an
        // unrecoverable jobId.
        const message =
          err instanceof Error ? err.message : 'Job introuvable ou erreur réseau';
        setError(message);
        setIsUnknown(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    // First poll immediate, then every POLL_INTERVAL_MS.
    void poll();
    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  const isCompleted = status?.state === 'completed';
  const isFailed = status?.state === 'failed' || isUnknown;
  const isRunning =
    !!jobId && !isCompleted && !isFailed && !isUnknown && (
      status === null || // first poll hasn't returned yet
      status.state === 'waiting' ||
      status.state === 'active'
    );

  return {
    status,
    isRunning,
    isCompleted,
    isFailed,
    isUnknown,
    error: error ?? status?.error ?? null,
    result: status?.result,
  };
}
