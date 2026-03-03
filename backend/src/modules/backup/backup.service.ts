import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { StorageService } from '../../common/services/storage.service';
import * as archiver from 'archiver';
import AdmZip from 'adm-zip';

interface BackupMetadata {
  version: string;
  type: 'full' | 'site';
  timestamp: string;
  tenantId: string;
  siteId?: string;
  siteCode?: string;
  counts: Record<string, number>;
}

interface BackupListItem {
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

    const zipBuffer = await this.createZipFromData(data, {
      version: '1.0',
      type: 'full',
      timestamp: new Date().toISOString(),
      tenantId,
      counts: this.countRecords(data),
    });

    await this.storageService.uploadFile(
      { buffer: zipBuffer, originalname: filename, mimetype: 'application/zip' } as any,
      this.BACKUP_BUCKET,
      filename,
    );

    this.logger.log(`Full backup completed: ${filename} (${zipBuffer.length} bytes)`);
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
    const files = await this.collectSiteFiles(data);

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
      await this.storageService.uploadFile(
        { buffer: zipBuffer, originalname: filename, mimetype: 'application/zip' } as any,
        this.BACKUP_BUCKET,
        filename,
      );
    } catch (err: any) {
      this.logger.warn(`Could not store backup in MinIO: ${err.message}`);
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

    // Collect file entries
    const fileEntries: { entryName: string; data: Buffer }[] = [];
    for (const entry of entries) {
      if (entry.entryName.includes('/files/') && !entry.isDirectory) {
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
      // 1. Create site
      const newSite = await tx.site.create({
        data: {
          tenantId,
          code: siteData.code,
          name: siteData.name,
          status: siteData.status || 'ACTIVE',
          address: siteData.address,
          city: siteData.city,
          postalCode: siteData.postalCode,
          country: siteData.country || 'France',
          healthStatus: siteData.healthStatus || 'UNKNOWN',
        },
      });

      const counts: Record<string, number> = { sites: 1 };

      // 2. Create assets
      const assetIdMap = new Map<string, string>();
      if (dataFiles['assets']?.length) {
        for (const asset of dataFiles['assets']) {
          const newAsset = await tx.asset.create({
            data: {
              tenantId,
              siteId: newSite.id,
              name: asset.name,
              type: asset.type,
              status: asset.status || 'IN_SERVICE',
              manufacturer: asset.manufacturer,
              model: asset.model,
              serialNumber: asset.serialNumber,
              networkInfo: asset.networkInfo,
              locationText: asset.locationText,
            },
          });
          assetIdMap.set(asset.id, newAsset.id);
        }
        counts.assets = dataFiles['assets'].length;
      }

      // 3. Create racks
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
                  },
                });
              }
            }
          }
        }
        counts.racks = dataFiles['racks'].length;
      }

      // 4. Create floor plans
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

      // 6. Create tasks (requires createdBy)
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
            },
          });

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

      return { siteId: newSite.id, counts };
    });

    // Upload files to MinIO (outside transaction)
    for (const fileEntry of fileEntries) {
      try {
        const parts = fileEntry.entryName.split('/files/');
        if (parts.length >= 2) {
          const relativePath = parts[1];
          const folder = relativePath.substring(0, relativePath.lastIndexOf('/'));
          const fname = relativePath.substring(relativePath.lastIndexOf('/') + 1);
          await this.storageService.uploadFile(
            { buffer: fileEntry.data, originalname: fname, mimetype: 'application/octet-stream' } as any,
            folder,
            fname,
          );
        }
      } catch (err: any) {
        this.logger.warn(`Could not restore file ${fileEntry.entryName}: ${err.message}`);
      }
    }

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
        await this.storageService.deleteFile(`${this.BACKUP_BUCKET}/${changes.filename}`);
      } catch (err: any) {
        this.logger.warn(`Could not delete backup file: ${err.message}`);
      }
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
        } catch (err: any) {
          this.logger.error(`Scheduled backup failed for tenant ${tenant.id}: ${err.message}`);
        }
      }
      await this.cleanupOldBackups();
    } catch (err: any) {
      this.logger.error(`Scheduled backup failed: ${err.message}`);
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async exportAllTenantData(tenantId: string): Promise<Record<string, any[]>> {
    const [sites, assets, racks, floorPlans, pins, tasks, contacts, contactTypes, users] =
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
      ]);

    return {
      sites, assets, racks,
      'floor-plans': floorPlans, pins, tasks,
      contacts, 'contact-types': contactTypes, users,
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

    const floorPlanIds = floorPlans.map(fp => fp.id);
    const taskIds = tasks.map(t => t.id);

    const [pins, taskChecklist, taskComments, userSiteAccess, auditLogs] = await Promise.all([
      floorPlanIds.length
        ? this.prisma.pin.findMany({ where: { floorPlanId: { in: floorPlanIds } } })
        : [],
      taskIds.length
        ? this.prisma.taskChecklistItem.findMany({ where: { taskId: { in: taskIds } } })
        : [],
      taskIds.length
        ? this.prisma.taskComment.findMany({ where: { taskId: { in: taskIds } } })
        : [],
      this.prisma.userSiteAccess.findMany({ where: { siteId } }),
      this.prisma.auditLog.findMany({
        where: { tenantId, entityType: 'site', entityId: siteId },
        take: 500,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    return {
      site, assets, racks,
      'floor-plans': floorPlans, pins, tasks,
      'task-checklist': taskChecklist, 'task-comments': taskComments,
      'user-site-access': userSiteAccess, 'audit-logs': auditLogs,
    };
  }

  private async collectSiteFiles(data: Record<string, any[]>): Promise<{ path: string; content: Buffer }[]> {
    const files: { path: string; content: Buffer }[] = [];
    const floorPlans = data['floor-plans'] || [];

    for (const plan of floorPlans) {
      if (plan.fileUrl) {
        try {
          const buffer = await this.downloadFromStorage(plan.fileUrl);
          const filename = plan.fileUrl.split('/').pop() || `plan-${plan.id}`;
          files.push({ path: `plans/${filename}`, content: buffer });
        } catch {
          this.logger.warn(`Could not download floor plan file: ${plan.fileUrl}`);
        }
      }
    }

    return files;
  }

  private async createZipFromData(data: Record<string, any[]>, metadata: BackupMetadata): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
      for (const [key, records] of Object.entries(data)) {
        archive.append(JSON.stringify(records, null, 2), { name: `data/${key}.json` });
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
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

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

  private getMinioClient(): any {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Minio = require('minio');
    return new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000') as string),
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'xch_minio_admin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'XchMinIO2024SecureKey!'),
    });
  }

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
    } catch (err: any) {
      this.logger.warn(`Could not create audit log: ${err.message}`);
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
            await this.storageService.deleteFile(`${this.BACKUP_BUCKET}/${changes.filename}`);
          } catch {
            // File may already be deleted
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Cleanup failed: ${err.message}`);
    }
  }
}
