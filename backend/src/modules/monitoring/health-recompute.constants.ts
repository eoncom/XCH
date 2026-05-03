/**
 * Queue + job names for the per-site debounced health recompute pipeline
 * (ADR-022). Extracted into a separate file to avoid the circular import
 * between `health-aggregation.service` (which enqueues) and
 * `health-recompute.processor` (which dequeues + calls the service).
 */
export const HEALTH_RECOMPUTE_QUEUE = 'health-recompute';
export const JOB_RECOMPUTE = 'recompute';
