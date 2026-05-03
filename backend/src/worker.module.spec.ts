import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { PrismaClient } from '@prisma/client';
import { WorkerModule } from './worker.module';
import { NotificationService } from './modules/notifications/notification.service';
import { NotificationSettingsService } from './modules/notifications/notification-settings.service';
import { CryptoService } from './common/crypto/crypto.service';
import { NOTIFICATIONS_QUEUE } from './modules/notifications/notification.processor';
import { MONITOR_QUEUE } from './modules/monitoring/monitor.scheduler';
import { HEALTH_RECOMPUTE_QUEUE } from './modules/monitoring/health-recompute.processor';
import { HealthAggregationService } from './modules/monitoring/health-aggregation.service';

/**
 * Worker DI graph smoke test.
 *
 * Regression guard for the bug observed 2026-05-03 : `xch-backend-worker` in
 * restart loop because `NotificationService` injects `CryptoService` (param
 * [3]) but `NotificationsModule` did not import `CryptoModule`. The API
 * worked by chance — `AppModule` imports `CryptoModule` (`@Global()`) before
 * `NotificationsModule`, which activates the global scope. The worker root
 * (`WorkerModule`) imports `NotificationsModule` + `MonitoringModule` +
 * `DatabaseModule` only, never `CryptoModule` → activation never happens →
 * DI fails on every boot.
 *
 * Pattern XCH_NESTJS_GLOBAL_MODULE_TRAP : a `@Global()` module must be
 * imported at least once in the consumer's module subgraph to activate.
 * Relying on the root module to import it transitively is fragile across
 * modes (api / worker / isolated test).
 *
 * External infra (Postgres, Redis) is not required — `Test.compile()`
 * resolves the DI graph without invoking lifecycle hooks. PrismaClient is
 * mocked to avoid the connection attempt; Bull queue tokens are stubbed
 * to keep the test hermetic.
 */
describe('WorkerModule DI graph', () => {
  let testingModule: TestingModule;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    })
      .overrideProvider(PrismaClient)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      })
      .overrideProvider(getQueueToken(NOTIFICATIONS_QUEUE))
      .useValue({ add: jest.fn(), close: jest.fn() })
      .overrideProvider(getQueueToken(MONITOR_QUEUE))
      .useValue({ add: jest.fn(), close: jest.fn(), getJobs: jest.fn().mockResolvedValue([]) })
      .overrideProvider(getQueueToken(HEALTH_RECOMPUTE_QUEUE))
      .useValue({ add: jest.fn(), close: jest.fn() })
      .compile();
  });

  afterAll(async () => {
    await testingModule?.close();
  });

  it('compiles without DI errors', () => {
    expect(testingModule).toBeDefined();
  });

  it('resolves NotificationService (CryptoService at constructor index [3])', () => {
    const svc = testingModule.get(NotificationService);
    expect(svc).toBeInstanceOf(NotificationService);
  });

  it('resolves NotificationSettingsService (also depends on CryptoService)', () => {
    const svc = testingModule.get(NotificationSettingsService);
    expect(svc).toBeInstanceOf(NotificationSettingsService);
  });

  it('exposes CryptoService through @Global() activation in worker scope', () => {
    const crypto = testingModule.get(CryptoService);
    expect(crypto).toBeInstanceOf(CryptoService);
  });

  it('resolves HealthAggregationService with the new health-recompute queue', () => {
    // ADR-022 — new BullMQ queue `health-recompute` for per-site debounced
    // recomputes. Validate that DI wires it through MonitoringModule.
    const svc = testingModule.get(HealthAggregationService);
    expect(svc).toBeInstanceOf(HealthAggregationService);
  });
});
