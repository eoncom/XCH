import { instanceToPlain } from 'class-transformer';
import { toResponse } from '../../common/utils/to-response.util';
import { BackupResultResponseDto } from './dto/backup-result.response.dto';
import {
  toRestoreFullResultResponseDto,
  toRestoreSiteResultResponseDto,
} from './dto/restore-result.response.dto';
import { CleanupStorageResultResponseDto } from './dto/cleanup-storage-result.response.dto';
import { BackupListResponseDto } from './dto/backup-list.response.dto';
import { DeleteBackupResultResponseDto } from './dto/delete-backup-result.response.dto';
// Track D.1 Phase 1 step 1.
import { EstimateResponseDto } from './dto/estimate.response.dto';
import { BackupJobEnqueuedResponseDto } from './dto/backup-job-enqueued.response.dto';
import {
  JobStatusResponseDto,
  JobProgressResponseDto,
} from './dto/job-status.response.dto';
import {
  DryRunReportResponseDto,
  toDryRunReportResponseDto,
} from './dto/dry-run-report.response.dto';

describe('Backup response DTO shapes', () => {
  describe('BackupResultResponseDto (Cas B)', () => {
    it('exposes message + filename + size, strips internal fields', () => {
      const dto = toResponse(BackupResultResponseDto, {
        message: 'Backup complet créé avec succès',
        filename: 'full-backup-2026-05-05T22-00-00.zip',
        size: 1234567,
        // Extraneous.
        _bucket: 'xch-backups',
        _tenantId: 'tnt-1',
      });
      expect(dto).toEqual({
        message: 'Backup complet créé avec succès',
        filename: 'full-backup-2026-05-05T22-00-00.zip',
        size: 1234567,
      });
    });
  });

  describe('toRestoreFullResultResponseDto (Cas B helper)', () => {
    const serviceReturn = {
      message: 'Full restore complete',
      counts: { sites: 3, assets: 47, racks: 5 },
      siteIds: ['site-1', 'site-2', 'site-3'],
    };

    it('exposes message + counts record + siteIds array', () => {
      const dto = toRestoreFullResultResponseDto(serviceReturn);
      expect(dto).toHaveProperty('message', 'Full restore complete');
      expect(dto.counts).toEqual({ sites: 3, assets: 47, racks: 5 });
      expect(dto.siteIds).toHaveLength(3);
    });

    it('returned object is a copy — service mutating after the call does not bleed', () => {
      const dto = toRestoreFullResultResponseDto(serviceReturn);
      // counts and siteIds are spread copies
      expect(dto.counts).not.toBe(serviceReturn.counts);
      expect(dto.siteIds).not.toBe(serviceReturn.siteIds);
    });

    it('runtime serialization is leak-free', () => {
      const dto = toRestoreFullResultResponseDto(serviceReturn);
      const wireJson = JSON.stringify(dto);
      expect(wireJson).toContain('"sites":3');
      expect(wireJson).toContain('"assets":47');
    });
  });

  describe('toRestoreSiteResultResponseDto (Cas B helper)', () => {
    it('exposes site-scoped restore shape', () => {
      const dto = toRestoreSiteResultResponseDto({
        message: 'Site restore complete',
        siteId: 'site-1',
        counts: { assets: 47, racks: 5 },
      });
      expect(dto).toEqual({
        message: 'Site restore complete',
        siteId: 'site-1',
        counts: { assets: 47, racks: 5 },
      });
    });
  });

  describe('CleanupStorageResultResponseDto', () => {
    it('exposes deleted/skipped/errors string arrays', () => {
      const dto = toResponse(CleanupStorageResultResponseDto, {
        deleted: ['floor-plans/orphan-1.pdf', 'floor-plans/orphan-2.pdf'],
        skipped: ['floor-plans/recent.pdf'],
        errors: [],
        _bucketName: 'xch-storage',
        _graceHours: 0,
      });
      expect(dto.deleted).toHaveLength(2);
      expect(dto.skipped).toHaveLength(1);
      expect(dto.errors).toEqual([]);
      expect(dto).not.toHaveProperty('_bucketName');
    });
  });

  describe('BackupListResponseDto (Cas C — items + total)', () => {
    const list = {
      backups: [
        {
          id: 'log-1',
          filename: 'full-backup-2026-05-05.zip',
          type: 'full' as const,
          size: 1234567,
          createdAt: '2026-05-05T22:00:00Z',
          // Extraneous.
          _internalKey: 'leak',
        },
        {
          id: 'log-2',
          filename: 'site-DEM-2026-05-05.zip',
          type: 'site' as const,
          siteCode: 'DEM',
          size: 9876,
          createdAt: '2026-05-05T20:00:00Z',
        },
      ],
      total: 2,
    };

    it('maps backups[] + total + strips extraneous on items', () => {
      const dto = toResponse(BackupListResponseDto, list);
      expect(dto.total).toBe(2);
      expect(dto.backups).toHaveLength(2);
      expect(dto.backups[0]).toHaveProperty('filename');
      expect(dto.backups[0]).not.toHaveProperty('_internalKey');
      expect(dto.backups[1]).toHaveProperty('siteCode', 'DEM');
    });

    it('runtime serialization preserves the wrapper shape', () => {
      const dto = toResponse(BackupListResponseDto, list);
      const wirePayload = JSON.parse(JSON.stringify(instanceToPlain(dto)));
      expect(wirePayload).toHaveProperty('backups');
      expect(wirePayload).toHaveProperty('total', 2);
      expect(wirePayload.backups[0]).not.toHaveProperty('_internalKey');
    });
  });

  describe('DeleteBackupResultResponseDto', () => {
    it('exposes message only', () => {
      const dto = toResponse(DeleteBackupResultResponseDto, {
        message: 'Backup supprimé',
        _filename: 'leak',
      });
      expect(dto).toEqual({ message: 'Backup supprimé' });
    });
  });

  // ==========================================================================
  // Track D.1 Phase 1 step 1 — pre-flight DTOs
  // ==========================================================================

  describe('EstimateResponseDto (Cas A — pre-flight sizing)', () => {
    it('exposes the 6 sizing fields, strips internal helpers', () => {
      const dto = toResponse(EstimateResponseDto, {
        dataBytes: 1_234_000,
        filesBytes: 456_789_012,
        totalBytes: 458_023_012,
        fileCount: 312,
        freeBytes: 9_876_543_210,
        ok: true,
        // Extraneous helpers from the service implementation.
        _samplingRatio: 1.1,
        _tenantId: 'tnt-1',
        _bucket: 'xch-storage',
      });
      expect(dto).toEqual({
        dataBytes: 1_234_000,
        filesBytes: 456_789_012,
        totalBytes: 458_023_012,
        fileCount: 312,
        freeBytes: 9_876_543_210,
        ok: true,
      });
      expect(dto).not.toHaveProperty('_samplingRatio');
      expect(dto).not.toHaveProperty('_tenantId');
    });

    it('preserves the ok=false signal when disk is too small', () => {
      const dto = toResponse(EstimateResponseDto, {
        dataBytes: 100,
        filesBytes: 100,
        totalBytes: 200,
        fileCount: 0,
        freeBytes: 50,
        ok: false,
      });
      expect(dto.ok).toBe(false);
    });
  });

  describe('BackupJobEnqueuedResponseDto (Cas A — 202 ack)', () => {
    it('exposes enqueued + jobId, strips internal queue metadata', () => {
      const dto = toResponse(BackupJobEnqueuedResponseDto, {
        enqueued: true,
        jobId: '40888',
        // Extraneous Bull v3 internals.
        _queueName: 'backup-jobs',
        _attemptsMade: 0,
        _delay: 0,
      });
      expect(dto).toEqual({ enqueued: true, jobId: '40888' });
      expect(dto).not.toHaveProperty('_queueName');
    });
  });

  describe('JobStatusResponseDto (Cas C — nested progress)', () => {
    const sample = {
      state: 'active' as const,
      progress: {
        phase: 'archive',
        percent: 42,
        current: 130,
        total: 312,
        message: 'Streaming xch-storage objects (130 / 312)…',
        // Extraneous.
        _startedAt: '2026-05-12T10:00:00Z',
      },
      // Top-level extraneous.
      _redisJobKey: 'bull:backup-jobs:40888',
    };

    it('exposes state + progress (typed), drops extraneous top-level', () => {
      const dto = toResponse(JobStatusResponseDto, sample);
      expect(dto.state).toBe('active');
      expect(dto.progress).toBeInstanceOf(JobProgressResponseDto);
      expect(dto.progress.phase).toBe('archive');
      expect(dto.progress.percent).toBe(42);
      expect(dto).not.toHaveProperty('_redisJobKey');
    });

    it('strips extraneous keys inside progress (anti-leak nested)', () => {
      const dto = toResponse(JobStatusResponseDto, sample);
      expect(dto.progress).not.toHaveProperty('_startedAt');
    });

    it('result + error are optional and pass through when set', () => {
      const dto = toResponse(JobStatusResponseDto, {
        state: 'failed',
        progress: { phase: 'extract', percent: 12, current: 1, total: 8, message: 'aborted' },
        error: 'auth tag mismatch',
      });
      expect(dto.state).toBe('failed');
      expect(dto.error).toBe('auth tag mismatch');
      expect(dto.result).toBeUndefined();
    });
  });

  describe('toDryRunReportResponseDto (Cas B helper — dynamic Record keys)', () => {
    const input = {
      wouldCreate: { sites: 2, assets: 47, expenses: 18 },
      wouldUpdate: { sites: 1, assets: 3 },
      wouldSkip: { photos: 12 },
      missingFiles: ['minio/xch-storage/floor-plans/lost.pdf'],
      invalidChecksums: ['minio/xch-storage/photos/corrupt.jpg'],
      totalSize: 458_023_012,
      estimatedDurationSec: 92,
    };

    it('exposes all 7 fields with dynamic Record<string, number> keys preserved', () => {
      const dto = toDryRunReportResponseDto(input);
      expect(dto.wouldCreate).toEqual({ sites: 2, assets: 47, expenses: 18 });
      expect(dto.wouldUpdate).toEqual({ sites: 1, assets: 3 });
      expect(dto.wouldSkip).toEqual({ photos: 12 });
      expect(dto.missingFiles).toEqual(['minio/xch-storage/floor-plans/lost.pdf']);
      expect(dto.invalidChecksums).toEqual(['minio/xch-storage/photos/corrupt.jpg']);
      expect(dto.totalSize).toBe(458_023_012);
      expect(dto.estimatedDurationSec).toBe(92);
    });

    it('returned object is a copy — mutating input afterwards does not bleed', () => {
      const dto = toDryRunReportResponseDto(input);
      expect(dto.wouldCreate).not.toBe(input.wouldCreate);
      expect(dto.missingFiles).not.toBe(input.missingFiles);
      expect(dto.invalidChecksums).not.toBe(input.invalidChecksums);
    });

    it('runtime serialization is leak-free even with mixed numeric keys', () => {
      const dto = toDryRunReportResponseDto(input);
      const wire = JSON.stringify(dto);
      expect(wire).toContain('"sites":2');
      // missingFiles[0] is 'minio/xch-storage/floor-plans/lost.pdf' — match
      // a substring that appears verbatim in the JSON output.
      expect(wire).toContain('floor-plans/lost.pdf');
      expect(wire).toContain('"estimatedDurationSec":92');
    });
  });

  describe('DryRunReportResponseDto (class anti-leak via toResponse fallback)', () => {
    // The Cas B helper is the canonical entry point, but the class itself
    // should still be loaded by tests / Swagger.
    it('class is exported and instantiable', () => {
      const dto = new DryRunReportResponseDto();
      expect(dto).toBeInstanceOf(DryRunReportResponseDto);
    });
  });
});

// ============================================================================
// Track D.1 Phase 1 step 1 — InsufficientStorageException shape
// ============================================================================

import { InsufficientStorageException } from './exceptions/insufficient-storage.exception';

describe('InsufficientStorageException', () => {
  it('uses HTTP 507 + payload carries estimatedBytes + freeBytes', () => {
    const ex = new InsufficientStorageException(1_000_000, 500_000);
    expect(ex.getStatus()).toBe(507);
    const payload = ex.getResponse() as Record<string, unknown>;
    expect(payload).toMatchObject({
      statusCode: 507,
      error: 'Insufficient Storage',
      estimatedBytes: 1_000_000,
      freeBytes: 500_000,
    });
    expect(typeof payload.message).toBe('string');
  });
});
