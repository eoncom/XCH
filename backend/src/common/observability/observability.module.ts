import { Global, Module } from '@nestjs/common';
import { WorkerEventLogger } from './worker-event-logger.service';

/**
 * Global observability module — exposes WorkerEventLogger for structured
 * BullMQ queue event logging (Loki/Sentry-ready JSON).
 *
 * `@Global()` because every queue processor (current + future) needs to
 * emit consistent events without each business module re-importing.
 * Following the explicit-import discipline (XCH_NESTJS_GLOBAL_MODULE_TRAP),
 * any module whose providers inject WorkerEventLogger should still declare
 * `ObservabilityModule` in its imports[] for self-containment in worker /
 * test root-module contexts.
 */
@Global()
@Module({
  providers: [WorkerEventLogger],
  exports: [WorkerEventLogger],
})
export class ObservabilityModule {}
