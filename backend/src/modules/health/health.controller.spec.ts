import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService, HealthSnapshot } from './health.service';

function buildController() {
  const service = {
    checkAll: jest.fn(),
  };
  const controller = new HealthController(service as unknown as HealthService);
  return { controller, service };
}

function fakeRes() {
  return { status: jest.fn() } as unknown as Parameters<HealthController['check']>[0] & {
    status: jest.Mock;
  };
}

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    status: 'ok',
    db: 'up',
    redis: 'up',
    minio: 'up',
    uptime_s: 42,
    version: 'test',
    checkedAt: '2026-05-16T00:00:00.000Z',
    details: {
      db: { status: 'up', latencyMs: 1 },
      redis: { status: 'up', latencyMs: 2 },
      minio: { status: 'up', latencyMs: 3 },
    },
    ...overrides,
  };
}

describe('HealthController (Track E.2 Pass 2)', () => {
  it('returns the snapshot unchanged when all probes are up — implicit 200', async () => {
    const { controller, service } = buildController();
    const snap = snapshot();
    service.checkAll.mockResolvedValue(snap);
    const res = fakeRes();

    const result = await controller.check(res);

    expect(result).toBe(snap);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('flips response status to 503 when aggregate is degraded (db down)', async () => {
    const { controller, service } = buildController();
    const snap = snapshot({
      status: 'degraded',
      db: 'down',
      details: {
        db: { status: 'down', latencyMs: 3000, error: 'timeout' },
        redis: { status: 'up', latencyMs: 2 },
        minio: { status: 'up', latencyMs: 3 },
      },
    });
    service.checkAll.mockResolvedValue(snap);
    const res = fakeRes();

    const result = await controller.check(res);

    expect(result).toBe(snap);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('flips to 503 when redis is down (other probes up)', async () => {
    const { controller, service } = buildController();
    service.checkAll.mockResolvedValue(
      snapshot({
        status: 'degraded',
        redis: 'down',
        details: {
          db: { status: 'up', latencyMs: 1 },
          redis: { status: 'down', latencyMs: 3000, error: 'ECONNREFUSED' },
          minio: { status: 'up', latencyMs: 3 },
        },
      }),
    );
    const res = fakeRes();

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('flips to 503 when minio is down (other probes up)', async () => {
    const { controller, service } = buildController();
    service.checkAll.mockResolvedValue(
      snapshot({
        status: 'degraded',
        minio: 'down',
        details: {
          db: { status: 'up', latencyMs: 1 },
          redis: { status: 'up', latencyMs: 2 },
          minio: { status: 'down', latencyMs: 3000, error: 'HTTP 500' },
        },
      }),
    );
    const res = fakeRes();

    await controller.check(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
