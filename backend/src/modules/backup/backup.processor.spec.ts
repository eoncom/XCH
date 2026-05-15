import { BackupProcessor } from './backup.processor';
import {
  BACKUP_QUEUE,
  JOB_BACKUP_FULL,
  JOB_BACKUP_SITE,
  JOB_RESTORE_FULL,
  JOB_RESTORE_SITE,
} from './backup.queue';

/**
 * Build a Bull `Job`-like mock with the fields the processor reads.
 */
function mockJob<T>(overrides: Partial<{ id: string; name: string; data: T; attemptsMade: number; opts: { attempts?: number }; timestamp: number; processedOn: number | undefined }> = {}): {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: { attempts?: number };
  timestamp: number;
  processedOn: number | undefined;
  progress: jest.Mock;
} {
  return {
    id: '42',
    name: JOB_BACKUP_FULL,
    data: {} as T,
    attemptsMade: 0,
    opts: { attempts: 1 },
    timestamp: Date.now() - 500,
    processedOn: Date.now() - 200,
    progress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('BackupProcessor (Track D.1 step 5)', () => {
  describe('handleBackupFull', () => {
    it('delegates to backup.createFullBackupV2 with options + a progress callback wired to job.progress', async () => {
      const createFullBackupV2 = jest.fn().mockResolvedValue({
        message: 'ok',
        filename: 'full-backup-v2-…zip',
        size: 1234,
        sha256: 'a'.repeat(64),
      });
      const backup = { createFullBackupV2 } as never;
      const events = { jobCompleted: jest.fn(), jobFailed: jest.fn() } as never;
      const processor = new BackupProcessor(backup, events);

      const job = mockJob({
        name: JOB_BACKUP_FULL,
        data: { tenantId: 'tnt-test', userId: 'u-1', options: { dbOnly: false } },
      });

      const result = await processor.handleBackupFull(job as never);

      expect(createFullBackupV2).toHaveBeenCalledTimes(1);
      const [tenantId, userId, options, onProgress] = createFullBackupV2.mock.calls[0];
      expect(tenantId).toBe('tnt-test');
      expect(userId).toBe('u-1');
      expect(options).toEqual({ dbOnly: false });
      expect(typeof onProgress).toBe('function');

      // Trigger the progress callback : it should invoke job.progress with
      // the canonical BackupJobProgress shape (phase, current, total, percent, message).
      onProgress('archive', 50, 100, 'half done');
      // job.progress is async, await tick
      await Promise.resolve();
      expect(job.progress).toHaveBeenCalledWith({
        phase: 'archive',
        current: 50,
        total: 100,
        percent: 50,
        message: 'half done',
      });

      expect(result).toEqual(expect.objectContaining({ filename: expect.any(String) }));
    });

    it('clamps percent to [0,100] and handles total=0 without dividing by zero', async () => {
      const createFullBackupV2 = jest.fn().mockResolvedValue({});
      const backup = { createFullBackupV2 } as never;
      const events = {} as never;
      const processor = new BackupProcessor(backup, events);

      const job = mockJob({ data: { tenantId: 'tnt-test', userId: 'u-1', options: {} } });
      await processor.handleBackupFull(job as never);
      const onProgress = createFullBackupV2.mock.calls[0][3];

      // total = 0 → percent must be 0 (not NaN)
      onProgress('init', 0, 0, '');
      await Promise.resolve();
      expect(job.progress).toHaveBeenLastCalledWith(
        expect.objectContaining({ percent: 0 }),
      );

      // current > total → percent clamped to 100
      onProgress('archive', 150, 100, '');
      await Promise.resolve();
      expect(job.progress).toHaveBeenLastCalledWith(
        expect.objectContaining({ percent: 100 }),
      );
    });
  });

  describe('handleRestoreFull', () => {
    it('delegates to backup.restoreFullBackupV2 with backupId + options + progress + userId', async () => {
      const restoreFullBackupV2 = jest.fn().mockResolvedValue({
        kind: 'dry-run',
        report: { wouldCreate: {}, wouldUpdate: {}, wouldSkip: {}, missingFiles: [], invalidChecksums: [], totalSize: 0, estimatedDurationSec: 1 },
      });
      const backup = { restoreFullBackupV2 } as never;
      const events = {} as never;
      const processor = new BackupProcessor(backup, events);

      const job = mockJob({
        name: JOB_RESTORE_FULL,
        data: {
          tenantId: 'tnt-test',
          backupId: 'audit-1',
          userId: 'u-1',
          options: { dryRun: true },
        },
      });

      await processor.handleRestoreFull(job as never);

      expect(restoreFullBackupV2).toHaveBeenCalledTimes(1);
      const [tenantId, backupId, options, onProgress, userId] =
        restoreFullBackupV2.mock.calls[0];
      expect(tenantId).toBe('tnt-test');
      expect(backupId).toBe('audit-1');
      expect(options).toEqual({ dryRun: true });
      expect(typeof onProgress).toBe('function');
      expect(userId).toBe('u-1');
    });
  });

  describe('handleBackupSite', () => {
    it('delegates to legacy createSiteBackup (v1 path, async wrapper only)', async () => {
      const createSiteBackup = jest.fn().mockResolvedValue({
        buffer: Buffer.from('zip'),
        filename: 'site-X.zip',
      });
      const backup = { createSiteBackup } as never;
      const events = {} as never;
      const processor = new BackupProcessor(backup, events);

      const job = mockJob({
        name: JOB_BACKUP_SITE,
        data: { tenantId: 'tnt-test', siteId: 'site-1', userId: 'u-1' },
      });

      await processor.handleBackupSite(job as never);

      expect(createSiteBackup).toHaveBeenCalledWith('tnt-test', 'site-1', 'u-1');
    });
  });

  describe('handleRestoreSite', () => {
    it('explicitly throws (parked — site restore async path deferred to D.2)', async () => {
      const processor = new BackupProcessor({} as never, {} as never);
      const job = mockJob({
        name: JOB_RESTORE_SITE,
        data: { tenantId: 'tnt-test', backupId: 'audit-1' },
      });

      await expect(processor.handleRestoreSite(job as never)).rejects.toThrow(
        /restore-site not yet implemented/i,
      );
    });
  });

  describe('queue lifecycle hooks', () => {
    it('onCompleted emits structured jobCompleted event with duration + tenant_id', () => {
      const events = { jobCompleted: jest.fn(), jobFailed: jest.fn() };
      const processor = new BackupProcessor({} as never, events as never);
      const job = mockJob({
        name: JOB_BACKUP_FULL,
        data: { tenantId: 'tnt-test' },
        attemptsMade: 0,
        timestamp: Date.now() - 1000,
        processedOn: Date.now() - 800,
      });

      processor.onCompleted(job as never);

      expect(events.jobCompleted).toHaveBeenCalledTimes(1);
      const [queue, id, name, durationMs, attempts, extra] =
        events.jobCompleted.mock.calls[0];
      expect(queue).toBe(BACKUP_QUEUE);
      expect(id).toBe('42');
      expect(name).toBe(JOB_BACKUP_FULL);
      expect(durationMs).toBeGreaterThanOrEqual(0);
      expect(attempts).toBe(1);
      expect(extra).toEqual({ tenant_id: 'tnt-test' });
    });

    it('onFailed emits ONLY after retries exhausted (matches MonitorProcessor pattern)', () => {
      const events = { jobCompleted: jest.fn(), jobFailed: jest.fn() };
      const processor = new BackupProcessor({} as never, events as never);

      // Job that has more retries to try — onFailed must be a no-op.
      const earlyJob = mockJob({
        attemptsMade: 1,
        opts: { attempts: 3 },
      });
      processor.onFailed(earlyJob as never, new Error('first attempt failed'));
      expect(events.jobFailed).not.toHaveBeenCalled();

      // Job with no retries left — emit the structured event with Sentry tag.
      const finalJob = mockJob({
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: { tenantId: 'tnt-test' },
      });
      processor.onFailed(finalJob as never, new Error('final failure'));
      expect(events.jobFailed).toHaveBeenCalledTimes(1);
      const [queue, id, name, err, attempts, extra] = events.jobFailed.mock.calls[0];
      expect(queue).toBe(BACKUP_QUEUE);
      expect(id).toBe('42');
      expect(name).toBe(JOB_BACKUP_FULL);
      expect(err.message).toBe('final failure');
      expect(attempts).toBe(3);
      expect(extra).toEqual(expect.objectContaining({ tenant_id: 'tnt-test' }));
    });

    it('attempts:1 (BACKUP_JOB_OPTIONS default) triggers onFailed on first failure', () => {
      // With attempts:1 and attemptsMade:1, the condition
      // `attemptsMade < attempts` is false → emit immediately.
      const events = { jobCompleted: jest.fn(), jobFailed: jest.fn() };
      const processor = new BackupProcessor({} as never, events as never);
      const job = mockJob({ attemptsMade: 1, opts: { attempts: 1 } });
      processor.onFailed(job as never, new Error('immediate'));
      expect(events.jobFailed).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Track D.2 Step 6 — Bull v3 per-handler concurrency
  // ==========================================================================

  describe('@Process concurrency (Track D.2 step 6)', () => {
    it('BACKUP_QUEUE_CONCURRENCY constant is bumped to 2 in v2.3.0', () => {
      // The constant lives in backup.queue.ts (single source of truth).
      // Test documents the post-D.1 value so a future revert (gate failure
      // at merge) flips it back to 1 visibly. Bumped from 1 → 2 conditional
      // on the post-soak metrics (RSS p95 < 50%, 0 OOM kills).
      const { BACKUP_QUEUE_CONCURRENCY } = jest.requireActual(
        './backup.queue',
      ) as { BACKUP_QUEUE_CONCURRENCY: number };
      expect(BACKUP_QUEUE_CONCURRENCY).toBe(2);
    });
  });
});
