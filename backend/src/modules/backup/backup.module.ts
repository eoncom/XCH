import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BackupProcessor } from './backup.processor';
import { StorageService } from '../../common/services/storage.service';
import { ObservabilityModule } from '../../common/observability/observability.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BACKUP_QUEUE } from './backup.queue';

/**
 * Backup module — Track D.1 Phase 1 step 5.
 *
 * Imports :
 *  - `BullModule.registerQueue({ name: BACKUP_QUEUE })` — both the controller
 *    (producer, `@InjectQueue`) and the BackupProcessor (consumer) need this
 *    queue registered.
 *  - `ObservabilityModule` — provides `WorkerEventLogger` for the processor's
 *    structured event emission (Loki + Sentry/GlitchTip via ADR-024).
 *
 * Worker process (worker.module.ts) must also import BackupModule so the
 * processor actually consumes jobs ; without that wiring the queue would
 * accept enqueues silently but no consumer would drain them.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: BACKUP_QUEUE }),
    ObservabilityModule,
    // Track E.4 Pass 9 — wire BACKUP_COMPLETED notification émise par
    // BackupProcessor.@OnQueueCompleted(). NotificationsModule fournit
    // NotificationEmitter + NotificationService (consumed par BackupProcessor).
    NotificationsModule,
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupProcessor, StorageService],
  exports: [BackupService, BullModule],
})
export class BackupModule {}
