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
});
