import { Injectable, Logger } from '@nestjs/common';

/**
 * Structured event types emitted by worker queue handlers.
 *
 * Format: 1 JSON line per event, ingestable by Loki (promtail json stage)
 * and Sentry (S8 future — `event === 'failed'` will trigger captureException).
 *
 * Field names follow snake_case to match common observability conventions
 * (Loki labels, Datadog tags, OTLP attributes).
 */
export type WorkerEventLevel = 'info' | 'warn' | 'error';

export type WorkerEventName =
  | 'job-completed'
  | 'job-failed'
  | 'orphan-dropped'
  | 'boot-sweep';

export interface WorkerEventPayload {
  /** Origin queue name (Bull queue identifier). */
  queue: string;
  /** Bull job ID — stable across retries. */
  job_id?: string;
  /** Bull job name (e.g. `probe`, `heartbeat`, `notification-dispatch`). */
  job_name?: string;
  /** Event taxonomy. */
  event: WorkerEventName;
  /** Total attempts made (1 = first try succeeded, N = failed N-1 retries). */
  attempts?: number;
  /** Wall-clock duration of the job execution in milliseconds. */
  duration_ms?: number;

  // ── Context fields (optional, populated when known) ──
  check_id?: string;
  site_id?: string;
  tenant_id?: string;
  event_type?: string; // notification eventType
  channels_sent?: number;
  channels_failed?: number;
  /** Count, for sweep-style events. */
  count?: number;

  // ── Error details (only on `event === 'job-failed'`) ──
  error?: string;
  error_code?: string;
  /** Truncated stack to ~2KB. */
  stack?: string;
}

/**
 * Centralised structured event logger for worker queue events (BullMQ).
 *
 * Output: 1 JSON line per event via the NestJS Logger context `BullEvent`
 * — easy to grep in dev (`docker logs ... | grep BullEvent`) and parsable
 * by promtail/Loki in prod. Sentry integration (S8) plugs in here without
 * touching the call sites.
 *
 * Why a dedicated service rather than ad-hoc Logger calls : observability
 * is cross-cutting. A single service guarantees the JSON shape stays
 * consistent across every queue handler (monitor-check, notifications,
 * future health-recompute), and we have ONE place to wire Sentry / OTLP
 * exporters when we add them.
 */
@Injectable()
export class WorkerEventLogger {
  private readonly logger = new Logger('BullEvent');

  emit(level: WorkerEventLevel, payload: WorkerEventPayload): void {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...payload,
    });
    if (level === 'error') {
      this.logger.error(line);
    } else if (level === 'warn') {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }

  /** Convenience: emit a successful job completion with duration. */
  jobCompleted(
    queue: string,
    job_id: string,
    job_name: string,
    duration_ms: number,
    attempts: number,
    extra: Partial<WorkerEventPayload> = {},
  ): void {
    this.emit('info', {
      queue,
      job_id,
      job_name,
      event: 'job-completed',
      attempts,
      duration_ms,
      ...extra,
    });
  }

  /** Convenience: emit a job failure (final retry exhausted or terminal error). */
  jobFailed(
    queue: string,
    job_id: string,
    job_name: string,
    err: Error,
    attempts: number,
    extra: Partial<WorkerEventPayload> = {},
  ): void {
    const error_code = parseErrorCode(err.message);
    const stack = (err.stack ?? '').slice(0, 2048);
    this.emit('error', {
      queue,
      job_id,
      job_name,
      event: 'job-failed',
      attempts,
      error: err.message,
      error_code,
      stack,
      ...extra,
    });
  }
}

/**
 * Heuristic to surface a discrete error code (ENOTFOUND, ETIMEDOUT, …)
 * for filtering/alerting. Falls back to `undefined` when no leading code
 * token is detectable.
 */
function parseErrorCode(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const head = message.split(':')[0]?.trim();
  if (!head) return undefined;
  // Match conventional Node.js error codes : SCREAMING_SNAKE_CASE up to ~32 chars
  if (/^[A-Z][A-Z0-9_]{1,31}$/.test(head)) return head;
  return undefined;
}
