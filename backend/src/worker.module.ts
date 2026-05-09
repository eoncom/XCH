import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './config/database.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { TestErrorModule } from './modules/test-error/test-error.module';

/**
 * Worker bootstrap module (ADR-014).
 *
 * Loaded when the process is started in worker mode (`--worker` flag or
 * `XCH_MODE=worker`). Hosts the BullMQ processors (monitoring probes) and
 * their scheduler. Intentionally has NO controllers, NO AuthModule and
 * NO HTTP — the worker does not expose any port.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    ObservabilityModule,
    NotificationsModule,
    MonitoringModule,
    // S8 / item 6 — processor consume `test-error` queue (job `throw`).
    // Endpoint controller côté API enqueue ; ce processor consomme côté worker.
    TestErrorModule,
  ],
})
export class WorkerModule {}
