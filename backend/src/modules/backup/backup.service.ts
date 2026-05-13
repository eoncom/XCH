import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../common/services/storage.service';
import { validateMagicBytes } from '../../common/utils/upload-security';
import * as archiver from 'archiver';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');
import { PassThrough, Readable, Transform, TransformCallback } from 'stream';
import { pipeline } from 'stream/promises';
import { once } from 'events';
import * as fs from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash, randomBytes } from 'crypto';
import * as unzipper from 'unzipper';
import { BackupOptionsDto } from './dto/backup-options.dto';
import { RestoreOptionsDto } from './dto/restore-options.dto';
import {
  DryRunReportResponseDto,
  toDryRunReportResponseDto,
} from './dto/dry-run-report.response.dto';

// ============================================================================
// Pin rendering constants (mirror from frontend FloorPlanViewer.tsx)
// ============================================================================

import { PIN_COLORS, PIN_LABELS } from '../../common/constants/pin-config';

interface BackupMetadata {
  version: string;
  type: 'full' | 'site';
  timestamp: string;
  tenantId: string;
  siteId?: string;
  siteCode?: string;
  counts: Record<string, number>;
}

/**
 * Track D.1 — Backup format v2 metadata schema.
 *
 * Discriminant for v1 vs v2 : `typeof metadata.version` (string '1.0' vs
 * number 2). Restore parses the metadata first and routes to the right
 * pipeline accordingly.
 *
 * `files` maps the in-archive path (e.g. 'minio/xch-storage/photos/abc.jpg')
 * to {size, sha256, bucket, key}. Populated by streamBucketIntoArchive as
 * each MinIO object is streamed through HashingStream.
 */
export interface BackupFileEntryV2 {
  size: number;
  sha256: string;
  bucket: string;
  key: string;
}

export interface BackupMetadataV2 {
  version: 2;
  createdAt: string;
  tenantId: string;
  type: 'full' | 'site' | 'db-only';
  siteId: string | null;
  siteCode: string | null;
  appVersion: string;
  buckets: string[];
  counts: Record<string, number>;
  files: Record<string, BackupFileEntryV2>;
}

export interface BackupListItem {
  id: string;
  filename: string;
  type: 'full' | 'site';
  siteCode?: string;
  size: number;
  createdAt: string;
}

/**
 * Progress callback signature for streaming backup/restore operations.
 * Track D.1 Phase 1 step 2.
 *
 * Phases the backup can be in (one of) :
 *  - 'collect'  : prisma findMany for all tables
 *  - 'archive'  : streaming objects from MinIO into the archive
 *  - 'upload'   : fPutObject to xch-backups bucket
 *  - 'done'     : final
 */
export type ProgressCallback = (
  phase: string,
  current: number,
  total: number,
  message: string,
) => void;

/**
 * Transform stream that updates a sha256 hash and counts bytes as data
 * passes through, then forwards the chunk unchanged downstream. Used by
 * streamBucketIntoArchive to compute per-file integrity hashes without
 * buffering the file content in memory.
 *
 * Convention: read `digest()` + `bytesProcessed` AFTER the stream has
 * emitted 'end' (consumer drained). Reading earlier yields a partial
 * hash for the chunks transformed so far.
 *
 * Track D.1 Phase 1 step 2.
 */
export class HashingStream extends Transform {
  private hash = createHash('sha256');
  public bytesProcessed = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.hash.update(chunk);
    this.bytesProcessed += chunk.length;
    callback(null, chunk);
  }

  digest(): string {
    return this.hash.digest('hex');
  }
}

/**
 * Transform stream that validates the first 4 bytes of input against
 * the ZIP local-file-header magic (PK\x03\x04 = 50 4B 03 04) before
 * passing data through unchanged. Used by restoreFullBackupV2 at the
 * head of the unzip pipeline.
 *
 * Behaviour :
 *  - Buffers incoming chunks until ≥4 bytes have been received (handles
 *    the pathological case of a 1-byte first chunk).
 *  - Validates the first 4 bytes. On mismatch → calls the transform
 *    callback with a {@link BadRequestException}, which propagates as a
 *    stream error and surfaces in the orchestrator's try/catch.
 *  - On success → flushes the buffered prefix downstream and switches
 *    to pure pass-through for subsequent chunks (no per-chunk overhead).
 *  - On premature EOF (< 4 bytes total) → `_flush` errors out with the
 *    same BadRequestException semantics.
 *
 * Catches both "uploaded a `.txt` masquerading as a backup" and
 * "truncated download" failure modes. Cheap (no allocation past the
 * 4-byte prefix).
 *
 * Track D.1 Phase 1 step 3.
 */
export class MagicByteValidator extends Transform {
  private static readonly ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  private static readonly REQUIRED_BYTES = 4;

  private prefix: Buffer = Buffer.alloc(0);
  private validated = false;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.validated) {
      callback(null, chunk);
      return;
    }

    this.prefix = Buffer.concat([this.prefix, chunk]);
    if (this.prefix.length < MagicByteValidator.REQUIRED_BYTES) {
      // Wait for more bytes — pathological case of a 1-byte first chunk.
      callback();
      return;
    }

    const magic = this.prefix.subarray(0, MagicByteValidator.REQUIRED_BYTES);
    if (!magic.equals(MagicByteValidator.ZIP_MAGIC)) {
      callback(
        new BadRequestException(
          `Invalid backup archive: expected ZIP magic bytes ` +
            `${MagicByteValidator.ZIP_MAGIC.toString('hex')}, got ${magic.toString('hex')}`,
        ),
      );
      return;
    }

    // Magic OK — flush the buffered prefix and switch to pass-through.
    this.validated = true;
    const flushed = this.prefix;
    this.prefix = Buffer.alloc(0);
    callback(null, flushed);
  }

  override _flush(callback: TransformCallback): void {
    if (!this.validated) {
      callback(
        new BadRequestException(
          `Invalid backup archive: stream ended before ` +
            `${MagicByteValidator.REQUIRED_BYTES} bytes could be read ` +
            `(got ${this.prefix.length}). File may be truncated or empty.`,
        ),
      );
      return;
    }
    callback();
  }
}

/**
 * Discriminated union result of {@link BackupService.restoreFullBackupV2}.
 * Track D.1 Phase 1 step 3.
 */
export type RestoreFullV2Result =
  | { kind: 'dry-run'; report: DryRunReportResponseDto }
  | { kind: 'applied'; message: string; counts: Record<string, number>; siteIds: string[] }
  | { kind: 'delegated-v1'; message: string; counts: Record<string, number>; siteIds: string[] };

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_BUCKET = 'xch-backups';
  private _minioClient: InstanceType<typeof import('minio').Client> | null = null;

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  // ==========================================================================
  // FULL BACKUP
  // ==========================================================================

  async createFullBackup(tenantId: string, userId?: string): Promise<{ message: string; filename: string; size: number }> {
    this.logger.log(`Starting full backup for tenant ${tenantId}`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `full-backup-${timestamp}.zip`;

    const data = await this.exportAllTenantData(tenantId);
    const pins = data['pins'] || [];
    const files = await this.collectFiles(data, pins);

    const metadata: BackupMetadata = {
      version: '1.0',
      type: 'full',
      timestamp: new Date().toISOString(),
      tenantId,
      counts: this.countRecords(data),
    };

    const zipBuffer = await this.createFullZip(data, files, metadata);

    // Upload directly to xch-backups bucket (not via storageService which targets xch-storage)
    await this.uploadToBackupBucket(zipBuffer, filename);

    this.logger.log(`Full backup completed: ${filename} (${zipBuffer.length} bytes, ${files.length} files)`);
    await this.logBackupAction(tenantId, userId, 'BACKUP_FULL', { filename, size: zipBuffer.length });

    return { message: 'Backup complet créé avec succès', filename, size: zipBuffer.length };
  }

  // ==========================================================================
  // SITE BACKUP
  // ==========================================================================

  async createSiteBackup(
    tenantId: string,
    siteId: string,
    userId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, tenantId },
    });
    if (!site) throw new NotFoundException('Site not found');

    this.logger.log(`Starting site backup: ${site.code} (${siteId})`);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `site-${site.code}-${timestamp}.zip`;

    const data = await this.exportSiteData(tenantId, siteId);
    const pins = data['pins'] || [];
    const files = await this.collectFiles(data, pins);

    const zipBuffer = await this.createSiteZip(data, files, {
      version: '1.0',
      type: 'site',
      timestamp: new Date().toISOString(),
      tenantId,
      siteId,
      siteCode: site.code,
      counts: this.countRecords(data),
    });

    try {
      await this.uploadToBackupBucket(zipBuffer, filename);
    } catch (err: unknown) {
      this.logger.warn(`Could not store backup in MinIO: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    await this.logBackupAction(tenantId, userId, 'BACKUP_SITE', {
      filename, siteId, siteCode: site.code, size: zipBuffer.length,
    });

    this.logger.log(`Site backup completed: ${filename} (${zipBuffer.length} bytes)`);
    return { buffer: zipBuffer, filename };
  }

  // ==========================================================================
  // SITE RESTORE
  // ==========================================================================

  async restoreSiteBackup(
    tenantId: string,
    zipBuffer: Buffer,
    userId?: string,
  ): Promise<{ message: string; siteId: string; counts: Record<string, number> }> {
    this.logger.log('Starting site restore...');

    // S1 hardening 2026-04-26 — vérif magic-bytes avant unzip pour bloquer
    // un upload .zip qui contiendrait en fait un autre format (defense
    // in depth ; backupFileFilter check déjà mimetype + extension).
    validateMagicBytes(zipBuffer, ['zip']);

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const metadataEntry = entries.find((e: any) => e.entryName.endsWith('metadata.json'));
    if (!metadataEntry) throw new BadRequestException('Invalid backup: metadata.json not found');

    const metadata: BackupMetadata = JSON.parse(metadataEntry.getData().toString('utf8'));
    if (metadata.version !== '1.0') throw new BadRequestException(`Unsupported backup version: ${metadata.version}`);
    if (metadata.type !== 'site') throw new BadRequestException('This endpoint only supports site backups');

    // Parse data files
    const dataFiles: Record<string, any[]> = {};
    for (const entry of entries) {
      if (entry.entryName.includes('/data/') && entry.entryName.endsWith('.json')) {
        const key = entry.entryName.split('/').pop()!.replace('.json', '');
        try {
          dataFiles[key] = JSON.parse(entry.getData().toString('utf8'));
        } catch {
          this.logger.warn(`Could not parse ${entry.entryName}`);
        }
      }
    }

    // Collect file entries (only from raw/ subfolder or legacy plans/ folder for restore)
    const fileEntries: { entryName: string; data: Buffer }[] = [];
    for (const entry of entries) {
      if (entry.entryName.includes('/files/') && !entry.isDirectory) {
        // Skip rendered files — only restore raw source files
        if (entry.entryName.includes('/rendered/')) continue;
        fileEntries.push({ entryName: entry.entryName, data: entry.getData() });
      }
    }

    const siteData = dataFiles['site']?.[0];
    if (!siteData) throw new BadRequestException('Invalid backup: site.json not found or empty');

    const existingSite = await this.prisma.site.findFirst({
      where: { tenantId, code: siteData.code },
    });
    if (existingSite) {
      throw new BadRequestException(`Un site avec le code "${siteData.code}" existe déjà.`);
    }

    // Import in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Ensure a default delegation exists for imports
      const defaultDelegationId = await this.getOrCreateDefaultDelegation(tx, tenantId);

      // 2. Create site (ALL fields)
      const newSite = await tx.site.create({
        data: {
          tenantId,
          delegationId: siteData.delegationId || defaultDelegationId,
          code: siteData.code,
          name: siteData.name,
          status: siteData.status || 'ACTIVE',
          address: siteData.address,
          city: siteData.city,
          postalCode: siteData.postalCode,
          country: siteData.country || 'France',
          healthStatus: siteData.healthStatus || 'UNKNOWN',
          // ADR-018 cible D — scalar columns (formerly contacts/accessNotes/
          // emplacements/metadata.serverInfo JSON). Connectivity links are
          // restored separately via restoreConnectivityLinks(). Contacts and
          // emplacements are restored via dedicated tables (Contact +
          // SiteEmplacement) elsewhere in the backup flow.
          accessSchedules:  siteData.accessSchedules  ?? null,
          accessBadges:     siteData.accessBadges     ?? null,
          accessProcedures: siteData.accessProcedures ?? null,
          accessSafety:     siteData.accessSafety     ?? null,
          smbPath:          siteData.smbPath          ?? null,
          sharepointUrl:    siteData.sharepointUrl    ?? null,
          gedUrl:           siteData.gedUrl           ?? null,
          accessRightsUrl:  siteData.accessRightsUrl  ?? null,
          cutProcedure: siteData.cutProcedure || undefined,
          governanceDocsRef: siteData.governanceDocsRef || undefined,
          notes: siteData.notes || undefined,
          monitoringEnabled: siteData.monitoringEnabled ?? true,
        },
      });

      // Set GPS coordinates via raw SQL (PostGIS geometry not handled by Prisma)
      if (siteData.latitude != null && siteData.longitude != null) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($2, $3), 4326) WHERE id = $1`,
            newSite.id,
            Number(siteData.longitude),
            Number(siteData.latitude),
          );
        } catch (err: unknown) {
          this.logger.warn(`Could not set coordinates for site ${newSite.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      const counts: Record<string, number> = { sites: 1 };

      // 2. Create assets (ALL fields) — deduplicate serialNumber to avoid unique constraint
      const assetIdMap = new Map<string, string>();
      if (dataFiles['assets']?.length) {
        const suffix = `-R${Date.now().toString(36)}`;
        for (const asset of dataFiles['assets']) {
          // Check if serialNumber already exists for this tenant
          let serialNumber = asset.serialNumber || null;
          if (serialNumber) {
            const existing = await tx.asset.findFirst({
              where: { tenantId, serialNumber },
              select: { id: true },
            });
            if (existing) {
              serialNumber = `${serialNumber}${suffix}`;
            }
          }

          const newAsset = await tx.asset.create({
            data: {
              tenantId,
              siteId: newSite.id,
              delegationId: siteData.delegationId || defaultDelegationId,
              name: asset.name,
              type: asset.type,
              status: asset.status || 'IN_SERVICE',
              manufacturer: asset.manufacturer,
              model: asset.model,
              serialNumber,
              ip: asset.ip ?? null,
              mac: asset.mac ?? null,
              hostname: asset.hostname ?? null,
              vlan: asset.vlan ?? null,
              port: asset.port ?? null,
              locationText: asset.locationText,
              inventoryTag: asset.inventoryTag,
              qrCodeUrl: asset.qrCodeUrl,
              qrCodeToken: asset.qrCodeToken,
              purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : undefined,
              warrantyEnd: asset.warrantyEnd ? new Date(asset.warrantyEnd) : undefined,
              weight: asset.weight != null ? Number(asset.weight) : undefined,
              powerConsumption: asset.powerConsumption != null ? Number(asset.powerConsumption) : undefined,
              notes: asset.notes,
            },
          });
          assetIdMap.set(asset.id, newAsset.id);
        }
        counts.assets = dataFiles['assets'].length;
      }

      // 3. Create racks (ALL fields)
      const rackIdMap = new Map<string, string>();
      if (dataFiles['racks']?.length) {
        for (const rack of dataFiles['racks']) {
          const newRack = await tx.rack.create({
            data: {
              tenantId,
              siteId: newSite.id,
              name: rack.name,
              heightU: rack.heightU || 42,
              location: rack.location,
              specs: rack.specs,
              notes: rack.notes,
              serialNumber: rack.serialNumber,
              model: rack.model,
              manufacturer: rack.manufacturer,
              rackType: rack.rackType || 'FLOOR_STANDING',
              status: rack.status || 'IN_SERVICE',
            },
          });
          rackIdMap.set(rack.id, newRack.id);

          // Link assets to rack
          if (dataFiles['assets']?.length) {
            for (const asset of dataFiles['assets'].filter((a: any) => a.rackId === rack.id)) {
              const newAssetId = assetIdMap.get(asset.id);
              if (newAssetId) {
                await tx.asset.update({
                  where: { id: newAssetId },
                  data: {
                    rackId: newRack.id,
                    rackPositionU: asset.rackPositionU,
                    rackHeightU: asset.rackHeightU,
                    rackNotes: asset.rackNotes,
                  },
                });
              }
            }
          }
        }
        counts.racks = dataFiles['racks'].length;
      }

      // 4. Create floor plans (ALL fields)
      const floorPlanIdMap = new Map<string, string>();
      if (dataFiles['floor-plans']?.length) {
        for (const plan of dataFiles['floor-plans']) {
          const newPlan = await tx.floorPlan.create({
            data: {
              siteId: newSite.id,
              title: plan.title || plan.name || 'Untitled',
              version: plan.version || 1,
              fileUrl: plan.fileUrl || '',
              uploadedBy: plan.uploadedBy || userId || 'restore',
              notes: plan.notes,
              planGroupId: plan.planGroupId,
              fileSize: plan.fileSize != null ? Number(plan.fileSize) : undefined,
              mimeType: plan.mimeType,
              scaleMetersPerPixel: plan.scaleMetersPerPixel != null ? Number(plan.scaleMetersPerPixel) : undefined,
              scaleRefLine: plan.scaleRefLine || undefined,
            },
          });
          floorPlanIdMap.set(plan.id, newPlan.id);
        }
        counts.floorPlans = dataFiles['floor-plans'].length;
      }

      // 5. Create pins
      if (dataFiles['pins']?.length) {
        for (const pin of dataFiles['pins']) {
          const newFloorPlanId = floorPlanIdMap.get(pin.floorPlanId);
          if (newFloorPlanId) {
            await tx.pin.create({
              data: {
                floorPlanId: newFloorPlanId,
                pinType: pin.pinType,
                label: pin.label,
                description: pin.description,
                x: pin.x,
                y: pin.y,
                assetId: pin.assetId ? assetIdMap.get(pin.assetId) : undefined,
                rackId: pin.rackId ? rackIdMap.get(pin.rackId) : undefined,
              },
            });
          }
        }
        counts.pins = dataFiles['pins'].length;
      }

      // 6. Create tasks (ALL fields)
      const taskIdMap = new Map<string, string>();
      if (dataFiles['tasks']?.length) {
        for (const task of dataFiles['tasks']) {
          const newTask = await tx.task.create({
            data: {
              tenantId,
              siteId: newSite.id,
              title: task.title,
              description: task.description,
              status: task.status || 'TODO',
              priority: task.priority || 'MEDIUM',
              createdBy: userId || task.createdBy,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              ticketRef: task.ticketRef,
              ticketUrl: task.ticketUrl,
              ticketStatus: task.ticketStatus,
              completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
              assetId: task.assetId ? assetIdMap.get(task.assetId) : undefined,
            },
          });
          taskIdMap.set(task.id, newTask.id);

          // Checklist items
          if (dataFiles['task-checklist']?.length) {
            for (const item of dataFiles['task-checklist'].filter((i: any) => i.taskId === task.id)) {
              await tx.taskChecklistItem.create({
                data: {
                  taskId: newTask.id,
                  text: item.text,
                  checked: item.checked || false,
                  order: item.order || 0,
                },
              });
            }
          }
        }
        counts.tasks = dataFiles['tasks'].length;
      }

      // 7. Create attachments (re-map entity IDs to new IDs)
      const attachmentPathMap = new Map<string, string>(); // oldFilename -> newMinIOPath
      if (dataFiles['attachments']?.length) {
        for (const att of dataFiles['attachments']) {
          const newAssetId = att.assetId ? assetIdMap.get(att.assetId) : null;
          const newTaskId = att.taskId ? taskIdMap.get(att.taskId) : null;
          const newRackId = att.rackId ? rackIdMap.get(att.rackId) : null;
          const newSiteIdRef = att.siteId ? newSite.id : null;

          // Determine new MinIO path
          const entityType = newAssetId ? 'assets' : newTaskId ? 'tasks' : newRackId ? 'racks' : 'sites';
          const entityId = newAssetId || newTaskId || newRackId || newSite.id;
          const newPath = `attachments/${tenantId}/${entityType}/${entityId}/${att.filename}`;

          attachmentPathMap.set(att.filename, newPath);

          await tx.attachment.create({
            data: {
              tenantId,
              assetId: newAssetId || undefined,
              taskId: newTaskId || undefined,
              rackId: newRackId || undefined,
              siteId: newSiteIdRef || undefined,
              filename: att.filename,
              originalFilename: att.originalFilename,
              size: att.size,
              mimetype: att.mimetype,
              path: newPath,
              description: att.description,
              category: att.category,
              uploadedBy: att.uploadedBy || userId || 'restore',
            },
          });
        }
        counts.attachments = dataFiles['attachments'].length;
      }

      return { siteId: newSite.id, counts, attachmentPathMap };
    });

    // Upload files to MinIO (outside transaction)
    let restoredFiles = 0;
    for (const fileEntry of fileEntries) {
      try {
        const parts = fileEntry.entryName.split('/files/');
        if (parts.length >= 2) {
          const relativePath = parts[1];

          // Handle plan files: strip plans/raw/ prefix → upload to floor-plans/
          if (relativePath.startsWith('plans/raw/')) {
            const fname = relativePath.substring('plans/raw/'.length);
            await this.storageService.uploadFile(
              {
                buffer: fileEntry.data,
                originalname: fname,
                mimetype: 'application/octet-stream',
                size: fileEntry.data.length,
              } as Express.Multer.File,
              'floor-plans',
              fname,
            );
            restoredFiles++;
          }
          // Handle attachment files: use attachmentPathMap to determine new MinIO path
          else if (relativePath.startsWith('attachments/')) {
            const attFilename = relativePath.split('/').pop() || '';
            const newPath = result.attachmentPathMap.get(attFilename);
            if (newPath) {
              // newPath format: attachments/{tenantId}/{entityType}/{entityId}/{filename}
              const pathParts = newPath.split('/');
              const folder = pathParts.slice(0, -1).join('/');
              const fname = pathParts[pathParts.length - 1];
              await this.storageService.uploadFile(
                {
                  buffer: fileEntry.data,
                  originalname: fname,
                  mimetype: 'application/octet-stream',
                  size: fileEntry.data.length,
                } as Express.Multer.File,
                folder,
                fname,
              );
              restoredFiles++;
            }
          }
        }
      } catch (err: unknown) {
        this.logger.warn(`Could not restore file ${fileEntry.entryName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    this.logger.log(`Restored ${restoredFiles} files to MinIO`);

    await this.logBackupAction(tenantId, userId, 'RESTORE_SITE', {
      siteId: result.siteId, siteCode: siteData.code, counts: result.counts,
    });

    return {
      message: `Site "${siteData.code}" restauré avec succès`,
      siteId: result.siteId,
      counts: result.counts,
    };
  }

  // ==========================================================================
  // FULL RESTORE
  // ==========================================================================

  async restoreFullBackup(
    tenantId: string,
    zipBuffer: Buffer,
    userId?: string,
  ): Promise<{ message: string; counts: Record<string, number>; siteIds: string[] }> {
    this.logger.log('Starting full restore...');

    // S1 hardening 2026-04-26 — vérif magic-bytes (cf. restoreSiteBackup).
    validateMagicBytes(zipBuffer, ['zip']);

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const metadataEntry = entries.find((e: any) => e.entryName.endsWith('metadata.json'));
    if (!metadataEntry) throw new BadRequestException('Invalid backup: metadata.json not found');

    const metadata: BackupMetadata = JSON.parse(metadataEntry.getData().toString('utf8'));
    if (metadata.version !== '1.0') throw new BadRequestException(`Unsupported backup version: ${metadata.version}`);

    // Parse data files
    const dataFiles: Record<string, any[]> = {};
    for (const entry of entries) {
      if (entry.entryName.includes('/data/') && entry.entryName.endsWith('.json')) {
        const key = entry.entryName.split('/').pop()!.replace('.json', '');
        try {
          dataFiles[key] = JSON.parse(entry.getData().toString('utf8'));
        } catch {
          this.logger.warn(`Could not parse ${entry.entryName}`);
        }
      }
    }

    // Collect file entries
    const fileEntries: { entryName: string; data: Buffer }[] = [];
    for (const entry of entries) {
      if (entry.entryName.includes('/files/') && !entry.isDirectory) {
        if (entry.entryName.includes('/rendered/')) continue;
        fileEntries.push({ entryName: entry.entryName, data: entry.getData() });
      }
    }

    const sitesData = dataFiles['sites'] || [];
    if (!sitesData.length) throw new BadRequestException('Invalid backup: no sites data found');

    const totalCounts: Record<string, number> = {};
    const siteIds: string[] = [];

    // Import in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const assetIdMap = new Map<string, string>();
      const rackIdMap = new Map<string, string>();
      const taskIdMap = new Map<string, string>();
      const floorPlanIdMap = new Map<string, string>();
      const siteIdMap = new Map<string, string>();
      const attachmentPathMap = new Map<string, string>();
      // Track C 2026-05-10 — id maps for the cost ecosystem + photos +
      // task comments + asset movements + connectivity + budgets.
      const contactIdMap = new Map<string, string>();
      const billingEntityIdMap = new Map<string, string>();
      const expenseIdMap = new Map<string, string>();
      const budgetIdMap = new Map<string, string>();

      // 1. Create contacts + contact types (tenant-level)
      const contactTypeIdMap = new Map<string, string>();
      if (dataFiles['contact-types']?.length) {
        for (const ct of dataFiles['contact-types']) {
          const existing = await tx.contactType.findFirst({ where: { tenantId, slug: ct.slug } });
          if (existing) {
            contactTypeIdMap.set(ct.id, existing.id);
          } else {
            const newCt = await tx.contactType.create({
              data: {
                tenantId, name: ct.name, slug: ct.slug,
                category: ct.category || 'PROVIDER',
                icon: ct.icon, color: ct.color,
                isSystem: ct.isSystem || false, isActive: ct.isActive !== false,
              },
            });
            contactTypeIdMap.set(ct.id, newCt.id);
          }
        }
        totalCounts['contact-types'] = dataFiles['contact-types'].length;
      }

      if (dataFiles['contacts']?.length) {
        for (const contact of dataFiles['contacts']) {
          const existing = await tx.contact.findFirst({ where: { tenantId, name: contact.name } });
          if (existing) {
            // Track C: track id even when skipping (vendor remap on Expense)
            contactIdMap.set(contact.id, existing.id);
          } else {
            const newTypeId = contact.typeId ? contactTypeIdMap.get(contact.typeId) : undefined;
            if (newTypeId) {
              const newContact = await tx.contact.create({
                data: {
                  tenantId, name: contact.name,
                  typeId: newTypeId,
                  email: contact.email, phone: contact.phone,
                  mobile: contact.mobile, address: contact.address,
                  company: contact.company, role: contact.role,
                  notes: contact.notes,
                },
              });
              contactIdMap.set(contact.id, newContact.id);
            }
          }
        }
        totalCounts.contacts = dataFiles['contacts'].length;
      }

      // 2. Create sites + related entities
      const sitesWithCoords: { id: string; lat: number; lng: number }[] = [];

      for (const siteData of sitesData) {
        const existingSite = await tx.site.findFirst({ where: { tenantId, code: siteData.code } });
        if (existingSite) {
          this.logger.warn(`Site "${siteData.code}" already exists — skipping`);
          continue;
        }

        const defaultDelegationId = await this.getOrCreateDefaultDelegation(tx, tenantId);
        const newSite = await tx.site.create({
          data: {
            tenantId,
            delegationId: siteData.delegationId || defaultDelegationId,
            code: siteData.code,
            name: siteData.name,
            status: siteData.status || 'ACTIVE',
            address: siteData.address,
            city: siteData.city,
            postalCode: siteData.postalCode,
            country: siteData.country || 'France',
            healthStatus: siteData.healthStatus || 'UNKNOWN',
            // ADR-018 cible D — scalar columns (formerly contacts/accessNotes/
            // metadata.serverInfo JSON). Backups taken on v1.5 or earlier are
            // not supported (demo data only).
            accessSchedules:  siteData.accessSchedules  ?? null,
            accessBadges:     siteData.accessBadges     ?? null,
            accessProcedures: siteData.accessProcedures ?? null,
            accessSafety:     siteData.accessSafety     ?? null,
            smbPath:          siteData.smbPath          ?? null,
            sharepointUrl:    siteData.sharepointUrl    ?? null,
            gedUrl:           siteData.gedUrl           ?? null,
            accessRightsUrl:  siteData.accessRightsUrl  ?? null,
            cutProcedure: siteData.cutProcedure || undefined,
            governanceDocsRef: siteData.governanceDocsRef || undefined,
            notes: siteData.notes || undefined,
            monitoringEnabled: siteData.monitoringEnabled ?? true,
          },
        });
        siteIdMap.set(siteData.id, newSite.id);
        siteIds.push(newSite.id);

        // Queue GPS coordinates for raw SQL update after transaction content
        if (siteData.latitude != null && siteData.longitude != null) {
          sitesWithCoords.push({ id: newSite.id, lat: Number(siteData.latitude), lng: Number(siteData.longitude) });
        }

        // Assets for this site (ALL fields)
        const siteAssets = (dataFiles['assets'] || []).filter((a: any) => a.siteId === siteData.id);
        for (const asset of siteAssets) {
          const newAsset = await tx.asset.create({
            data: {
              tenantId, siteId: newSite.id,
              delegationId: siteData.delegationId || defaultDelegationId,
              name: asset.name, type: asset.type, status: asset.status || 'IN_SERVICE',
              manufacturer: asset.manufacturer, model: asset.model,
              serialNumber: asset.serialNumber,
              ip: asset.ip ?? null,
              mac: asset.mac ?? null,
              hostname: asset.hostname ?? null,
              vlan: asset.vlan ?? null,
              port: asset.port ?? null,
              locationText: asset.locationText,
              inventoryTag: asset.inventoryTag,
              qrCodeUrl: asset.qrCodeUrl,
              qrCodeToken: asset.qrCodeToken,
              purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : undefined,
              warrantyEnd: asset.warrantyEnd ? new Date(asset.warrantyEnd) : undefined,
              weight: asset.weight != null ? Number(asset.weight) : undefined,
              powerConsumption: asset.powerConsumption != null ? Number(asset.powerConsumption) : undefined,
              notes: asset.notes,
            },
          });
          assetIdMap.set(asset.id, newAsset.id);
        }

        // Racks for this site (ALL fields)
        const siteRacks = (dataFiles['racks'] || []).filter((r: any) => r.siteId === siteData.id);
        for (const rack of siteRacks) {
          const newRack = await tx.rack.create({
            data: {
              tenantId, siteId: newSite.id,
              name: rack.name, heightU: rack.heightU || 42,
              location: rack.location, specs: rack.specs, notes: rack.notes,
              serialNumber: rack.serialNumber,
              model: rack.model,
              manufacturer: rack.manufacturer,
              rackType: rack.rackType || 'FLOOR_STANDING',
              status: rack.status || 'IN_SERVICE',
            },
          });
          rackIdMap.set(rack.id, newRack.id);

          // Link assets to rack
          for (const asset of siteAssets.filter((a: any) => a.rackId === rack.id)) {
            const newAssetId = assetIdMap.get(asset.id);
            if (newAssetId) {
              await tx.asset.update({
                where: { id: newAssetId },
                data: { rackId: newRack.id, rackPositionU: asset.rackPositionU, rackHeightU: asset.rackHeightU, rackNotes: asset.rackNotes },
              });
            }
          }
        }

        // Floor plans for this site (ALL fields)
        const sitePlans = (dataFiles['floor-plans'] || []).filter((fp: any) => fp.siteId === siteData.id);
        for (const plan of sitePlans) {
          const newPlan = await tx.floorPlan.create({
            data: {
              siteId: newSite.id,
              title: plan.title || plan.name || 'Untitled',
              version: plan.version || 1,
              fileUrl: plan.fileUrl || '',
              uploadedBy: plan.uploadedBy || userId || 'restore',
              notes: plan.notes,
              planGroupId: plan.planGroupId,
              fileSize: plan.fileSize != null ? Number(plan.fileSize) : undefined,
              mimeType: plan.mimeType,
              scaleMetersPerPixel: plan.scaleMetersPerPixel != null ? Number(plan.scaleMetersPerPixel) : undefined,
              scaleRefLine: plan.scaleRefLine || undefined,
            },
          });
          floorPlanIdMap.set(plan.id, newPlan.id);
        }

        // Pins
        const planIds = sitePlans.map((p: any) => p.id);
        const sitePins = (dataFiles['pins'] || []).filter((p: any) => planIds.includes(p.floorPlanId));
        for (const pin of sitePins) {
          const newFloorPlanId = floorPlanIdMap.get(pin.floorPlanId);
          if (newFloorPlanId) {
            await tx.pin.create({
              data: {
                floorPlanId: newFloorPlanId, pinType: pin.pinType,
                label: pin.label, description: pin.description,
                x: pin.x, y: pin.y,
                assetId: pin.assetId ? assetIdMap.get(pin.assetId) : undefined,
                rackId: pin.rackId ? rackIdMap.get(pin.rackId) : undefined,
              },
            });
          }
        }

        // Tasks for this site (ALL fields)
        const siteTasks = (dataFiles['tasks'] || []).filter((t: any) => t.siteId === siteData.id);
        for (const task of siteTasks) {
          const newTask = await tx.task.create({
            data: {
              tenantId, siteId: newSite.id,
              title: task.title, description: task.description,
              status: task.status || 'TODO', priority: task.priority || 'MEDIUM',
              createdBy: userId || task.createdBy,
              dueDate: task.dueDate ? new Date(task.dueDate) : null,
              ticketRef: task.ticketRef,
              ticketUrl: task.ticketUrl,
              ticketStatus: task.ticketStatus,
              completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
              assetId: task.assetId ? assetIdMap.get(task.assetId) : undefined,
            },
          });
          taskIdMap.set(task.id, newTask.id);
        }

        totalCounts[`site:${siteData.code}`] = 1;
      }

      // Set GPS coordinates via raw SQL (inside transaction)
      for (const sc of sitesWithCoords) {
        try {
          await tx.$executeRawUnsafe(
            `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($2, $3), 4326) WHERE id = $1`,
            sc.id, sc.lng, sc.lat,
          );
        } catch { /* non-critical */ }
      }

      totalCounts.sites = siteIds.length;
      totalCounts.assets = assetIdMap.size;
      totalCounts.racks = rackIdMap.size;
      totalCounts.floorPlans = floorPlanIdMap.size;
      totalCounts.tasks = taskIdMap.size;

      // ====================================================================
      // Track C 2026-05-10 — B10 fix: restore the previously missing tables
      // (cost ecosystem + asset movements + photos + task comments + site
      // health snapshots + connectivity links + budgets). FK ordering:
      //   1. SiteHealthSnapshot       (siteId)
      //   2. AssetMovement            (assetId, optional site/rack)
      //   3. TaskComment              (taskId, authorId)
      //   4. Photo                    (polymorphic entityType + entityId)
      //   5. BillingEntity            (tenant-scoped, idempotent on code)
      //   6. Expense                  (bearer + delegation + site + asset + vendor)
      //   7. CostAllocation           (expense + target BillingEntity)
      //   8. ConnectivityLink         (site + asset + expense)
      //   9. Budget                   (delegation + site + billingEntity, 2-pass for parent/child)
      // ====================================================================

      // 1. SiteHealthSnapshot — 1:1 with site, idempotent via upsert.
      if (dataFiles['site-health-snapshots']?.length) {
        let count = 0;
        for (const snap of dataFiles['site-health-snapshots']) {
          const newSiteId = siteIdMap.get(snap.siteId);
          if (!newSiteId) continue;
          await tx.siteHealthSnapshot.upsert({
            where: { siteId: newSiteId },
            update: {
              overall: snap.overall,
              componentsJson: snap.componentsJson,
              computedAt: new Date(snap.computedAt),
            },
            create: {
              siteId: newSiteId,
              overall: snap.overall,
              componentsJson: snap.componentsJson,
              computedAt: new Date(snap.computedAt),
            },
          });
          count++;
        }
        totalCounts.siteHealthSnapshots = count;
      }

      // 2. AssetMovement — append-only audit trail, no idempotence needed.
      if (dataFiles['asset-movements']?.length) {
        let count = 0;
        for (const mov of dataFiles['asset-movements']) {
          const newAssetId = assetIdMap.get(mov.assetId);
          if (!newAssetId) continue;
          await tx.assetMovement.create({
            data: {
              tenantId,
              assetId: newAssetId,
              userId: null, // user remap not in scope; FK is SetNull on user delete
              type: mov.type,
              fromSiteId: mov.fromSiteId ? siteIdMap.get(mov.fromSiteId) ?? null : null,
              toSiteId:   mov.toSiteId   ? siteIdMap.get(mov.toSiteId)   ?? null : null,
              fromRackId: mov.fromRackId ? rackIdMap.get(mov.fromRackId) ?? null : null,
              toRackId:   mov.toRackId   ? rackIdMap.get(mov.toRackId)   ?? null : null,
              fromRackPositionU: mov.fromRackPositionU ?? null,
              toRackPositionU:   mov.toRackPositionU   ?? null,
              fromStatus: mov.fromStatus ?? null,
              toStatus:   mov.toStatus   ?? null,
              notes: mov.notes ?? null,
              timestamp: mov.timestamp ? new Date(mov.timestamp) : new Date(),
            },
          });
          count++;
        }
        totalCounts.assetMovements = count;
      }

      // 3. TaskComment — append-only, no idempotence needed.
      if (dataFiles['task-comments']?.length) {
        let count = 0;
        for (const com of dataFiles['task-comments']) {
          const newTaskId = taskIdMap.get(com.taskId);
          if (!newTaskId) continue;
          await tx.taskComment.create({
            data: {
              taskId: newTaskId,
              authorId: userId || com.authorId, // best-effort: reattribute to restore actor
              text: com.text,
              isSystem: com.isSystem ?? false,
            },
          });
          count++;
        }
        totalCounts.taskComments = count;
      }

      // 4. Photo (polymorphic entityType: site / asset / task)
      if (dataFiles['photos']?.length) {
        let count = 0;
        for (const photo of dataFiles['photos']) {
          let newEntityId: string | undefined;
          switch (photo.entityType) {
            case 'site':  newEntityId = siteIdMap.get(photo.entityId); break;
            case 'asset': newEntityId = assetIdMap.get(photo.entityId); break;
            case 'task':  newEntityId = taskIdMap.get(photo.entityId); break;
          }
          if (!newEntityId) continue;
          await tx.photo.create({
            data: {
              entityType: photo.entityType,
              entityId: newEntityId,
              fileUrl: photo.fileUrl,
              fileName: photo.fileName,
              fileSize: photo.fileSize ?? null,
              mimeType: photo.mimeType,
              caption: photo.caption ?? null,
              uploadedBy: userId || photo.uploadedBy,
            },
          });
          count++;
        }
        totalCounts.photos = count;
      }

      // 5. BillingEntity — tenant-scoped, idempotent on code (matches the
      // Site/Contact pattern). delegationId/siteId reused as-is for
      // same-tenant restore; for cross-tenant restore, FK violations
      // would surface here (out of scope for Track C — see Track D).
      if (dataFiles['billing-entities']?.length) {
        for (const be of dataFiles['billing-entities']) {
          const existing = await tx.billingEntity.findFirst({ where: { tenantId, code: be.code } });
          if (existing) {
            billingEntityIdMap.set(be.id, existing.id);
            continue;
          }
          const newSiteId = be.siteId ? siteIdMap.get(be.siteId) ?? null : null;
          const newBe = await tx.billingEntity.create({
            data: {
              tenantId,
              name: be.name,
              code: be.code,
              type: be.type,
              description: be.description ?? null,
              isActive: be.isActive ?? true,
              delegationId: be.delegationId ?? null, // same-tenant assumption
              siteId: newSiteId,
            },
          });
          billingEntityIdMap.set(be.id, newBe.id);
        }
        totalCounts.billingEntities = billingEntityIdMap.size;
      }

      // 6. Expense — depends on BillingEntity (bearer) + Contact (vendor) +
      // delegation + site + asset.
      if (dataFiles['expenses']?.length) {
        for (const exp of dataFiles['expenses']) {
          const newBearerId = billingEntityIdMap.get(exp.bearerId);
          if (!newBearerId) {
            this.logger.warn(`Skipping expense ${exp.id}: bearer ${exp.bearerId} not in billingEntityIdMap`);
            continue;
          }
          const newSiteId   = exp.siteId   ? siteIdMap.get(exp.siteId)     ?? null : null;
          const newAssetId  = exp.assetId  ? assetIdMap.get(exp.assetId)   ?? null : null;
          const newVendorId = exp.vendorId ? contactIdMap.get(exp.vendorId) ?? null : null;
          const newExp = await tx.expense.create({
            data: {
              tenantId,
              label: exp.label,
              description: exp.description ?? null,
              type: exp.type || 'OTHER',
              totalAmount: exp.totalAmount,
              currency: exp.currency || 'EUR',
              frequency: exp.frequency || 'ONE_TIME',
              dateIncurred: new Date(exp.dateIncurred),
              dateStart: exp.dateStart ? new Date(exp.dateStart) : null,
              dateEnd:   exp.dateEnd   ? new Date(exp.dateEnd)   : null,
              bearerId: newBearerId,
              delegationId: exp.delegationId, // required FK, same-tenant assumption
              siteId: newSiteId,
              assetId: newAssetId,
              externalRef: exp.externalRef ?? null,
              vendorId: newVendorId,
              invoiceRef: exp.invoiceRef ?? null,
              poNumber: exp.poNumber ?? null,
              notes: exp.notes ?? null,
              createdBy: userId || exp.createdBy,
            },
          });
          expenseIdMap.set(exp.id, newExp.id);
        }
        totalCounts.expenses = expenseIdMap.size;
      }

      // 7. CostAllocation — depends on Expense + target BillingEntity.
      if (dataFiles['cost-allocations']?.length) {
        let count = 0;
        for (const alloc of dataFiles['cost-allocations']) {
          const newExpenseId = expenseIdMap.get(alloc.expenseId);
          const newTargetId  = billingEntityIdMap.get(alloc.targetId);
          if (!newExpenseId || !newTargetId) continue;
          await tx.costAllocation.create({
            data: {
              expenseId: newExpenseId,
              targetId:  newTargetId,
              percentage: alloc.percentage,
              amount: alloc.amount,
              notes: alloc.notes ?? null,
            },
          });
          count++;
        }
        totalCounts.costAllocations = count;
      }

      // 8. ConnectivityLink — depends on site + asset + expense.
      if (dataFiles['connectivity-links']?.length) {
        let count = 0;
        for (const link of dataFiles['connectivity-links']) {
          const newSiteId = siteIdMap.get(link.siteId);
          if (!newSiteId) continue;
          const newAssetId   = link.assetId   ? assetIdMap.get(link.assetId)     ?? null : null;
          const newExpenseId = link.expenseId ? expenseIdMap.get(link.expenseId) ?? null : null;
          await tx.connectivityLink.create({
            data: {
              tenantId,
              siteId: newSiteId,
              role: link.role || 'PRIMARY',
              provider: link.provider,
              type: link.type,
              bandwidthDown: link.bandwidthDown ?? null,
              bandwidthUp: link.bandwidthUp ?? null,
              publicIp: link.publicIp ?? null,
              monthlyPrice: link.monthlyPrice ?? null,
              currency: link.currency || 'EUR',
              startDate: link.startDate ? new Date(link.startDate) : null,
              endDate:   link.endDate   ? new Date(link.endDate)   : null,
              contractRef: link.contractRef ?? null,
              notes: link.notes ?? null,
              assetId: newAssetId,
              expenseId: newExpenseId,
            },
          });
          count++;
        }
        totalCounts.connectivityLinks = count;
      }

      // 9. Budget — 2-pass to handle parent/child hierarchy. Pass 1 inserts
      // roots (parentId null). Pass 2+ iterates until every child whose
      // parent is in the map has been created (handles arbitrary depth).
      if (dataFiles['budgets']?.length) {
        const restoreBudget = async (b: any) => {
          const newSiteId = b.siteId ? siteIdMap.get(b.siteId) ?? null : null;
          const newBeId   = b.billingEntityId ? billingEntityIdMap.get(b.billingEntityId) ?? null : null;
          const newParent = b.parentId ? budgetIdMap.get(b.parentId) ?? null : null;
          const created = await tx.budget.create({
            data: {
              tenantId,
              label: b.label,
              delegationId: b.delegationId ?? null,
              siteId: newSiteId,
              billingEntityId: newBeId,
              expenseType: b.expenseType ?? null,
              period: b.period || 'YEAR',
              startDate: new Date(b.startDate),
              endDate: new Date(b.endDate),
              amount: b.amount,
              currency: b.currency || 'EUR',
              notes: b.notes ?? null,
              alertsEnabled: b.alertsEnabled ?? true,
              alertThresholdPct: b.alertThresholdPct ?? 80,
              parentId: newParent,
            },
          });
          budgetIdMap.set(b.id, created.id);
        };

        // Pass 1: roots
        for (const b of dataFiles['budgets'].filter((x: any) => !x.parentId)) {
          await restoreBudget(b);
        }
        // Pass 2+: children (iterate while progress is made — covers nested depth)
        let pending: any[] = dataFiles['budgets'].filter((x: any) => x.parentId);
        let progressed = true;
        while (pending.length > 0 && progressed) {
          progressed = false;
          const stillPending: any[] = [];
          for (const b of pending) {
            if (budgetIdMap.has(b.parentId)) {
              await restoreBudget(b);
              progressed = true;
            } else {
              stillPending.push(b);
            }
          }
          pending = stillPending;
        }
        if (pending.length > 0) {
          this.logger.warn(`${pending.length} budgets could not be linked to parent — orphaned references skipped`);
        }
        totalCounts.budgets = budgetIdMap.size;
      }

      // Attachments (all, re-mapped)
      if (dataFiles['attachments']?.length) {
        for (const att of dataFiles['attachments']) {
          const newAssetId = att.assetId ? assetIdMap.get(att.assetId) : null;
          const newTaskId = att.taskId ? taskIdMap.get(att.taskId) : null;
          const newRackId = att.rackId ? rackIdMap.get(att.rackId) : null;
          const newSiteId = att.siteId ? siteIdMap.get(att.siteId) : null;

          if (!newAssetId && !newTaskId && !newRackId && !newSiteId) continue;

          const entityType = newAssetId ? 'assets' : newTaskId ? 'tasks' : newRackId ? 'racks' : 'sites';
          const entityId = newAssetId || newTaskId || newRackId || newSiteId;
          const newPath = `attachments/${tenantId}/${entityType}/${entityId}/${att.filename}`;
          attachmentPathMap.set(att.filename, newPath);

          await tx.attachment.create({
            data: {
              tenantId,
              assetId: newAssetId || undefined,
              taskId: newTaskId || undefined,
              rackId: newRackId || undefined,
              siteId: newSiteId || undefined,
              filename: att.filename, originalFilename: att.originalFilename,
              size: att.size, mimetype: att.mimetype, path: newPath,
              description: att.description, category: att.category,
              uploadedBy: att.uploadedBy || userId || 'restore',
            },
          });
        }
        totalCounts.attachments = dataFiles['attachments'].length;
      }

      return { attachmentPathMap };
    }, { timeout: 120000 });

    // Upload files to MinIO
    let restoredFiles = 0;
    for (const fileEntry of fileEntries) {
      try {
        const parts = fileEntry.entryName.split('/files/');
        if (parts.length >= 2) {
          const relativePath = parts[1];

          if (relativePath.startsWith('plans/raw/')) {
            const fname = relativePath.substring('plans/raw/'.length);
            await this.storageService.uploadFile(
              { buffer: fileEntry.data, originalname: fname, mimetype: 'application/octet-stream', size: fileEntry.data.length } as Express.Multer.File,
              'floor-plans', fname,
            );
            restoredFiles++;
          } else if (relativePath.startsWith('attachments/')) {
            const attFilename = relativePath.split('/').pop() || '';
            const newPath = result.attachmentPathMap.get(attFilename);
            if (newPath) {
              const pathParts = newPath.split('/');
              const folder = pathParts.slice(0, -1).join('/');
              const fname = pathParts[pathParts.length - 1];
              await this.storageService.uploadFile(
                { buffer: fileEntry.data, originalname: fname, mimetype: 'application/octet-stream', size: fileEntry.data.length } as Express.Multer.File,
                folder, fname,
              );
              restoredFiles++;
            }
          }
        }
      } catch (err: unknown) {
        this.logger.warn(`Could not restore file ${fileEntry.entryName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    this.logger.log(`Full restore completed: ${siteIds.length} sites, ${restoredFiles} files`);
    await this.logBackupAction(tenantId, userId, 'RESTORE_FULL', { counts: totalCounts, siteIds });

    return {
      message: `Restauration complète : ${siteIds.length} site(s) restauré(s)`,
      counts: totalCounts,
      siteIds,
    };
  }

  // ==========================================================================
  // BACKUP MANAGEMENT
  // ==========================================================================

  async listBackups(tenantId: string): Promise<BackupListItem[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        action: { in: ['BACKUP_FULL', 'BACKUP_SITE'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return logs.map((log) => {
      const changes = log.changes as Record<string, any> || {};
      return {
        id: log.id,
        filename: changes.filename || 'unknown',
        type: log.action === 'BACKUP_FULL' ? 'full' as const : 'site' as const,
        siteCode: changes.siteCode,
        size: changes.size || 0,
        createdAt: log.timestamp.toISOString(),
      };
    });
  }

  async downloadBackup(
    tenantId: string,
    backupId: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const log = await this.prisma.auditLog.findFirst({
      where: { id: backupId, tenantId, action: { in: ['BACKUP_FULL', 'BACKUP_SITE'] } },
    });
    if (!log) throw new NotFoundException('Backup not found');

    const changes = log.changes as Record<string, any> || {};
    const filename = changes.filename;
    if (!filename) throw new NotFoundException('Backup file reference not found');

    try {
      const buffer = await this.downloadFromStorage(`${this.BACKUP_BUCKET}/${filename}`);
      return { buffer, filename, contentType: 'application/zip' };
    } catch {
      throw new NotFoundException(`Backup file not found in storage: ${filename}`);
    }
  }

  async deleteBackup(tenantId: string, backupId: string): Promise<{ message: string }> {
    const log = await this.prisma.auditLog.findFirst({
      where: { id: backupId, tenantId, action: { in: ['BACKUP_FULL', 'BACKUP_SITE'] } },
    });
    if (!log) throw new NotFoundException('Backup not found');

    const changes = log.changes as Record<string, any> || {};
    if (changes.filename) {
      try {
        await this.deleteFromBackupBucket(changes.filename);
      } catch (err: unknown) {
        this.logger.warn(`Could not delete backup file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Delete the audit log entry so the backup disappears from the list
    try {
      await this.prisma.auditLog.delete({ where: { id: backupId } });
    } catch (err: unknown) {
      this.logger.warn(`Could not delete audit log entry: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return { message: 'Backup supprimé' };
  }

  // ==========================================================================
  // SCHEDULED BACKUP
  // ==========================================================================

  @Cron('0 2 * * *')
  async scheduledBackup() {
    if (this.configService.get('AUTO_BACKUP', 'false') !== 'true') return;

    this.logger.log('Starting scheduled backup...');
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });
      for (const tenant of tenants) {
        try {
          await this.createFullBackup(tenant.id, 'system');
          this.logger.log(`Scheduled backup completed for tenant: ${tenant.name}`);
        } catch (err: unknown) {
          this.logger.error(`Scheduled backup failed for tenant ${tenant.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      await this.cleanupOldBackups();
    } catch (err: unknown) {
      this.logger.error(`Scheduled backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // TRACK D.1 — PRE-FLIGHT (estimate + disk space)
  // ==========================================================================

  /**
   * Pre-flight size estimate for a backup run.
   *
   * DB bytes : full `exportAllTenantData()` + JSON.stringify each table.
   * Accurate but loads everything in memory ; acceptable for the estimate
   * use-case (one-shot, called interactively before deciding to launch).
   *
   * Files bytes : stream `listObjectsV2` on the storage bucket, sum
   * `obj.size`. Metadata-only listing — fast even on multi-GB buckets.
   *
   * Disk space : delegates to {@link checkDiskSpace}.
   *
   * Track D.1 Phase 1 step 1. See scope MCP `XCH_TRACK_D1_BACKUP_V2_2026_05_10`.
   */
  async estimateBackupSize(
    tenantId: string,
    opts: BackupOptionsDto = {},
  ): Promise<{
    dataBytes: number;
    filesBytes: number;
    totalBytes: number;
    fileCount: number;
    freeBytes: number;
    ok: boolean;
  }> {
    const data = await this.exportAllTenantData(tenantId);
    let dataBytes = 0;
    for (const [, records] of Object.entries(data)) {
      dataBytes += Buffer.byteLength(JSON.stringify(records));
    }

    let filesBytes = 0;
    let fileCount = 0;
    if (!opts.dbOnly) {
      const bucket = this.configService.get<string>('MINIO_BUCKET', 'xch-storage') ?? 'xch-storage';
      const objects = await this.listAllObjectsInBucket(bucket);
      for (const obj of objects) filesBytes += obj.size;
      fileCount = objects.length;
    }

    const totalBytes = dataBytes + filesBytes;
    const disk = await this.checkDiskSpace(totalBytes);

    return {
      dataBytes,
      filesBytes,
      totalBytes,
      fileCount,
      freeBytes: disk.freeBytes,
      ok: disk.ok,
    };
  }

  /**
   * Free-space pre-flight on the worker tmpfs ({@link os.tmpdir}).
   *
   * Required = `estimatedBytes × 1.2 + 512 MB` :
   *  - 20 % buffer absorbs archiver overhead (zip headers, JSON
   *    pretty-print padding) plus uncertainty on the DB sampling estimate.
   *  - 512 MB margin keeps headroom for concurrent Prisma working files.
   *
   * Returns the result rather than throwing : caller decides (estimate
   * endpoint surfaces `ok: false`, job startup throws
   * `InsufficientStorageException`).
   *
   * Track D.1 Phase 1 step 1.
   */
  async checkDiskSpace(estimatedBytes: number): Promise<{
    freeBytes: number;
    requiredBytes: number;
    ok: boolean;
  }> {
    const safetyMargin = 512 * 1024 * 1024;
    const requiredBytes = Math.ceil(estimatedBytes * 1.2) + safetyMargin;

    const stat = await fs.statfs(os.tmpdir());
    const freeBytes = stat.bavail * stat.bsize;

    return {
      freeBytes,
      requiredBytes,
      ok: freeBytes >= requiredBytes,
    };
  }

  /**
   * Stream `listObjectsV2` on a bucket, returning the full list of objects
   * with their names and sizes.
   *
   * Used by {@link estimateBackupSize} (aggregates sizes) and by
   * {@link streamBucketIntoArchive} (iterates to fetch each object).
   * Recursive (prefix='', recursive=true) — walks the whole bucket.
   * Metadata-only, no payload transfer, so it stays in seconds even on
   * multi-GB buckets.
   *
   * Track D.1 Phase 1 step 1 (refactored in step 2 to return the full list).
   */
  private listAllObjectsInBucket(bucket: string): Promise<Array<{ name: string; size: number }>> {
    const client = this.getMinioClient();
    return new Promise((resolve, reject) => {
      const items: Array<{ name: string; size: number }> = [];
      const stream = client.listObjectsV2(bucket, '', true);
      stream.on('data', (obj: { name: string; size?: number }) => {
        items.push({ name: obj.name, size: obj.size ?? 0 });
      });
      stream.on('end', () => resolve(items));
      stream.on('error', (err: Error) => reject(err));
    });
  }

  // ==========================================================================
  // TRACK D.1 — STREAMING EXPORT V2
  // ==========================================================================

  /**
   * Stream every object of a MinIO bucket into the archive, populating
   * `fileMap` with per-file SHA-256 hashes computed mid-stream via
   * {@link HashingStream}.
   *
   * Entry naming convention : `minio/<bucket>/<key>` (mirror the bucket
   * structure 1:1 in the archive). Restore Phase 1 step 3 routes entries
   * back to `minio.putObject(bucket, key, ...)` based on this prefix.
   *
   * Processing is sequential (one object at a time, awaiting `end` between
   * iterations) — keeps memory footprint bounded and lets archiver back-
   * pressure naturally. Parallelism optimization is a future iteration if
   * benchmark prod shows a bottleneck.
   *
   * Track D.1 Phase 1 step 2. Primitive consumed by buildArchiveV2ToTmp.
   */
  private async streamBucketIntoArchive(
    archive: archiver.Archiver,
    bucket: string,
    fileMap: Record<string, BackupFileEntryV2>,
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const objects = await this.listAllObjectsInBucket(bucket);
    const total = objects.length;
    const client = this.getMinioClient();

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      onProgress?.('archive', i, total, `Streaming ${bucket}/${obj.name}`);

      // Fetch the object as a stream. minio's getObject takes a Node-style
      // callback that yields a Readable.
      const sourceStream = await new Promise<Readable>((resolve, reject) => {
        client.getObject(bucket, obj.name, (err: Error | null, s: Readable) => {
          if (err) return reject(err);
          resolve(s);
        });
      });

      // Tee through HashingStream: archive consumes the transformed stream,
      // hash + byte count are populated as chunks flow through.
      const hashing = new HashingStream();
      sourceStream.on('error', (err) => hashing.destroy(err));
      sourceStream.pipe(hashing);

      const entryName = `minio/${bucket}/${obj.name}`;
      archive.append(hashing, { name: entryName });

      // Wait until archive has consumed every chunk of this entry.
      // hashing emits 'end' on its readable side once the consumer (archive)
      // has drained it — by which point _transform has been called for
      // every chunk and the hash internal state is final.
      await once(hashing, 'end');

      fileMap[entryName] = {
        size: hashing.bytesProcessed,
        sha256: hashing.digest(),
        bucket,
        key: obj.name,
      };
    }

    onProgress?.('archive', total, total, `Done streaming ${bucket} (${total} files)`);
  }

  /**
   * Orchestrate the archiver pipeline → tmp file on disk. Zero
   * `Buffer.concat` — the entire archive is streamed via
   * `pipeline(archive, writeStream)` of `node:stream/promises`, which
   * also propagates back-pressure and errors correctly.
   *
   * Order of append (matters for the restore parser, see Phase 1 step 3
   * router with `metadataPending: true` flag) :
   *   1. data/<table>.json (small, in-memory)
   *   2. minio/<bucket>/<key> (large, streamed, fills metadata.files map)
   *   3. metadata.json LAST (so files map is fully populated with sha256)
   *
   * Also computes a sha256 over the final archive bytes for catalog
   * integrity — surfaces in BACKUP_FULL_V2 audit log.
   *
   * **Determinism caveat (do not change without understanding):**
   * archiver produces byte-identical output for byte-identical input
   * ONLY because we do NOT call `archive.append(..., { date: ... })`
   * on any entry. Setting `date` (entry mtime) makes the ZIP local file
   * headers carry that timestamp, breaking the sha256 determinism the
   * `buildArchiveV2ToTmp` deterministic-input test asserts. If a future
   * change needs per-entry mtime (e.g. for restore preserving original
   * file timestamps), the determinism test must be updated AND the
   * archive-level sha256 must NO LONGER be used as a stable integrity
   * key in BACKUP_FULL_V2 audit metadata. Per-file sha256 in
   * metadata.files{} stays valid regardless. Cf MCP
   * `XCH_TRACK_D1_BACKUP_V2_2026_05_10` decisions log.
   *
   * Track D.1 Phase 1 step 2.
   */
  private async buildArchiveV2ToTmp(args: {
    tmpPath: string;
    data: Record<string, any[]>;
    buckets: string[];
    metadata: BackupMetadataV2;
    onProgress?: ProgressCallback;
  }): Promise<{ size: number; sha256: string }> {
    const { tmpPath, data, buckets, metadata, onProgress } = args;

    const archive = archiver('zip', { zlib: { level: 9 } });
    const writeStream = createWriteStream(tmpPath);

    // Tee the archive output through a hash for end-to-end integrity.
    const archiveHasher = createHash('sha256');
    archive.on('data', (chunk: Buffer) => archiveHasher.update(chunk));

    archive.on('warning', (err: { message: string; code?: string }) => {
      this.logger.warn(`Archiver warning: ${err.message}`);
    });

    // Start the pipeline FIRST so archive can be drained as we append.
    // pipeline() awaits archive 'end' + writeStream 'finish' + cleans up
    // on error (closes writeStream, propagates the rejection).
    const pipelinePromise = pipeline(archive, writeStream);

    // 1. Append data/*.json (small JSON payloads, in-memory)
    for (const [table, records] of Object.entries(data)) {
      archive.append(JSON.stringify(records, null, 2), { name: `data/${table}.json` });
    }

    // 2. Stream each bucket — populates metadata.files with sha256 per entry
    for (const bucket of buckets) {
      await this.streamBucketIntoArchive(archive, bucket, metadata.files, onProgress);
    }

    // 3. Append metadata.json LAST — files map is now fully populated.
    // Restore router buffers data/* until metadata.json arrives (Phase 1 step 3).
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Finalize tells archive no more entries are coming. pipeline then
    // waits for writeStream to flush + close.
    await archive.finalize();
    await pipelinePromise;

    const stat = await fs.stat(tmpPath);
    return {
      size: stat.size,
      sha256: archiveHasher.digest('hex'),
    };
  }

  /**
   * Upload a tmp ZIP file to the `xch-backups` bucket via MinIO's native
   * `fPutObject` — streams from the file path directly, never loads the
   * archive in memory (in contrast with the v1 path which called
   * `putObject(bucket, name, buffer, length)`).
   *
   * Creates the backup bucket on the fly if it doesn't exist.
   *
   * Track D.1 Phase 1 step 2.
   */
  private async uploadTmpToBackupBucket(tmpPath: string, filename: string): Promise<void> {
    const client = this.getMinioClient();

    // Ensure bucket exists (idempotent).
    try {
      const exists = await client.bucketExists(this.BACKUP_BUCKET);
      if (!exists) {
        await client.makeBucket(this.BACKUP_BUCKET, 'us-east-1');
        this.logger.log(`Created backup bucket: ${this.BACKUP_BUCKET}`);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Could not verify backup bucket: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }

    // fPutObject = native streaming upload from file path.
    // No buffer materialization on this side of the wire.
    await client.fPutObject(this.BACKUP_BUCKET, filename, tmpPath, {
      'Content-Type': 'application/zip',
    });

    const stat = await fs.stat(tmpPath);
    this.logger.log(
      `Backup uploaded (streaming v2) to ${this.BACKUP_BUCKET}/${filename} (${stat.size} bytes)`,
    );
  }

  /**
   * Streaming full backup v2 (Track D.1) — public orchestrator.
   *
   * Pipeline:
   *   exportAllTenantData(tenantId) ─┐
   *                                  ▼
   *   ┌── data/*.json ──┐
   *   │                 ▼
   *   │   archive ──pipeline──▶ fs.createWriteStream(tmpPath)
   *   │                 ▲
   *   └── minio/* ──HashingStream──┘  (fills metadata.files w/ sha256)
   *                 │
   *                 └── metadata.json LAST (files map populated)
   *
   *   fs.stat(tmpPath) → size + archive-level sha256
   *   minio.fPutObject(xch-backups, filename, tmpPath) → streaming upload
   *   fs.rm(tmpPath, force: true) in finally → always cleaned up
   *
   * V1 path (createFullBackup) remains untouched — coexistence v1/v2
   * during Phase 1 implementation (cf decisions in MCP
   * `XCH_TRACK_D1_BACKUP_V2_2026_05_10`).
   *
   * Track D.1 Phase 1 step 2.
   */
  async createFullBackupV2(
    tenantId: string,
    userId?: string,
    opts: BackupOptionsDto = {},
    onProgress?: ProgressCallback,
  ): Promise<{
    message: string;
    filename: string;
    size: number;
    sha256: string;
  }> {
    this.logger.log(
      `Starting full backup v2 for tenant ${tenantId} (dbOnly=${opts.dbOnly ?? false})`,
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `full-backup-v2-${timestamp}.zip`;
    const tmpId = randomBytes(4).toString('hex');
    const tmpPath = path.join(os.tmpdir(), `xch-backup-${timestamp}-${tmpId}.zip`);

    try {
      // 1. Collect tenant data (DB).
      onProgress?.('collect', 0, 1, 'Exporting tenant data…');
      const data = await this.exportAllTenantData(tenantId);

      // 2. Decide which buckets to walk (dbOnly skips MinIO entirely).
      const buckets = opts.dbOnly
        ? []
        : [this.configService.get<string>('MINIO_BUCKET', 'xch-storage') ?? 'xch-storage'];

      // 3. Build metadata skeleton — files{} populated by streamBucketIntoArchive.
      const metadata: BackupMetadataV2 = {
        version: 2,
        createdAt: new Date().toISOString(),
        tenantId,
        type: opts.dbOnly ? 'db-only' : 'full',
        siteId: null,
        siteCode: null,
        appVersion: this.configService.get<string>('APP_VERSION', '2.2.0') ?? '2.2.0',
        buckets,
        counts: this.countRecords(data),
        files: {},
      };

      // 4. Pipeline archive → tmp file.
      onProgress?.('archive', 0, 1, 'Building archive…');
      const archiveResult = await this.buildArchiveV2ToTmp({
        tmpPath,
        data,
        buckets,
        metadata,
        onProgress,
      });

      // 5. Stream tmp → xch-backups bucket via fPutObject.
      onProgress?.('upload', 0, 1, 'Uploading to xch-backups…');
      await this.uploadTmpToBackupBucket(tmpPath, filename);

      // 6. Audit log row (visible in BACKUP_FULL_V2 catalog).
      await this.logBackupAction(tenantId, userId, 'BACKUP_FULL_V2', {
        filename,
        size: archiveResult.size,
        sha256: archiveResult.sha256,
      });

      onProgress?.('done', 1, 1, 'Backup complete');
      this.logger.log(
        `Full backup v2 completed: ${filename} ` +
          `(${archiveResult.size} bytes, sha256=${archiveResult.sha256.slice(0, 12)}…, ` +
          `files=${Object.keys(metadata.files).length})`,
      );

      return {
        message: 'Backup complet créé avec succès (v2 streaming)',
        filename,
        size: archiveResult.size,
        sha256: archiveResult.sha256,
      };
    } finally {
      // Always clean up the tmp file, even on exception path.
      // force:true silences ENOENT (file never created on early failure).
      await fs.rm(tmpPath, { force: true }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to clean up tmp backup file ${tmpPath}: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    }
  }

  // ==========================================================================
  // TRACK D.1 — STREAMING RESTORE V2
  // ==========================================================================

  /**
   * Stream the contents of the xch-backups bucket down to a local tmp
   * file via MinIO's native `fGetObject` (streaming download). Mirror of
   * {@link uploadTmpToBackupBucket}.
   *
   * Track D.1 Phase 1 step 3.
   */
  private async downloadFromBackupBucket(filename: string, tmpPath: string): Promise<void> {
    const client = this.getMinioClient();
    await client.fGetObject(this.BACKUP_BUCKET, filename, tmpPath);
    const stat = await fs.stat(tmpPath);
    this.logger.log(
      `Backup downloaded (streaming v2) from ${this.BACKUP_BUCKET}/${filename} ` +
        `(${stat.size} bytes)`,
    );
  }

  /**
   * Apply parsed data files to the database.
   *
   * **STEP 3 STUB** — not implemented for non-dry-run. The full implementation
   * lands in Phase 1 step 4 alongside `upsertByNaturalKey`, per-table natural
   * key strategy, and the 5-phase split `$transaction` design (cf MCP
   * `XCH_TRACK_D1_BACKUP_V2_2026_05_10`).
   *
   * Rationale for not shipping a naive `createMany` here in step 3 : a naive
   * loop on a populated tenant would either fail on FK ordering or create
   * duplicates on every re-run, which is exactly what step 4's idempotence
   * refactor exists to fix. Shipping a naive intermediate would be a
   * regression footgun. Step 3 ships streaming + verification + dry-run
   * preview, which IS useful in isolation (operators can inspect the diff
   * before committing). Real restore is blocked until step 4.
   *
   * Step 3 callers should ALWAYS use `opts.dryRun: true`. The orchestrator
   * raises a clear error if the caller forgets.
   *
   * Track D.1 Phase 1 step 3 (stub) / step 4 (full).
   */
  private async applyDataFilesToDb(
    _tenantId: string,
    _dataFiles: Record<string, unknown[]>,
    _stagedFiles: Map<string, { tmpPath: string; sha256: string; size: number; bucket: string; key: string }>,
    _userId?: string,
  ): Promise<{ counts: Record<string, number>; siteIds: string[] }> {
    throw new BadRequestException(
      'Track D.1 Phase 1 step 3 ships streaming restore + dry-run preview only. ' +
        'Real restore (DB writes + MinIO uploads) lands in step 4 with per-table ' +
        'idempotence via upsertByNaturalKey. Re-issue this request with `dryRun: true` ' +
        'to inspect the projected diff; meanwhile use the legacy ' +
        '`POST /backup/full/restore` (multipart upload) for the destructive path.',
    );
  }

  /**
   * Streaming full restore v2 (Track D.1) — public orchestrator.
   *
   * Pipeline:
   *   1. Resolve `backupId` → filename via AuditLog catalog row.
   *   2. `downloadFromBackupBucket(filename, tmpPath)` (streaming fGetObject).
   *   3. Stream-process the tmp ZIP via :
   *        `createReadStream(tmpPath) ─▶ MagicByteValidator ─▶ unzipper.Parse()`
   *        for await (entry) :
   *          - `metadata.json`             → buffer + JSON.parse → v2Metadata
   *          - `<v1Prefix>/metadata.json`  → buffer + remember v1MetadataRaw
   *          - `data/<table>.json`         → buffer + JSON.parse → dataFiles[table]
   *          - `minio/<bucket>/<key>`      → stage to tmp dir via HashingStream,
   *                                          record {tmpPath, sha256, size}
   *          - <v1Prefix>/*                → autodrain (delegation will reread)
   *          - else                        → autodrain (unknown entry)
   *   4. Validate metadata (4 checks figés plan) :
   *        a. v1MetadataRaw present (and no v2) → delegate to legacy restoreFullBackup
   *           via `fs.readFile(tmpPath)` buffer (v1 path uses AdmZip).
   *        b. typeof v2Metadata.version === 'string' → delegate same way.
   *        c. v2Metadata missing → BadRequestException('metadata.json missing or corrupted')
   *        d. v2Metadata.version not number 2 → BadRequestException('Unsupported version: X')
   *   5. Verify per-file sha256 against metadata.files[entryPath].sha256.
   *      Mismatches → invalidChecksums[] ; declared-but-absent → missingFiles[].
   *   6. opts.dryRun === true → return DryRunReportResponseDto with would{Create,Update,Skip}
   *      computed from dataFiles + the integrity diff. NO writes.
   *   7. opts.dryRun !== true && integrity errors → BadRequestException('integrity check failed').
   *   8. opts.dryRun !== true && integrity ok → delegate to applyDataFilesToDb (step 4 stub
   *      currently throws BadRequestException with a hint).
   *
   * V1 backward compat is best-effort delegation : we re-read the tmp file as a
   * Buffer and call the existing v1 `restoreFullBackup(tenantId, buffer, userId)`,
   * which has its own AdmZip parsing + DB logic. v1 archives are small enough to
   * fit in RAM (the whole reason Track D.1 exists is that v1 was RAM-bounded).
   *
   * Track D.1 Phase 1 step 3.
   */
  async restoreFullBackupV2(
    tenantId: string,
    backupId: string,
    opts: RestoreOptionsDto = {},
    onProgress?: ProgressCallback,
    userId?: string,
  ): Promise<RestoreFullV2Result> {
    this.logger.log(
      `Starting full restore v2 for tenant ${tenantId} from backup ${backupId} ` +
        `(dryRun=${opts.dryRun ?? false})`,
    );

    // 1. Resolve backupId → filename from AuditLog catalog.
    // AuditLog row stores {filename, size, ...} under the `changes` JsonValue
    // column (cf createFullBackup audit pattern at logBackupAction site).
    const log = await this.prisma.auditLog.findUnique({ where: { id: backupId } });
    if (!log) {
      throw new NotFoundException(`Backup ${backupId} not found in catalog`);
    }
    const changes = (log.changes as { filename?: string } | null) ?? {};
    const filename = changes.filename;
    if (!filename || typeof filename !== 'string') {
      throw new BadRequestException(
        `Backup catalog entry ${backupId} is missing the 'filename' field in changes`,
      );
    }

    // 2. Prepare tmp paths
    const stagingId = randomBytes(4).toString('hex');
    const tmpZipPath = path.join(os.tmpdir(), `xch-restore-${stagingId}.zip`);
    const stagingDir = path.join(os.tmpdir(), `xch-restore-stage-${stagingId}`);
    await fs.mkdir(stagingDir, { recursive: true });

    try {
      // 3. Download to tmp file (streaming)
      onProgress?.('download', 0, 1, `Downloading backup ${filename}`);
      await this.downloadFromBackupBucket(filename, tmpZipPath);

      // 4. Stream-process : magic byte → unzipper → router
      onProgress?.('extract', 0, 1, 'Parsing archive…');
      const fileStream = createReadStream(tmpZipPath);
      const validator = new MagicByteValidator();
      const zipStream = unzipper.Parse({ forceStream: true });
      fileStream.pipe(validator).pipe(zipStream);
      // Node `.pipe()` chains do NOT propagate errors automatically. Without
      // explicit forwarding, an error emitted by `validator` (e.g. magic-byte
      // mismatch via `callback(new BadRequestException(...))`) is never seen
      // by `zipStream`, and the `for await` consumer hangs forever. The
      // forwarding below destroys `zipStream` with the upstream error, which
      // makes the for-await loop reject with that error and lets the outer
      // catch turn it back into a clean BadRequestException.
      fileStream.on('error', (err) => validator.destroy(err));
      validator.on('error', (err) => zipStream.destroy(err));

      const dataFiles: Record<string, unknown[]> = {};
      const stagedFiles = new Map<
        string,
        { tmpPath: string; sha256: string; size: number; bucket: string; key: string }
      >();
      let v2Metadata: BackupMetadataV2 | undefined;
      let v1MetadataRaw: Buffer | undefined;
      let v1Prefix: string | undefined;
      const parseErrors: string[] = [];

      try {
        // unzipper.Parse exposes the entry stream as an async iterable when
        // `forceStream: true`. Each entry is a Readable + has .path / .type /
        // .vars / .buffer() / .autodrain().
        for await (const entry of zipStream as AsyncIterable<unzipper.Entry>) {
          const entryPath = entry.path;

          // V2 top-level metadata
          if (entryPath === 'metadata.json') {
            const raw = await entry.buffer();
            try {
              v2Metadata = JSON.parse(raw.toString('utf8')) as BackupMetadataV2;
            } catch {
              parseErrors.push('metadata.json');
            }
            continue;
          }

          // V1 prefix metadata — capture for potential delegation
          const v1Match = entryPath.match(/^(full-backup-[^/]+|site-[^/]+)\/metadata\.json$/);
          if (v1Match) {
            v1MetadataRaw = await entry.buffer();
            v1Prefix = v1Match[1];
            continue;
          }

          // V2 data table
          if (entryPath.startsWith('data/') && entryPath.endsWith('.json')) {
            const table = entryPath.slice('data/'.length, -'.json'.length);
            const raw = await entry.buffer();
            try {
              dataFiles[table] = JSON.parse(raw.toString('utf8')) as unknown[];
            } catch {
              parseErrors.push(entryPath);
            }
            continue;
          }

          // V2 minio file — stage to disk with hash mid-stream
          if (entryPath.startsWith('minio/')) {
            // Layout: minio/<bucket>/<key…> — bucket is first segment after 'minio/'
            const rest = entryPath.slice('minio/'.length);
            const slash = rest.indexOf('/');
            if (slash < 0) {
              entry.autodrain();
              parseErrors.push(`malformed minio entry name: ${entryPath}`);
              continue;
            }
            const bucket = rest.slice(0, slash);
            const key = rest.slice(slash + 1);

            const stagedPath = path.join(stagingDir, randomBytes(8).toString('hex'));
            const hashing = new HashingStream();
            const writeStream = createWriteStream(stagedPath);
            await pipeline(entry, hashing, writeStream);

            stagedFiles.set(entryPath, {
              tmpPath: stagedPath,
              sha256: hashing.digest(),
              size: hashing.bytesProcessed,
              bucket,
              key,
            });
            continue;
          }

          // V1 prefix data/file entries — autodrain (delegation will re-read tmp)
          if (v1Prefix && entryPath.startsWith(`${v1Prefix}/`)) {
            entry.autodrain();
            continue;
          }

          // Unknown — autodrain to avoid stream stall
          entry.autodrain();
        }
      } catch (err: unknown) {
        // Propagate BadRequestException from MagicByteValidator unchanged.
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(
          `Failed to parse backup archive: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // 5. Validation cascade — 4 checks (figés plan)

      // (a) V1 archive : delegate to legacy AdmZip path.
      // Two ways an archive is recognized as v1 :
      //   - it has a `<v1-prefix>/metadata.json` entry and NO top-level metadata.json
      //   - it has a top-level metadata.json but its `version` is a string (e.g. '1.0')
      const looksV1ByPrefix = !!v1MetadataRaw && !v2Metadata;
      const looksV1ByVersion = !!v2Metadata && typeof v2Metadata.version === 'string';
      if (looksV1ByPrefix || looksV1ByVersion) {
        this.logger.log(
          `Detected v1 backup (${looksV1ByPrefix ? 'prefix layout' : 'string version'}) ` +
            `— delegating to legacy restoreFullBackup`,
        );
        const buffer = await fs.readFile(tmpZipPath);
        const result = await this.restoreFullBackup(tenantId, buffer, userId);
        return { kind: 'delegated-v1', ...result };
      }

      // (b) Metadata absent or unparseable.
      if (!v2Metadata) {
        if (parseErrors.includes('metadata.json')) {
          throw new BadRequestException(
            'Backup metadata.json missing or corrupted: JSON parse failed',
          );
        }
        throw new BadRequestException(
          'Backup metadata.json missing or corrupted: entry not found in archive',
        );
      }

      // (c) Unsupported version.
      if (typeof v2Metadata.version !== 'number' || v2Metadata.version !== 2) {
        throw new BadRequestException(`Unsupported backup version: ${v2Metadata.version}`);
      }

      // (d) Per-file SHA-256 integrity vs metadata.files map.
      const invalidChecksums: string[] = [];
      const missingFiles: string[] = [];
      for (const [entryPath, expected] of Object.entries(v2Metadata.files)) {
        const staged = stagedFiles.get(entryPath);
        if (!staged) {
          missingFiles.push(entryPath);
          continue;
        }
        if (staged.sha256 !== expected.sha256) {
          invalidChecksums.push(entryPath);
        }
      }

      // 6. Dry-run path — return the projected diff, no writes.
      if (opts.dryRun) {
        onProgress?.('dry-run', 1, 1, 'Computing dry-run report…');
        const wouldCreate: Record<string, number> = {};
        const wouldUpdate: Record<string, number> = {};
        const wouldSkip: Record<string, number> = {};
        // Step 3 stub : without upsertByNaturalKey we cannot tell create from
        // update, so all rows are tagged 'wouldCreate'. Step 4 refines this
        // with real natural-key lookups against the live DB.
        for (const [table, records] of Object.entries(dataFiles)) {
          wouldCreate[table] = records.length;
        }

        const totalSize = Array.from(stagedFiles.values()).reduce((acc, f) => acc + f.size, 0);
        // Rough 50 MB/s throughput model — indicative, not an SLA.
        const estimatedDurationSec = Math.max(1, Math.ceil(totalSize / (50 * 1024 * 1024)));

        const report = toDryRunReportResponseDto({
          wouldCreate,
          wouldUpdate,
          wouldSkip,
          missingFiles,
          invalidChecksums,
          totalSize,
          estimatedDurationSec,
        });
        return { kind: 'dry-run', report };
      }

      // 7. Real run — refuse on integrity violation.
      if (invalidChecksums.length > 0 || missingFiles.length > 0) {
        throw new BadRequestException(
          `Backup integrity check failed: ` +
            `${invalidChecksums.length} sha256 mismatch(es), ` +
            `${missingFiles.length} declared file(s) missing from archive`,
        );
      }

      // 8. Real run — delegate to step 4 (currently a clear-error stub).
      onProgress?.('apply', 0, 1, 'Applying data to DB…');
      const applied = await this.applyDataFilesToDb(tenantId, dataFiles, stagedFiles, userId);
      onProgress?.('done', 1, 1, 'Restore complete');

      await this.logBackupAction(tenantId, userId, 'RESTORE_FULL_V2', {
        filename,
        counts: applied.counts,
      });

      return {
        kind: 'applied',
        message: 'Restore complet v2 appliqué avec succès',
        counts: applied.counts,
        siteIds: applied.siteIds,
      };
    } finally {
      // Always cleanup tmp zip + staging dir, even on exception path.
      await fs.rm(tmpZipPath, { force: true }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to clean up tmp restore zip ${tmpZipPath}: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
      await fs.rm(stagingDir, { recursive: true, force: true }).catch((err: unknown) => {
        this.logger.warn(
          `Failed to clean up staging dir ${stagingDir}: ` +
            `${err instanceof Error ? err.message : 'Unknown error'}`,
        );
      });
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS — DATA EXPORT
  // ==========================================================================

  private async exportAllTenantData(tenantId: string): Promise<Record<string, any[]>> {
    // Track C 2026-05-10 — B10 fix: extended with the 9 tables that were
    // silently excluded from the full backup (cost ecosystem + asset
    // movements + connectivity + photos + task comments + site health
    // snapshots). Without these, restoring a 240-expense / 18-budget
    // tenant would yield 0 expenses / 0 budgets and break the financial
    // module entirely. See round-trip test in Track C verification notes.
    const [
      sites, assets, racks, floorPlans, pins, tasks,
      contacts, contactTypes, users, attachments,
      // ----- Track C additions: previously missing tables -----
      photos, assetMovements, taskComments,
      connectivityLinks, siteHealthSnapshots,
      billingEntities, expenses, costAllocations, budgets,
    ] = await Promise.all([
      this.prisma.site.findMany({ where: { tenantId } }),
      this.prisma.asset.findMany({ where: { tenantId } }),
      this.prisma.rack.findMany({ where: { tenantId } }),
      this.prisma.floorPlan.findMany({ where: { site: { tenantId } } }),
      this.prisma.pin.findMany({ where: { floorPlan: { site: { tenantId } } } }),
      this.prisma.task.findMany({ where: { tenantId } }),
      this.prisma.contact.findMany({ where: { tenantId } }),
      this.prisma.contactType.findMany({ where: { tenantId } }),
      this.prisma.user.findMany({
        where: { tenantId },
        select: {
          id: true, email: true, name: true,
          active: true, phone: true, authProvider: true,
        },
      }),
      this.prisma.attachment.findMany({ where: { tenantId } }),
      // Photo is polymorphic (entityType + entityId, no tenantId column);
      // scope via the related entity owner.
      this.prisma.photo.findMany({
        where: {
          OR: [
            { site: { tenantId } },
            { asset: { tenantId } },
            { task: { tenantId } },
          ],
        },
      }),
      this.prisma.assetMovement.findMany({ where: { tenantId } }),
      this.prisma.taskComment.findMany({ where: { task: { tenantId } } }),
      this.prisma.connectivityLink.findMany({ where: { tenantId } }),
      this.prisma.siteHealthSnapshot.findMany({ where: { site: { tenantId } } }),
      this.prisma.billingEntity.findMany({ where: { tenantId } }),
      this.prisma.expense.findMany({ where: { tenantId } }),
      this.prisma.costAllocation.findMany({ where: { expense: { tenantId } } }),
      this.prisma.budget.findMany({ where: { tenantId } }),
    ]);

    // Enrich sites with GPS coordinates (PostGIS → lat/lng)
    const enrichedSites = await this.enrichSitesWithCoordinates(sites);

    return {
      sites: enrichedSites, assets, racks,
      'floor-plans': floorPlans, pins, tasks,
      contacts, 'contact-types': contactTypes, users,
      attachments,
      // Track C additions
      photos,
      'asset-movements': assetMovements,
      'task-comments': taskComments,
      'connectivity-links': connectivityLinks,
      'site-health-snapshots': siteHealthSnapshots,
      'billing-entities': billingEntities,
      expenses,
      'cost-allocations': costAllocations,
      budgets,
    };
  }

  private async exportSiteData(tenantId: string, siteId: string): Promise<Record<string, any[]>> {
    const [site, assets, racks, floorPlans, tasks] = await Promise.all([
      this.prisma.site.findMany({ where: { id: siteId, tenantId } }),
      this.prisma.asset.findMany({ where: { siteId, tenantId } }),
      this.prisma.rack.findMany({ where: { siteId, tenantId } }),
      this.prisma.floorPlan.findMany({ where: { siteId } }),
      this.prisma.task.findMany({ where: { siteId, tenantId } }),
    ]);

    const assetIds = assets.map(a => a.id);
    const rackIds = racks.map(r => r.id);
    const floorPlanIds = floorPlans.map(fp => fp.id);
    const taskIds = tasks.map(t => t.id);

    const [pins, taskChecklist, taskComments, auditLogs, attachments] = await Promise.all([
      floorPlanIds.length
        ? this.prisma.pin.findMany({ where: { floorPlanId: { in: floorPlanIds } } })
        : [],
      taskIds.length
        ? this.prisma.taskChecklistItem.findMany({ where: { taskId: { in: taskIds } } })
        : [],
      taskIds.length
        ? this.prisma.taskComment.findMany({ where: { taskId: { in: taskIds } } })
        : [],
      this.prisma.auditLog.findMany({
        where: { tenantId, entityType: 'site', entityId: siteId },
        take: 500,
        orderBy: { timestamp: 'desc' },
      }),
      // Fetch ALL attachments related to this site (site itself + its assets, tasks, racks)
      this.prisma.attachment.findMany({
        where: {
          tenantId,
          OR: [
            { siteId },
            ...(assetIds.length ? [{ assetId: { in: assetIds } }] : []),
            ...(taskIds.length ? [{ taskId: { in: taskIds } }] : []),
            ...(rackIds.length ? [{ rackId: { in: rackIds } }] : []),
          ],
        },
      }),
    ]);

    // Enrich sites with GPS coordinates (PostGIS → lat/lng)
    const enrichedSite = await this.enrichSitesWithCoordinates(site);

    return {
      site: enrichedSite, assets, racks,
      'floor-plans': floorPlans, pins, tasks,
      'task-checklist': taskChecklist, 'task-comments': taskComments,
      'audit-logs': auditLogs,
      attachments,
    };
  }

  /**
   * Enrich site objects with latitude/longitude from PostGIS coordinates.
   * Prisma cannot read Unsupported("geometry") fields, so we use raw SQL.
   */
  private async enrichSitesWithCoordinates(sites: any[]): Promise<any[]> {
    if (!sites.length) return sites;

    try {
      const siteIds = sites.map(s => s.id);
      const coords = await this.prisma.$queryRawUnsafe<{ id: string; latitude: number; longitude: number }[]>(
        `SELECT id, ST_Y(coordinates::geometry) as latitude, ST_X(coordinates::geometry) as longitude
         FROM "sites" WHERE id = ANY($1::text[]) AND coordinates IS NOT NULL`,
        siteIds,
      );

      const coordMap = new Map(coords.map(c => [c.id, { latitude: Number(c.latitude), longitude: Number(c.longitude) }]));
      return sites.map(s => ({
        ...s,
        ...(coordMap.get(s.id) || {}),
      }));
    } catch (err: unknown) {
      this.logger.warn(`Could not fetch coordinates: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return sites;
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS — FILE COLLECTION + PLAN RENDERING
  // ==========================================================================

  private async collectFiles(
    data: Record<string, any[]>,
    pins: any[] = [],
  ): Promise<{ path: string; content: Buffer }[]> {
    const files: { path: string; content: Buffer }[] = [];

    // 1. Floor plan files (raw + rendered with pins)
    const floorPlans = data['floor-plans'] || [];
    for (const plan of floorPlans) {
      if (plan.fileUrl) {
        try {
          const buffer = await this.downloadFromStorage(plan.fileUrl);
          const filename = plan.fileUrl.split('/').pop() || `plan-${plan.id}`;

          // Include raw file (needed for restore)
          files.push({ path: `plans/raw/${filename}`, content: buffer });

          // Generate rendered version with pins overlay
          const planPins = pins.filter((p: any) => p.floorPlanId === plan.id);
          if (planPins.length > 0) {
            try {
              const rendered = await this.renderPlanWithPins(buffer, planPins, plan.title || 'Plan');
              const renderedName = filename.replace(/\.[^.]+$/, '') + '-with-pins.png';
              files.push({ path: `plans/rendered/${renderedName}`, content: rendered });
            } catch (renderErr: any) {
              this.logger.warn(`Could not render plan with pins: ${renderErr.message}`);
            }
          }
        } catch {
          this.logger.warn(`Could not download floor plan file: ${plan.fileUrl}`);
        }
      }
    }

    // 2. Attachment files (assets, tasks, racks, sites)
    const attachments = data['attachments'] || [];
    for (const att of attachments) {
      if (att.path) {
        try {
          const buffer = await this.downloadFromStorage(att.path);
          // Determine entity type for folder structure
          const entityType = att.assetId ? 'assets' : att.taskId ? 'tasks' : att.rackId ? 'racks' : 'sites';
          const entityId = att.assetId || att.taskId || att.rackId || att.siteId || 'unknown';
          files.push({
            path: `attachments/${entityType}/${entityId}/${att.filename}`,
            content: buffer,
          });
        } catch {
          this.logger.warn(`Could not download attachment: ${att.path}`);
        }
      }
    }

    this.logger.log(`Collected ${files.length} files (${floorPlans.length} plans, ${attachments.length} attachments)`);
    return files;
  }

  /**
   * Render a floor plan image with pin overlays using sharp + SVG composite.
   * Produces a PNG with colored pin markers at correct positions.
   */
  private async renderPlanWithPins(
    planBuffer: Buffer,
    pins: any[],
    planTitle: string,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');

    // Get image dimensions
    const metadata = await sharp(planBuffer).metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 600;

    // Build SVG overlay with pin markers
    const svgElements = pins.map((pin: any) => {
      const px = Math.round((pin.x || 0) * imgWidth);
      const py = Math.round((pin.y || 0) * imgHeight);
      const color = PIN_COLORS[pin.pinType] || PIN_COLORS.OTHER;
      const sigle = PIN_LABELS[pin.pinType] || '??';

      // Pin circle with shadow
      let svg = `<circle cx="${px}" cy="${py}" r="16" fill="rgba(0,0,0,0.3)" />`;
      svg += `<circle cx="${px}" cy="${py - 1}" r="14" fill="${color}" stroke="white" stroke-width="2"/>`;
      svg += `<text x="${px}" y="${py + 3}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="11" fill="white">${sigle}</text>`;

      // Label below pin
      if (pin.label) {
        const escapedLabel = pin.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const labelWidth = Math.max(40, escapedLabel.length * 7 + 8);
        svg += `<rect x="${px - labelWidth / 2}" y="${py + 18}" width="${labelWidth}" height="16" rx="3" fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>`;
        svg += `<text x="${px}" y="${py + 30}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="9" fill="#333">${escapedLabel}</text>`;
      }

      return svg;
    }).join('\n');

    const svgOverlay = Buffer.from(`<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`);

    // Composite pins overlay onto the plan image
    const renderedBuffer = await sharp(planBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    this.logger.log(`Rendered plan "${planTitle}" with ${pins.length} pins (${renderedBuffer.length} bytes)`);
    return renderedBuffer;
  }

  // ==========================================================================
  // PRIVATE HELPERS — ZIP CREATION
  // ==========================================================================

  private async createFullZip(
    data: Record<string, any[]>,
    files: { path: string; content: Buffer }[],
    metadata: BackupMetadata,
  ): Promise<Buffer> {
    const prefix = `full-backup-${metadata.timestamp.replace(/[:.]/g, '-').slice(0, 19)}`;

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const passthrough = new PassThrough();
      const chunks: Buffer[] = [];

      passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (err: any) => this.logger.warn(`Archiver warning: ${err.message}`));

      archive.pipe(passthrough);

      archive.append(JSON.stringify(metadata, null, 2), { name: `${prefix}/metadata.json` });
      for (const [key, records] of Object.entries(data)) {
        archive.append(JSON.stringify(records, null, 2), { name: `${prefix}/data/${key}.json` });
      }
      for (const file of files) {
        archive.append(file.content, { name: `${prefix}/files/${file.path}` });
      }
      archive.finalize();
    });
  }

  private async createSiteZip(
    data: Record<string, any[]>,
    files: { path: string; content: Buffer }[],
    metadata: BackupMetadata,
  ): Promise<Buffer> {
    const prefix = `site-${metadata.siteCode}-${metadata.timestamp.slice(0, 10)}`;

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const passthrough = new PassThrough();
      const chunks: Buffer[] = [];

      passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));
      passthrough.on('end', () => resolve(Buffer.concat(chunks)));
      passthrough.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (err: any) => this.logger.warn(`Archiver warning: ${err.message}`));

      archive.pipe(passthrough);

      archive.append(JSON.stringify(metadata, null, 2), { name: `${prefix}/metadata.json` });
      for (const [key, records] of Object.entries(data)) {
        archive.append(JSON.stringify(records, null, 2), { name: `${prefix}/data/${key}.json` });
      }
      for (const file of files) {
        archive.append(file.content, { name: `${prefix}/files/${file.path}` });
      }
      archive.finalize();
    });
  }

  private countRecords(data: Record<string, any[]>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [key, records] of Object.entries(data)) {
      counts[key] = records.length;
    }
    return counts;
  }

  // ==========================================================================
  // PRIVATE HELPERS — MINIO / STORAGE
  // ==========================================================================

  /**
   * Get or create a cached MinIO client for backup bucket operations.
   */
  private getMinioClient(): any {
    if (!this._minioClient) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Minio = require('minio');
      this._minioClient = new Minio.Client({
        endPoint: this.configService.get('MINIO_ENDPOINT', 'minio'),
        port: parseInt(this.configService.get('MINIO_PORT', '9000') as string),
        useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
        accessKey: this.configService.get('MINIO_ACCESS_KEY', 'xch_minio_admin'),
        secretKey: this.configService.get('MINIO_SECRET_KEY', ''),
      });
    }
    return this._minioClient;
  }

  /**
   * Upload a buffer directly to the xch-backups bucket.
   * Creates the bucket if it doesn't exist.
   */
  private async uploadToBackupBucket(buffer: Buffer, filename: string): Promise<void> {
    const client = this.getMinioClient();

    // Ensure bucket exists
    try {
      const exists = await client.bucketExists(this.BACKUP_BUCKET);
      if (!exists) {
        await client.makeBucket(this.BACKUP_BUCKET, 'us-east-1');
        this.logger.log(`Created backup bucket: ${this.BACKUP_BUCKET}`);
      }
    } catch (err: unknown) {
      this.logger.warn(`Could not verify backup bucket: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    await client.putObject(
      this.BACKUP_BUCKET,
      filename,
      buffer,
      buffer.length,
      { 'Content-Type': 'application/zip' },
    );
    this.logger.log(`Backup uploaded to ${this.BACKUP_BUCKET}/${filename} (${buffer.length} bytes)`);
  }

  /**
   * Delete a file from the xch-backups bucket.
   */
  private async deleteFromBackupBucket(filename: string): Promise<void> {
    const client = this.getMinioClient();
    await client.removeObject(this.BACKUP_BUCKET, filename);
    this.logger.log(`Backup deleted from ${this.BACKUP_BUCKET}/${filename}`);
  }

  /**
   * Download a file from MinIO by parsing bucket/key from path.
   */
  private async downloadFromStorage(filePath: string): Promise<Buffer> {
    let cleanPath = filePath;
    if (cleanPath.startsWith('/storage/')) cleanPath = cleanPath.replace('/storage/', '');
    if (cleanPath.startsWith('http')) {
      const url = new URL(cleanPath);
      cleanPath = url.pathname.replace('/storage/', '');
    }

    const minioClient = this.getMinioClient();
    const parts = cleanPath.split('/');
    const bucket = parts[0];
    const key = parts.slice(1).join('/');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      minioClient.getObject(bucket, key, (err: any, stream: any) => {
        if (err) return reject(err);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS — AUDIT + CLEANUP
  // ==========================================================================

  private async logBackupAction(
    tenantId: string,
    userId: string | undefined,
    action: string,
    changes: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action,
          entityType: 'backup',
          entityId: changes.filename || changes.siteId || 'system',
          changes,
        },
      });
    } catch (err: unknown) {
      this.logger.warn(`Could not create audit log: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const oldLogs = await this.prisma.auditLog.findMany({
        where: {
          action: { in: ['BACKUP_FULL', 'BACKUP_SITE'] },
          timestamp: { lt: cutoff },
        },
        take: 20,
      });

      for (const log of oldLogs) {
        const changes = log.changes as Record<string, any> || {};
        if (changes.filename) {
          try {
            await this.deleteFromBackupBucket(changes.filename);
          } catch {
            // File may already be deleted
          }
        }
      }
    } catch (err: unknown) {
      this.logger.warn(`Cleanup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // ORPHANED STORAGE CLEANUP
  // ==========================================================================

  /**
   * Clean up orphaned files in MinIO xch-storage bucket.
   * Files that exist in storage but have no matching DB record are considered orphaned.
   * A grace period (default 24h) prevents deleting files that may be mid-restore.
   */
  async cleanupOrphanedStorage(
    tenantId: string,
    userId?: string,
    graceHours = 24,
  ): Promise<{ deleted: string[]; skipped: string[]; errors: string[] }> {
    this.logger.log(`Starting orphaned storage cleanup (grace period: ${graceHours}h)...`);

    const client = this.getMinioClient();
    const storageBucket = this.configService.get('MINIO_BUCKET', 'xch-storage');
    const cutoff = new Date(Date.now() - graceHours * 60 * 60 * 1000);

    // 1. List ALL objects in storage bucket
    const storageObjects: { name: string; lastModified: Date; size: number }[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = client.listObjectsV2(storageBucket, '', true);
      stream.on('data', (obj: any) => {
        if (obj.name) {
          storageObjects.push({
            name: obj.name,
            lastModified: obj.lastModified || new Date(),
            size: obj.size || 0,
          });
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    this.logger.log(`Found ${storageObjects.length} objects in ${storageBucket}`);

    if (storageObjects.length === 0) {
      return { deleted: [], skipped: [], errors: [] };
    }

    // 2. Get all known file paths from database
    const knownPaths = new Set<string>();

    // FloorPlan fileUrls → extract the object key in storage
    const floorPlans = await this.prisma.floorPlan.findMany({
      select: { fileUrl: true },
    });
    for (const fp of floorPlans) {
      if (fp.fileUrl) {
        // fileUrl can be: /storage/xch-storage/floor-plans/xxx or /floor-plans/xxx
        let key = fp.fileUrl;
        if (key.includes(`/${storageBucket}/`)) {
          key = key.split(`/${storageBucket}/`).pop() || '';
        } else if (key.startsWith('/')) {
          key = key.substring(1); // Remove leading slash
        }
        if (key) knownPaths.add(key);
      }
    }

    // Attachment paths → extract the object key in storage
    const attachments = await this.prisma.attachment.findMany({
      select: { path: true },
    });
    for (const att of attachments) {
      if (att.path) {
        let key = att.path;
        // path can be: /storage/xch-storage/attachments/... or attachments/... or /attachments/...
        if (key.includes(`/${storageBucket}/`)) {
          key = key.split(`/${storageBucket}/`).pop() || '';
        } else if (key.startsWith('/')) {
          key = key.substring(1);
        }
        if (key) knownPaths.add(key);
      }
    }

    this.logger.log(`Found ${knownPaths.size} known file references in database`);

    // 3. Compare and delete orphaned files
    const deleted: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const obj of storageObjects) {
      // Check if this object has a matching DB record
      if (knownPaths.has(obj.name)) {
        continue; // File is referenced in DB — keep it
      }

      // Check grace period — don't delete recent files (may be mid-upload/restore)
      if (obj.lastModified > cutoff) {
        skipped.push(obj.name);
        this.logger.debug(`Skipping recent orphan (grace period): ${obj.name}`);
        continue;
      }

      // Delete the orphaned file
      try {
        await client.removeObject(storageBucket, obj.name);
        deleted.push(obj.name);
        this.logger.log(`Deleted orphaned file: ${storageBucket}/${obj.name}`);
      } catch (err: unknown) {
        const msg = `Failed to delete ${obj.name}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        errors.push(msg);
        this.logger.warn(msg);
      }
    }

    this.logger.log(
      `Storage cleanup done: ${deleted.length} deleted, ${skipped.length} skipped (grace), ${errors.length} errors`,
    );

    // Log the action
    if (deleted.length > 0) {
      await this.logBackupAction(tenantId, userId, 'STORAGE_CLEANUP', {
        deletedCount: deleted.length,
        skippedCount: skipped.length,
        deletedFiles: deleted,
      });
    }

    return { deleted, skipped, errors };
  }

  /**
   * Cron job: clean orphaned storage files daily at 3am (after backups at 2am).
   */
  @Cron('0 3 * * *')
  async scheduledStorageCleanup() {
    if (this.configService.get('AUTO_BACKUP', 'false') !== 'true') return;

    this.logger.log('Starting scheduled storage cleanup...');
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { status: 'ACTIVE' } });
      for (const tenant of tenants) {
        try {
          const result = await this.cleanupOrphanedStorage(tenant.id, 'system', 24);
          if (result.deleted.length > 0) {
            this.logger.log(
              `Storage cleanup for tenant ${tenant.name}: ${result.deleted.length} files deleted`,
            );
          }
        } catch (err: unknown) {
          this.logger.error(
            `Storage cleanup failed for tenant ${tenant.id}: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Scheduled storage cleanup failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private async getOrCreateDefaultDelegation(tx: any, tenantId: string): Promise<string> {
    const existing = await tx.delegation.findFirst({ where: { tenantId, code: 'IMPORT' } });
    if (existing) return existing.id;

    const delegation = await tx.delegation.create({
      data: { tenantId, name: 'Imports', code: 'IMPORT', notes: 'Délégation auto-créée pour les imports' },
    });
    return delegation.id;
  }
}
