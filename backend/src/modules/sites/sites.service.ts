import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class SitesService {
  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private auditLogService: AuditLogService,
  ) {}

  async create(tenantId: string, createSiteDto: CreateSiteDto, userId?: string) {
    const existing = await this.prisma.site.findFirst({
      where: {
        tenantId,
        code: createSiteDto.code,
      },
    });

    if (existing) {
      throw new ConflictException('Site with this code already exists');
    }

    const hasCoordinates = !!(createSiteDto.latitude && createSiteDto.longitude);

    const { latitude, longitude, ...siteData } = createSiteDto;

    const result = await this.prisma.$queryRawUnsafe<{id: string}[]>(
      `INSERT INTO "sites" ("id", "tenantId", "code", "name", "status", "address", "city", "postalCode", "country", "coordinates", "healthStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4::"SiteStatus", $5, $6, $7, $8, ${hasCoordinates ? `ST_SetSRID(ST_MakePoint($9, $10), 4326)` : 'NULL'}, ${hasCoordinates ? '$11' : '$9'}::"HealthStatus", NOW(), NOW())
       RETURNING id`,
      tenantId,
      siteData.code,
      siteData.name,
      siteData.status || 'ACTIVE',
      siteData.address,
      siteData.city,
      siteData.postalCode || null,
      siteData.country || 'France',
      ...(hasCoordinates ? [longitude, latitude] : []),
      siteData.healthStatus || 'UNKNOWN',
    );

    const site = await this.findOne(result[0].id, tenantId);

    // Audit log
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'site',
      entityId: site.id,
      changes: { after: { code: site.code, name: site.name, status: site.status, address: site.address, city: site.city } },
    });

    return site;
  }

  async findAll(tenantId: string, filter?: FilterSiteDto, accessibleSiteIds?: string[] | null) {
    // Build WHERE clause for raw query
    let whereClause = `s."tenantId" = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Site access filtering: if accessibleSiteIds is an array (not null), restrict results
    // null = ADMIN/MANAGER with access to all sites, array = specific site IDs
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) {
        // No accessible sites — return empty
        return [];
      }
      const placeholders = accessibleSiteIds.map((_, i) => `$${paramIndex + i}`).join(', ');
      whereClause += ` AND s.id IN (${placeholders})`;
      params.push(...accessibleSiteIds);
      paramIndex += accessibleSiteIds.length;
    }

    if (filter?.status) {
      whereClause += ` AND s.status = $${paramIndex}`;
      params.push(filter.status);
      paramIndex++;
    }

    if (filter?.healthStatus) {
      whereClause += ` AND s."healthStatus" = $${paramIndex}`;
      params.push(filter.healthStatus);
      paramIndex++;
    }

    if (filter?.search) {
      whereClause += ` AND (
        s.name ILIKE $${paramIndex} OR
        s.code ILIKE $${paramIndex} OR
        s.city ILIKE $${paramIndex} OR
        s.address ILIKE $${paramIndex}
      )`;
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s.contacts,
        s."accessNotes",
        s.connectivity,
        s.emplacements,
        s."governanceDocsRef",
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s.metadata,
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude
      FROM "sites" s
      WHERE ${whereClause}
      ORDER BY s."updatedAt" DESC
    `, ...params);

    return sites;
  }

  async findOne(id: string, tenantId: string) {
    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s.contacts,
        s."accessNotes",
        s.connectivity,
        s.emplacements,
        s."governanceDocsRef",
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s.metadata,
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude,
        (SELECT COUNT(*) FROM "assets" a WHERE a."siteId" = s.id) as "_count_assets",
        (SELECT COUNT(*) FROM "racks" r WHERE r."siteId" = s.id) as "_count_racks",
        (SELECT COUNT(*) FROM "tasks" t WHERE t."siteId" = s.id) as "_count_tasks"
      FROM "sites" s
      WHERE s.id = $1 AND s."tenantId" = $2
    `, id, tenantId);

    if (!sites || (sites as any[]).length === 0) {
      throw new NotFoundException('Site not found');
    }

    const site = (sites as any[])[0];

    // Transform counts to match Prisma include format
    return {
      ...site,
      _count: {
        assets: Number(site._count_assets) || 0,
        racks: Number(site._count_racks) || 0,
        tasks: Number(site._count_tasks) || 0,
      },
      _count_assets: undefined,
      _count_racks: undefined,
      _count_tasks: undefined,
    };
  }

  async update(id: string, tenantId: string, updateSiteDto: UpdateSiteDto, userId?: string) {
    // Get current state for diff
    const before = await this.prisma.site.findUnique({ where: { id } });

    const { latitude, longitude, ...siteData } = updateSiteDto;

    // Only update coordinates if they actually changed (avoid polluting audit log)
    let coordinatesChanged = false;
    if (latitude !== undefined && longitude !== undefined) {
      // Fetch current coordinates from PostGIS
      const currentCoords = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT ST_Y(coordinates::geometry) as latitude, ST_X(coordinates::geometry) as longitude FROM "sites" WHERE id = $1 AND coordinates IS NOT NULL`,
        id,
      );
      const currentLat = currentCoords?.[0]?.latitude;
      const currentLng = currentCoords?.[0]?.longitude;

      // Compare with tolerance for floating point (skip if same within ~0.1m)
      const hasCoords = currentLat !== null && currentLat !== undefined;
      if (!hasCoords ||
          Math.abs(currentLat - latitude) > 0.000001 ||
          Math.abs(currentLng - longitude) > 0.000001) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "sites" SET coordinates = ST_SetSRID(ST_MakePoint($2, $3), 4326) WHERE id = $1`,
          id,
          longitude,
          latitude,
        );
        coordinatesChanged = true;
      }
    }

    const updated = await this.prisma.site.update({
      where: { id },
      data: siteData,
    });

    // Audit log with diff — only include lat/lng if coordinates actually changed
    if (before) {
      const changes = this.auditLogService.diffChanges(
        before as Record<string, any>,
        { ...siteData, ...(coordinatesChanged ? { latitude, longitude } : {}) },
      );
      if (changes) {
        await this.auditLogService.log({
          tenantId,
          userId,
          action: 'UPDATE',
          entityType: 'site',
          entityId: id,
          changes,
        });
      }
    }

    return updated;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const site = await this.findOne(id, tenantId);

    await this.prisma.site.delete({
      where: { id },
    });

    // Audit log
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'DELETE',
      entityType: 'site',
      entityId: id,
      changes: { before: { code: site.code, name: site.name, status: site.status } },
    });

    return { message: 'Site deleted successfully' };
  }

  async findNearby(latitude: number, longitude: number, radiusKm: number, tenantId: string) {
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT s.*,
             ST_Distance(s.coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 as distance_km
      FROM "sites" s
      WHERE s."tenantId" = $3
        AND s.coordinates IS NOT NULL
        AND ST_DWithin(s.coordinates::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
      ORDER BY distance_km ASC
    `, longitude, latitude, tenantId, radiusKm * 1000);

    return sites;
  }

  // ============================================================================
  // AUDIT HISTORY
  // ============================================================================

  async getAuditHistory(siteId: string, tenantId: string) {
    await this.findOne(siteId, tenantId);
    return this.auditLogService.findByEntity(tenantId, 'site', siteId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async uploadAttachment(
    siteId: string,
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadAttachmentDto,
  ) {
    await this.findOne(siteId, tenantId);

    const filename = this.storageService.generateFilename(file.originalname, 'attachment');
    const folder = `attachments/${tenantId}/sites/${siteId}`;
    const filePath = await this.storageService.uploadFile(file, folder, filename);

    const attachment = await this.prisma.attachment.create({
      data: {
        id: createId(),
        tenantId,
        siteId,
        filename,
        originalFilename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: filePath,
        description: dto.description,
        category: dto.category,
        uploadedBy: userId,
      },
    });

    return { ...attachment, url: this.storageService.getFileUrl(filePath) };
  }

  async listAttachments(siteId: string, tenantId: string) {
    await this.findOne(siteId, tenantId);

    const attachments = await this.prisma.attachment.findMany({
      where: { tenantId, siteId },
      orderBy: { uploadedAt: 'desc' },
    });

    return attachments.map((a) => ({
      ...a,
      url: this.storageService.getFileUrl(a.path),
    }));
  }

  async deleteAttachment(attachmentId: string, tenantId: string, siteId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, siteId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.storageService.deleteFile(attachment.path);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    return { message: 'Attachment deleted successfully' };
  }

  /**
   * List ALL documents related to a site (aggregated from 4 sources):
   * 1. Site's own attachments
   * 2. Attachments from all assets on the site
   * 3. Attachments from all racks on the site
   * 4. Attachments from all tasks linked to the site
   */
  async listAllDocuments(siteId: string, tenantId: string) {
    await this.findOne(siteId, tenantId);

    // Get all asset IDs on this site
    const assets = await this.prisma.asset.findMany({
      where: { siteId, tenantId },
      select: { id: true, name: true, manufacturer: true, model: true },
    });
    const assetIds = assets.map((a) => a.id);

    // Get all rack IDs on this site
    const racks = await this.prisma.rack.findMany({
      where: { siteId, tenantId },
      select: { id: true, name: true },
    });
    const rackIds = racks.map((r) => r.id);

    // Get all task IDs linked to this site
    const tasks = await this.prisma.task.findMany({
      where: { siteId, tenantId },
      select: { id: true, title: true },
    });
    const taskIds = tasks.map((t) => t.id);

    // Fetch all attachments from 4 sources
    const attachments = await this.prisma.attachment.findMany({
      where: {
        tenantId,
        OR: [
          { siteId },
          ...(assetIds.length > 0 ? [{ assetId: { in: assetIds } }] : []),
          ...(rackIds.length > 0 ? [{ rackId: { in: rackIds } }] : []),
          ...(taskIds.length > 0 ? [{ taskId: { in: taskIds } }] : []),
        ],
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Build lookup maps
    const assetMap = Object.fromEntries(assets.map((a) => [a.id, a]));
    const rackMap = Object.fromEntries(racks.map((r) => [r.id, r]));
    const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

    // Enrich attachments with source info
    return attachments.map((a) => {
      let source = 'site';
      let sourceName = 'Site';

      if (a.assetId && assetMap[a.assetId]) {
        source = 'asset';
        const asset = assetMap[a.assetId];
        sourceName = asset.name || `${asset.manufacturer || ''} ${asset.model || ''}`.trim() || 'Équipement';
      } else if (a.rackId && rackMap[a.rackId]) {
        source = 'rack';
        sourceName = rackMap[a.rackId].name;
      } else if (a.taskId && taskMap[a.taskId]) {
        source = 'task';
        sourceName = taskMap[a.taskId].title;
      }

      return {
        ...a,
        url: this.storageService.getFileUrl(a.path),
        source,
        sourceName,
      };
    });
  }
}
