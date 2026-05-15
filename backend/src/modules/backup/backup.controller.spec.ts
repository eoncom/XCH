import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { BackupController } from './backup.controller';
import {
  JOB_BACKUP_FULL,
  JOB_BACKUP_SITE,
  JOB_RESTORE_FULL,
} from './backup.queue';

/**
 * Build a controller with mock service + mock Bull queue. Returns the mocks
 * so each test can assert / override.
 */
function buildController(): {
  controller: BackupController;
  service: Record<string, jest.Mock>;
  queue: Record<string, jest.Mock>;
  crypto: { isEnabled: jest.Mock };
} {
  const service = {
    createFullBackup: jest.fn(),
    restoreFullBackup: jest.fn(),
    restoreFullBackupV2: jest.fn(),
    createSiteBackup: jest.fn(),
    estimateBackupSize: jest.fn(),
    assertTargetDelegationAccessible: jest.fn().mockResolvedValue(undefined),
  };
  const queue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };
  // Track D.2 Step 2 — controller takes a CryptoService for capability
  // discovery + encrypt:true 412 gate. Tests that don't exercise encryption
  // pass a stub that reports disabled.
  const crypto = {
    isEnabled: jest.fn(() => false),
  };
  const controller = new BackupController(
    service as never,
    queue as never,
    crypto as never,
  );
  return { controller, service, queue, crypto };
}

/** A minimal AuthRequest-shaped object for the controller. */
function authRequest(tenantId = 'tnt-test', userId = 'u-1'): {
  user: { tenantId: string; id: string };
} {
  return { user: { tenantId, id: userId } };
}

describe('BackupController (Track D.1 step 5 — Bull v3 wiring)', () => {
  describe('POST /backup/full', () => {
    it('enqueues a backup-full job by default + returns 202-shaped BackupJobEnqueuedResponseDto', async () => {
      const { controller, service, queue } = buildController();
      queue.add.mockResolvedValue({ id: '777' });

      const result = await controller.createFullBackup(
        { dbOnly: false },
        undefined, // no X-Backup-Sync header
        authRequest() as never,
      );

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [jobName, jobData] = queue.add.mock.calls[0];
      expect(jobName).toBe(JOB_BACKUP_FULL);
      expect(jobData).toEqual({
        tenantId: 'tnt-test',
        userId: 'u-1',
        options: { dbOnly: false, encrypt: undefined },
      });
      // Sync path NOT taken
      expect(service.createFullBackup).not.toHaveBeenCalled();

      expect(result).toEqual({ enqueued: true, jobId: '777' });
    });

    it('X-Backup-Sync: 1 header forces the legacy synchronous v1 path', async () => {
      const { controller, service, queue } = buildController();
      service.createFullBackup.mockResolvedValue({
        message: 'sync ok',
        filename: 'legacy.zip',
        size: 1234,
      });

      const result = await controller.createFullBackup(
        { dbOnly: false },
        '1', // X-Backup-Sync: 1
        authRequest() as never,
      );

      expect(service.createFullBackup).toHaveBeenCalledWith('tnt-test', 'u-1');
      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'sync ok',
        filename: 'legacy.zip',
        size: 1234,
      });
    });
  });

  describe('POST /backup/full/restore', () => {
    it('multipart file upload → synchronous v1 path (file.buffer routed to service)', async () => {
      const { controller, service, queue } = buildController();
      service.restoreFullBackup.mockResolvedValue({
        message: 'v1 restored',
        counts: { sites: 1 },
        siteIds: ['s1'],
      });

      const fakeFile = {
        buffer: Buffer.from('PK\x03\x04…fake zip…'),
        size: 14,
        originalname: 'b.zip',
      } as never;

      const result = await controller.restoreFullBackup(
        fakeFile,
        undefined,
        undefined,
        authRequest() as never,
      );

      expect(service.restoreFullBackup).toHaveBeenCalledWith(
        'tnt-test',
        expect.any(Buffer),
        'u-1',
      );
      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ message: 'v1 restored' }));
    });

    it('JSON {backupId} (no file) → enqueues restore-full job + 202 response', async () => {
      const { controller, queue } = buildController();
      queue.add.mockResolvedValue({ id: '888' });

      const result = await controller.restoreFullBackup(
        undefined,
        { backupId: 'audit-99', dryRun: true },
        undefined,
        authRequest() as never,
      );

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [jobName, jobData] = queue.add.mock.calls[0];
      expect(jobName).toBe(JOB_RESTORE_FULL);
      expect(jobData).toEqual({
        tenantId: 'tnt-test',
        backupId: 'audit-99',
        userId: 'u-1',
        options: { dryRun: true },
      });
      expect(result).toEqual({ enqueued: true, jobId: '888' });
    });

    it('neither file nor backupId → BadRequestException with explicit hint', async () => {
      const { controller } = buildController();

      await expect(
        controller.restoreFullBackup(
          undefined,
          undefined,
          undefined,
          authRequest() as never,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.restoreFullBackup(
          undefined,
          undefined,
          undefined,
          authRequest() as never,
        ),
      ).rejects.toThrow(/multipart .* OR JSON body/i);
    });

    it('JSON {backupId} + X-Backup-Sync: 1 → runs v2 in-process + adapts kind=dry-run result', async () => {
      const { controller, service, queue } = buildController();
      service.restoreFullBackupV2.mockResolvedValue({
        kind: 'dry-run',
        report: {
          wouldCreate: { sites: 2, assets: 5 },
          wouldUpdate: {},
          wouldSkip: {},
          missingFiles: [],
          invalidChecksums: [],
          totalSize: 0,
          estimatedDurationSec: 1,
        },
      });

      const result = (await controller.restoreFullBackup(
        undefined,
        { backupId: 'audit-99', dryRun: true },
        '1',
        authRequest() as never,
      )) as { message: string; counts: Record<string, number> };

      expect(service.restoreFullBackupV2).toHaveBeenCalledWith(
        'tnt-test',
        'audit-99',
        { dryRun: true },
        undefined,
        'u-1',
      );
      expect(queue.add).not.toHaveBeenCalled();
      expect(result.message).toMatch(/dry-run/i);
      expect(result.counts).toEqual(
        expect.objectContaining({ sites: 2, assets: 5, _skipped: 7 }),
      );
    });
  });

  describe('POST /backup/site/:siteId', () => {
    it('enqueues backup-site job by default + 202 BackupJobEnqueuedResponseDto', async () => {
      const { controller, service, queue } = buildController();
      queue.add.mockResolvedValue({ id: '999' });

      // res.end is not called in async path ; we still need a passthrough res.
      const res: { set: jest.Mock; end: jest.Mock } = { set: jest.fn(), end: jest.fn() };

      const result = await controller.createSiteBackup(
        'site-1',
        undefined, // no X-Backup-Sync
        authRequest() as never,
        res as never,
      );

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [jobName, jobData] = queue.add.mock.calls[0];
      expect(jobName).toBe(JOB_BACKUP_SITE);
      expect(jobData).toEqual({
        tenantId: 'tnt-test',
        siteId: 'site-1',
        userId: 'u-1',
      });
      expect(service.createSiteBackup).not.toHaveBeenCalled();
      expect(result).toEqual({ enqueued: true, jobId: '999' });
    });

    it('X-Backup-Sync: 1 streams the ZIP binary inline (legacy)', async () => {
      const { controller, service, queue } = buildController();
      service.createSiteBackup.mockResolvedValue({
        buffer: Buffer.from('zipbytes'),
        filename: 'site-X-2026.zip',
      });
      const res: { set: jest.Mock; end: jest.Mock } = { set: jest.fn(), end: jest.fn() };

      const result = await controller.createSiteBackup(
        'site-1',
        '1',
        authRequest() as never,
        res as never,
      );

      expect(service.createSiteBackup).toHaveBeenCalledWith(
        'tnt-test',
        'site-1',
        'u-1',
      );
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="site-X-2026.zip"',
        }),
      );
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(queue.add).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('GET /backup/jobs/:jobId', () => {
    it('returns JobStatusResponseDto for an existing completed job', async () => {
      const { controller, queue } = buildController();
      const job = {
        getState: jest.fn().mockResolvedValue('completed'),
        progress: jest.fn().mockReturnValue({
          phase: 'done',
          percent: 100,
          current: 1,
          total: 1,
          message: 'ok',
        }),
        returnvalue: { kind: 'applied', message: 'restored', counts: {} },
        failedReason: undefined,
      };
      queue.getJob.mockResolvedValue(job);

      const result = await controller.getJobStatus('42');

      expect(queue.getJob).toHaveBeenCalledWith('42');
      expect(result.state).toBe('completed');
      expect(result.progress.percent).toBe(100);
      expect(result.result).toEqual({
        kind: 'applied',
        message: 'restored',
        counts: {},
      });
      expect(result.error).toBeUndefined();
    });

    it('returns state=failed + error from job.failedReason', async () => {
      const { controller, queue } = buildController();
      const job = {
        getState: jest.fn().mockResolvedValue('failed'),
        progress: jest.fn().mockReturnValue(0),
        returnvalue: undefined,
        failedReason: 'integrity check failed',
      };
      queue.getJob.mockResolvedValue(job);

      const result = await controller.getJobStatus('42');

      expect(result.state).toBe('failed');
      expect(result.error).toBe('integrity check failed');
    });

    it('maps Bull v3 states (delayed/paused/unknown) to "waiting" so frontend never sees unexpected values', async () => {
      const { controller, queue } = buildController();
      const job = {
        getState: jest.fn().mockResolvedValue('delayed'),
        progress: jest.fn().mockReturnValue(0),
        returnvalue: undefined,
        failedReason: undefined,
      };
      queue.getJob.mockResolvedValue(job);

      const result = await controller.getJobStatus('42');

      // 'delayed' is not in the DTO union — coerced to 'waiting'.
      expect(result.state).toBe('waiting');
    });

    it('normalizes numeric progress to JobProgressResponseDto shape (fallback)', async () => {
      const { controller, queue } = buildController();
      const job = {
        getState: jest.fn().mockResolvedValue('active'),
        progress: jest.fn().mockReturnValue(42), // number, not object
        returnvalue: undefined,
        failedReason: undefined,
      };
      queue.getJob.mockResolvedValue(job);

      const result = await controller.getJobStatus('42');

      expect(result.state).toBe('active');
      expect(result.progress.percent).toBe(42);
      expect(result.progress.phase).toBe('active');
      expect(result.progress.total).toBe(1);
      expect(result.progress.message).toBe('');
    });

    it('throws NotFoundException when queue.getJob returns undefined', async () => {
      const { controller, queue } = buildController();
      queue.getJob.mockResolvedValue(undefined);

      await expect(controller.getJobStatus('does-not-exist')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getJobStatus('does-not-exist')).rejects.toThrow(
        /Backup job does-not-exist not found/,
      );
    });
  });

  // ==========================================================================
  // Track D.2 Step 2 — Capability discovery + encrypt:true 412 gate
  // ==========================================================================

  describe('GET /backup/capabilities (Track D.2)', () => {
    it('returns encryption:true when crypto.isEnabled() is true', async () => {
      const { controller, crypto } = buildController();
      crypto.isEnabled.mockReturnValue(true);
      const result = await controller.getCapabilities();
      expect(result.encryption).toBe(true);
    });

    it('returns encryption:false when crypto.isEnabled() is false', async () => {
      const { controller, crypto } = buildController();
      crypto.isEnabled.mockReturnValue(false);
      const result = await controller.getCapabilities();
      expect(result.encryption).toBe(false);
    });
  });

  describe('POST /backup/full with encrypt:true (Track D.2)', () => {
    it('rejects with HTTP 412 PreconditionFailed when crypto disabled', async () => {
      const { controller, crypto } = buildController();
      crypto.isEnabled.mockReturnValue(false);
      await expect(
        controller.createFullBackup(
          { encrypt: true },
          undefined,
          authRequest() as never,
        ),
      ).rejects.toThrow(HttpException);
      await expect(
        controller.createFullBackup(
          { encrypt: true },
          undefined,
          authRequest() as never,
        ),
      ).rejects.toMatchObject({ status: 412 });
    });

    it('threads encrypt:true into the job data when crypto enabled', async () => {
      const { controller, queue, crypto } = buildController();
      crypto.isEnabled.mockReturnValue(true);
      queue.add.mockResolvedValue({ id: '999' });

      await controller.createFullBackup(
        { encrypt: true },
        undefined,
        authRequest() as never,
      );

      const [, jobData] = queue.add.mock.calls[0];
      expect(jobData).toMatchObject({
        tenantId: 'tnt-test',
        options: { encrypt: true },
      });
    });
  });

  // ==========================================================================
  // Track D.2 Step 4 — Cross-tenant restore controller path
  // ==========================================================================

  describe('POST /backup/full/restore with targetDelegationId (Track D.2 step 4)', () => {
    it('calls assertTargetDelegationAccessible when targetDelegationId is set', async () => {
      const { controller, service, queue } = buildController();
      queue.add.mockResolvedValue({ id: '4-1' });

      await controller.restoreFullBackup(
        undefined,
        { backupId: 'b1', targetDelegationId: 'del-target' },
        undefined,
        authRequest() as never,
      );

      expect(service.assertTargetDelegationAccessible).toHaveBeenCalledWith(
        'del-target',
        'tnt-test',
      );
    });

    it('skips assertTargetDelegationAccessible when same-tenant restore', async () => {
      const { controller, service, queue } = buildController();
      queue.add.mockResolvedValue({ id: '4-2' });

      await controller.restoreFullBackup(
        undefined,
        { backupId: 'b1' },
        undefined,
        authRequest() as never,
      );

      expect(service.assertTargetDelegationAccessible).not.toHaveBeenCalled();
    });

    it('threads targetDelegationId into the job data on async path', async () => {
      const { controller, queue } = buildController();
      queue.add.mockResolvedValue({ id: '4-3' });

      await controller.restoreFullBackup(
        undefined,
        { backupId: 'b1', targetDelegationId: 'del-target', dryRun: true },
        undefined,
        authRequest() as never,
      );

      const [, jobData] = queue.add.mock.calls[0];
      expect(jobData).toMatchObject({
        tenantId: 'tnt-test',
        backupId: 'b1',
        options: { dryRun: true, targetDelegationId: 'del-target' },
      });
    });
  });
});
