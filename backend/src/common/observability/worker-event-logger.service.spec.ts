import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { WorkerEventLogger } from './worker-event-logger.service';

/**
 * Validates the JSON shape emitted on each event level — what Loki promtail
 * (and S8 Sentry) will parse. The contract: 1 JSON line per event with
 * mandatory `ts` + `level` + `event` + `queue` fields.
 */
describe('WorkerEventLogger', () => {
  let svc: WorkerEventLogger;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let captureSpy: jest.SpyInstance;

  beforeEach(() => {
    svc = new WorkerEventLogger();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    captureSpy = jest.spyOn(Sentry, 'captureException').mockImplementation(() => 'event-id');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const lastJson = (spy: jest.SpyInstance): any => {
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0] as string;
    return JSON.parse(arg);
  };

  describe('emit() shape', () => {
    it('emits info level via Logger.log with ts + queue + event', () => {
      svc.emit('info', { queue: 'monitor-check', event: 'job-completed' });
      const obj = lastJson(logSpy);
      expect(obj.level).toBe('info');
      expect(obj.queue).toBe('monitor-check');
      expect(obj.event).toBe('job-completed');
      expect(typeof obj.ts).toBe('string');
      expect(new Date(obj.ts).toString()).not.toBe('Invalid Date');
    });

    it('emits warn level via Logger.warn', () => {
      svc.emit('warn', { queue: 'monitor-check', event: 'orphan-dropped' });
      const obj = lastJson(warnSpy);
      expect(obj.level).toBe('warn');
      expect(obj.event).toBe('orphan-dropped');
    });

    it('emits error level via Logger.error', () => {
      svc.emit('error', {
        queue: 'notifications',
        event: 'job-failed',
        error: 'boom',
      });
      const obj = lastJson(errorSpy);
      expect(obj.level).toBe('error');
      expect(obj.error).toBe('boom');
    });
  });

  describe('jobCompleted()', () => {
    it('produces structured info event with duration + attempts + extras', () => {
      svc.jobCompleted('monitor-check', '42', 'probe', 245, 1, {
        check_id: 'chk-abc',
        site_id: 'site-xyz',
      });
      const obj = lastJson(logSpy);
      expect(obj).toMatchObject({
        level: 'info',
        queue: 'monitor-check',
        job_id: '42',
        job_name: 'probe',
        event: 'job-completed',
        attempts: 1,
        duration_ms: 245,
        check_id: 'chk-abc',
        site_id: 'site-xyz',
      });
    });
  });

  describe('jobFailed()', () => {
    it('extracts SCREAMING_SNAKE error code as error_code', () => {
      const err = new Error('ENOTFOUND: getaddrinfo failed');
      svc.jobFailed('monitor-check', '99', 'probe', err, 3);
      const obj = lastJson(errorSpy);
      expect(obj).toMatchObject({
        level: 'error',
        event: 'job-failed',
        attempts: 3,
        error: 'ENOTFOUND: getaddrinfo failed',
        error_code: 'ENOTFOUND',
      });
      expect(typeof obj.stack).toBe('string');
    });

    it('omits error_code when message has no SCREAMING_SNAKE leading token', () => {
      const err = new Error('Something went sideways');
      svc.jobFailed('notifications', '11', 'notification-dispatch', err, 1);
      const obj = lastJson(errorSpy);
      expect(obj.error_code).toBeUndefined();
      expect(obj.error).toBe('Something went sideways');
    });

    it('truncates stack to ~2KB to keep log lines bounded', () => {
      const err = new Error('big');
      err.stack = 'X'.repeat(10_000);
      svc.jobFailed('notifications', '12', 'notification-dispatch', err, 1);
      const obj = lastJson(errorSpy);
      expect(obj.stack.length).toBeLessThanOrEqual(2048);
    });

    // ── S8 / ADR-024 — Sentry/GlitchTip capture ──
    describe('Sentry capture', () => {
      it('routes the original Error to Sentry.captureException', () => {
        const err = new Error('boom');
        svc.jobFailed('monitor-check', '42', 'probe', err, 2);
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy.mock.calls[0][0]).toBe(err);
      });

      it('tags low-cardinality fields (queue + jobName), extras hold ids/attempts', () => {
        const err = new Error('boom');
        svc.jobFailed('notifications', '777', 'notification-dispatch', err, 3);
        const ctx = captureSpy.mock.calls[0][1];
        expect(ctx.tags).toEqual({
          queue: 'notifications',
          jobName: 'notification-dispatch',
        });
        expect(ctx.extra).toEqual({ jobId: '777', attempts: 3 });
      });

      it('adds errorCode tag when message has SCREAMING_SNAKE prefix', () => {
        const err = new Error('ETIMEDOUT: connect timed out');
        svc.jobFailed('monitor-check', '1', 'probe', err, 1);
        const ctx = captureSpy.mock.calls[0][1];
        expect(ctx.tags.errorCode).toBe('ETIMEDOUT');
      });

      it('omits errorCode tag when no SCREAMING_SNAKE prefix', () => {
        const err = new Error('something blew up');
        svc.jobFailed('monitor-check', '1', 'probe', err, 1);
        const ctx = captureSpy.mock.calls[0][1];
        expect(ctx.tags).not.toHaveProperty('errorCode');
      });

      it('does NOT capture on jobCompleted (success path stays out of Sentry)', () => {
        svc.jobCompleted('monitor-check', '1', 'probe', 100, 1);
        expect(captureSpy).not.toHaveBeenCalled();
      });

      it('does NOT capture on emit() raw error (only jobFailed wraps capture)', () => {
        svc.emit('error', { queue: 'q', event: 'job-failed', error: 'manual' });
        expect(captureSpy).not.toHaveBeenCalled();
      });
    });
  });
});
