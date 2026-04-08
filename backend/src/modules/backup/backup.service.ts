import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../common/services/storage.service';
import * as archiver from 'archiver';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');
import { PassThrough } from 'stream';

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

export interface BackupListItem {
  id: string;
  filename: string;
  type: 'full' | 'site';
  siteCode?: string;
  size: number;
  createdAt: string;
}

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
          // JSON fields
          contacts: siteData.contacts || undefined,
          accessNotes: siteData.accessNotes || undefined,
          connectivity: siteData.connectivity || undefined,
          emplacements: siteData.emplacements || undefined,
          metadata: siteData.metadata || undefined,
          // String fields
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
              name: asset.name,
              type: asset.type,
              status: asset.status || 'IN_SERVICE',
              manufacturer: asset.manufacturer,
              model: asset.model,
              serialNumber,
              networkInfo: asset.networkInfo,
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
          if (!existing) {
            const newTypeId = contact.typeId ? contactTypeIdMap.get(contact.typeId) : undefined;
            if (newTypeId) {
              await tx.contact.create({
                data: {
                  tenantId, name: contact.name,
                  typeId: newTypeId,
                  email: contact.email, phone: contact.phone,
                  mobile: contact.mobile, address: contact.address,
                  company: contact.company, role: contact.role,
                  notes: contact.notes,
                },
              });
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
            contacts: siteData.contacts || undefined,
            accessNotes: siteData.accessNotes || undefined,
            connectivity: siteData.connectivity || undefined,
            emplacements: siteData.emplacements || undefined,
            metadata: siteData.metadata || undefined,
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
              name: asset.name, type: asset.type, status: asset.status || 'IN_SERVICE',
              manufacturer: asset.manufacturer, model: asset.model,
              serialNumber: asset.serialNumber, networkInfo: asset.networkInfo,
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
  // PRIVATE HELPERS — DATA EXPORT
  // ==========================================================================

  private async exportAllTenantData(tenantId: string): Promise<Record<string, any[]>> {
    const [sites, assets, racks, floorPlans, pins, tasks, contacts, contactTypes, users, attachments] =
      await Promise.all([
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
            id: true, email: true, name: true, role: true,
            active: true, phone: true, authProvider: true,
          },
        }),
        this.prisma.attachment.findMany({ where: { tenantId } }),
      ]);

    // Enrich sites with GPS coordinates (PostGIS → lat/lng)
    const enrichedSites = await this.enrichSitesWithCoordinates(sites);

    return {
      sites: enrichedSites, assets, racks,
      'floor-plans': floorPlans, pins, tasks,
      contacts, 'contact-types': contactTypes, users,
      attachments,
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
