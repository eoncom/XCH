import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { StorageService } from '../../common/services/storage.service';
import { validateMagicBytesForMimetype } from '../../common/utils/upload-security';
import { AuditLogService, auditCtxFrom } from '../../common/services/audit-log.service';
import { NotificationEmitter } from '../notifications/notification-emitter';
import { MonitorReactionsService } from '../monitoring/monitor-reactions.service';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private auditLogService: AuditLogService,
    private notificationEmitter: NotificationEmitter,
    private monitorReactions: MonitorReactionsService,
    private perm: PermissionService,
  ) {}

  async create(tenantId: string, createSiteDto: CreateSiteDto, userId?: string, ctx?: CallerCtx) {
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
      `INSERT INTO "sites" ("id", "tenantId", "delegationId", "code", "name", "status", "address", "city", "postalCode", "country", "coordinates", "healthStatus", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"SiteStatus", $6, $7, $8, $9, ${hasCoordinates ? `ST_SetSRID(ST_MakePoint($10, $11), 4326)` : 'NULL'}, ${hasCoordinates ? '$12' : '$10'}::"HealthStatus", NOW(), NOW())
       RETURNING id`,
      tenantId,
      siteData.delegationId,
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

    // Audit log — ADR-028 §B.3 propagation tier-1 (POC Track E.4 Pass 1)
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'CREATE',
      entityType: 'site',
      entityId: site.id,
      changes: { after: { code: site.code, name: site.name, status: site.status, address: site.address, city: site.city } },
      ...(ctx ? auditCtxFrom(ctx) : {}),
    });

    return site;
  }

  // Allowed sort fields mapping for raw SQL
  private static readonly SORT_FIELD_MAP: Record<string, string> = {
    updatedAt: 's."updatedAt"',
    createdAt: 's."createdAt"',
    name: 's."name"',
    code: 's."code"',
    status: 's."status"',
  };

  async findAll(tenantId: string, filter?: FilterSiteDto, accessibleSiteIds?: string[] | null): Promise<PaginatedResponse<any>> {
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 25;

    // Build WHERE clause for raw query
    let whereClause = `s."tenantId" = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Site access filtering: if accessibleSiteIds is an array (not null), restrict results
    // null = ADMIN/MANAGER with access to all sites, array = specific site IDs
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) {
        // No accessible sites — return empty
        return buildPaginatedResponse([], 0, page, pageSize);
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

    if (filter?.delegationId) {
      whereClause += ` AND s."delegationId" = $${paramIndex}`;
      params.push(filter.delegationId);
      paramIndex++;
    }

    // Build COUNT query
    const countJoin = '';
    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "sites" s ${countJoin} WHERE ${whereClause}`,
      ...params,
    );
    const total = Number(countResult[0]?.count ?? 0);

    // Short-circuit if no results
    if (total === 0) {
      return buildPaginatedResponse([], 0, page, pageSize);
    }

    // Sort handling
    const sortColumn = (filter?.sortBy && SitesService.SORT_FIELD_MAP[filter.sortBy]) ?? 's."updatedAt"';
    const sortDirection = filter?.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Pagination params
    const offset = (page - 1) * pageSize;
    const paginationParams = [...params, pageSize, offset];
    const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const orgJoin = `LEFT JOIN "delegations" del ON del.id = s."delegationId"`;

    const rawSites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s."delegationId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s."accessSchedules",
        s."accessBadges",
        s."accessProcedures",
        s."accessSafety",
        s."cutProcedure",
        s."governanceDocsRef",
        s."smbPath",
        s."sharepointUrl",
        s."gedUrl",
        s."accessRightsUrl",
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s."monitoringEnabled",
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude,
        del.name as "delegation_name",
        del.code as "delegation_code",
        del."groupLabel" as "delegation_groupLabel",
        del."groupColor" as "delegation_groupColor"
      FROM "sites" s
      ${orgJoin}
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      ${limitClause}
    `, ...paginationParams);

    // ADR-018 — bulk-load SiteHealthSnapshot for the page slice. The TV
    // dashboard needs the components breakdown per site to count up/down.
    const siteIds = (rawSites as any[]).map((s) => s.id);
    const snapshots = siteIds.length
      ? await this.prisma.siteHealthSnapshot.findMany({ where: { siteId: { in: siteIds } } })
      : [];
    const snapshotsBySite = new Map(snapshots.map((s) => [s.siteId, s]));

    // Transform org fields into nested objects
    const transformedResults = (rawSites as any[]).map(site => ({
      ...site,
      delegation: site.delegationId ? {
        id: site.delegationId,
        name: site.delegation_name,
        code: site.delegation_code,
        groupLabel: site.delegation_groupLabel,
        groupColor: site.delegation_groupColor,
      } : null,
      healthSnapshot: snapshotsBySite.get(site.id) ?? null,
      delegation_name: undefined,
      delegation_code: undefined,
      delegation_groupLabel: undefined,
      delegation_groupColor: undefined,
    }));

    return buildPaginatedResponse(transformedResults, total, page, pageSize);
  }

  async findOne(id: string, tenantId: string, callerCtx?: CallerCtx) {
    // ADR-021 — guess-by-id defense. Optional ctx for legacy callers
    // (gradually migrating). When provided, throws 404 on cross-deleg.
    if (callerCtx) {
      await this.perm.assertCanReadSite(callerCtx, id);
    }
    // Use raw query to extract latitude/longitude from PostGIS coordinates
    const sites = await this.prisma.$queryRawUnsafe(`
      SELECT
        s.id,
        s."tenantId",
        s."delegationId",
        s.code,
        s.name,
        s.status,
        s.address,
        s.city,
        s."postalCode",
        s.country,
        s."accessSchedules",
        s."accessBadges",
        s."accessProcedures",
        s."accessSafety",
        s."cutProcedure",
        s."governanceDocsRef",
        s."smbPath",
        s."sharepointUrl",
        s."gedUrl",
        s."accessRightsUrl",
        s."healthStatus",
        s."lastHealthCheck",
        s.notes,
        s."monitoringEnabled",
        s."createdAt",
        s."updatedAt",
        ST_Y(s.coordinates::geometry) as latitude,
        ST_X(s.coordinates::geometry) as longitude,
        (SELECT COUNT(*) FROM "assets" a WHERE a."siteId" = s.id) as "_count_assets",
        (SELECT COUNT(*) FROM "racks" r WHERE r."siteId" = s.id) as "_count_racks",
        (SELECT COUNT(*) FROM "tasks" t WHERE t."siteId" = s.id) as "_count_tasks",
        del.id as "delegation_id",
        del.name as "delegation_name",
        del.code as "delegation_code",
        del."groupLabel" as "delegation_groupLabel",
        del."groupColor" as "delegation_groupColor"
      FROM "sites" s
      LEFT JOIN "delegations" del ON del.id = s."delegationId"
      WHERE s.id = $1 AND s."tenantId" = $2
    `, id, tenantId);

    if (!sites || (sites as any[]).length === 0) {
      throw new NotFoundException('Site not found');
    }

    const site = (sites as any[])[0];

    // Load structured connectivity links (replaces legacy Site.connectivity JSON)
    const connectivityLinks = await this.prisma.connectivityLink.findMany({
      where: { siteId: id, tenantId },
      include: {
        expense: { select: { id: true, label: true, totalAmount: true, frequency: true } },
      },
      orderBy: [{ role: 'asc' }, { provider: 'asc' }],
    });

    // ADR-018 — health breakdown extracted from Site.metadata.healthBreakdown
    // to a typed 1:0..1 SiteHealthSnapshot. Frontend code reading
    // `site.metadata?.healthBreakdown.{components,timestamp}` is rewritten to
    // read `site.healthSnapshot.{componentsJson,computedAt}`.
    const healthSnapshot = await this.prisma.siteHealthSnapshot.findUnique({
      where: { siteId: id },
    });

    // ADR-018 cible D — load contacts (table relation) + emplacements (typed 1:N).
    const [contactsOnSite, emplacements] = await Promise.all([
      this.prisma.contact.findMany({
        where: { siteId: id, tenantId, isActive: true },
        // `type` porte la category (INTERNAL/PROVIDER/...) — sans cet include,
        // le frontend retombe sur une heuristique (company => externe) qui
        // classe les contacts internes dans "Contacts externes".
        include: {
          type: {
            select: { id: true, name: true, slug: true, category: true, color: true, icon: true },
          },
        },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.siteEmplacement.findMany({
        where: { siteId: id },
        orderBy: { order: 'asc' },
      }),
    ]);

    // Backward-compat computed `connectivity` object so existing frontend code
    // (FloorPlanViewer NRO pins, export-site, sites list) that reads
    // `site.connectivity.primary.provider` etc. keeps working against the
    // new table-based source. Phase 6.5: JSON column dropped, this computed
    // shape is the only live source.
    const primary = connectivityLinks.find((l: any) => l.role === 'PRIMARY');
    const backup = connectivityLinks.find((l: any) => l.role === 'BACKUP');
    const computedConnectivity = {
      primary: primary
        ? { type: primary.type, provider: primary.provider, ref: primary.contractRef || primary.publicIp || null }
        : null,
      backup: backup
        ? { type: backup.type, provider: backup.provider, ref: backup.contractRef || backup.publicIp || null }
        : null,
      links: connectivityLinks.map((l: any) => ({
        id: l.id,
        role: l.role === 'PRIMARY' ? 'primary' : 'backup',
        type: l.type,
        provider: l.provider,
        ref: l.contractRef || l.publicIp,
        bandwidth: l.bandwidthDown ? `${l.bandwidthDown}${l.bandwidthUp ? `/${l.bandwidthUp}` : ''} Mbps` : undefined,
        // monitorName + status removed in ADR-016 — read MonitorCheck.lastStatus
        // via the link.monitorChecks relation instead.
      })),
      cutProcedure: site.cutProcedure,
    };

    // Transform counts and org info to match structured format
    return {
      ...site,
      delegation: site.delegation_id ? {
        id: site.delegation_id,
        name: site.delegation_name,
        code: site.delegation_code,
        groupLabel: site.delegation_groupLabel,
        groupColor: site.delegation_groupColor,
      } : null,
      connectivityLinks,
      connectivity: computedConnectivity,
      healthSnapshot,
      // ADR-018 cible D — typed relations replace former JSON columns.
      contactsOnSite,
      emplacements,
      _count: {
        assets: Number(site._count_assets) || 0,
        racks: Number(site._count_racks) || 0,
        tasks: Number(site._count_tasks) || 0,
      },
      _count_assets: undefined,
      _count_racks: undefined,
      _count_tasks: undefined,
      delegation_id: undefined,
      delegation_name: undefined,
      delegation_code: undefined,
      delegation_groupLabel: undefined,
      delegation_groupColor: undefined,
    };
  }

  async update(id: string, tenantId: string, updateSiteDto: UpdateSiteDto, userId?: string, callerCtx?: CallerCtx) {
    // ADR-021 — write access check before mutation.
    if (callerCtx) {
      await this.perm.assertCanWriteSite(callerCtx, id);
    }
    // Track E.1 BOLA fix — scope by tenantId so super-admin bypass cannot
    // cross-tenant mutate via known site id (NotFound, not Forbidden, mirrors
    // v2.3.1 restoreFullBackupV2 pattern; cf XCH_BOLA_PATTERN_CHECK).
    const before = await this.prisma.site.findFirst({ where: { id, tenantId } });
    if (!before) {
      throw new NotFoundException();
    }

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

    // Notification: site status changed
    if (updateSiteDto.status && updateSiteDto.status !== before.status) {
      const actor = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }) : undefined;
      this.notificationEmitter.siteStatusChanged({
        tenantId,
        site: { id: updated.id, name: updated.name, delegationId: updated.delegationId },
        oldStatus: before.status,
        newStatus: updateSiteDto.status,
        actor: actor || undefined,
      }).catch((e) => this.logger.warn(`Notification failed: ${e.message}`));
    }

    // ADR-016 — auto-disable monitor checks when the site moves to CLOSED
    // (cascade through siteId direct + asset.siteId + link.siteId).
    let disabledMonitorCount = 0;
    if (updateSiteDto.status && updateSiteDto.status !== before.status) {
      const r = await this.monitorReactions
        .onSiteStatusChange(tenantId, id, before.status, updateSiteDto.status, userId)
        .catch((e) => {
          this.logger.warn(`monitor auto-disable failed for site ${id}: ${e.message}`);
          return { disabledCount: 0 };
        });
      disabledMonitorCount = r.disabledCount;
    }

    return { ...updated, disabledMonitorCount };
  }

  async remove(id: string, tenantId: string, userId?: string, callerCtx?: CallerCtx) {
    // ADR-021 — write access check before deletion.
    if (callerCtx) {
      await this.perm.assertCanWriteSite(callerCtx, id);
    }
    const site = await this.findOne(id, tenantId);

    // Dependency protection: refuse deletion if the site contains active data
    const [assets, racks, tasks, plans] = await Promise.all([
      this.prisma.asset.count({ where: { siteId: id, tenantId } }),
      this.prisma.rack.count({ where: { siteId: id, tenantId } }),
      this.prisma.task.count({ where: { siteId: id, tenantId } }),
      this.prisma.floorPlan.count({ where: { siteId: id } }),
    ]);
    const total = assets + racks + tasks + plans;
    if (total > 0) {
      throw new ConflictException(
        `Impossible de supprimer le site : ${assets} équipement(s), ${racks} baie(s), ${tasks} tâche(s), ${plans} plan(s) rattaché(s). Déplacez-les ou supprimez-les d'abord.`,
      );
    }

    // ---- Best-effort MinIO cleanup before DB deletion ----
    try {
      await this.cleanupSiteFiles(id, tenantId);
    } catch (error) {
      this.logger.error(`Failed to clean up storage files for site ${id}, proceeding with DB deletion`, error);
    }

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

  /**
   * Clean up all MinIO files associated with a site and its children
   * (attachments for site/assets/racks/tasks + floor plan images).
   * Best-effort: errors are logged but do not prevent deletion.
   */
  private async cleanupSiteFiles(siteId: string, tenantId: string): Promise<void> {
    // Collect child entity IDs for attachment lookups
    const [assets, racks, tasks] = await Promise.all([
      this.prisma.asset.findMany({ where: { siteId, tenantId }, select: { id: true } }),
      this.prisma.rack.findMany({ where: { siteId, tenantId }, select: { id: true } }),
      this.prisma.task.findMany({ where: { siteId, tenantId }, select: { id: true } }),
    ]);
    const assetIds = assets.map(a => a.id);
    const rackIds = racks.map(r => r.id);
    const taskIds = tasks.map(t => t.id);

    // 1. Delete all attachment files tracked in the DB for this site and its children
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
      select: { path: true },
    });

    for (const attachment of attachments) {
      try {
        await this.storageService.deleteFile(attachment.path);
      } catch (error) {
        this.logger.error(`Failed to delete attachment file: ${attachment.path}`, error);
      }
    }

    if (attachments.length > 0) {
      this.logger.log(`Cleaned up ${attachments.length} attachment files for site ${siteId}`);
    }

    // 2. Delete floor plan image files
    const floorPlans = await this.prisma.floorPlan.findMany({
      where: { siteId },
      select: { id: true, fileUrl: true },
    });

    for (const plan of floorPlans) {
      if (plan.fileUrl) {
        try {
          await this.storageService.deleteByPrefix(`floor-plans/plan-${plan.id}`);
        } catch (error) {
          this.logger.error(`Failed to delete floor plan files for plan ${plan.id}`, error);
        }
      }
    }

    if (floorPlans.length > 0) {
      this.logger.log(`Cleaned up files for ${floorPlans.length} floor plans on site ${siteId}`);
    }

    // 3. Clean up entire attachment folder prefixes for this site's entities
    // This catches any orphaned files not tracked in the DB
    try {
      await this.storageService.deleteByPrefix(`attachments/${tenantId}/sites/${siteId}`);
    } catch (error) {
      this.logger.error(`Failed to delete site attachment prefix for site ${siteId}`, error);
    }

    for (const asset of assets) {
      try {
        await this.storageService.deleteByPrefix(`attachments/${tenantId}/assets/${asset.id}`);
      } catch (error) {
        this.logger.error(`Failed to delete asset attachment prefix for asset ${asset.id}`, error);
      }
    }

    for (const rack of racks) {
      try {
        await this.storageService.deleteByPrefix(`attachments/${tenantId}/racks/${rack.id}`);
      } catch (error) {
        this.logger.error(`Failed to delete rack attachment prefix for rack ${rack.id}`, error);
      }
    }
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

    // S1-closing (ADR-016 lot M) — magic-bytes defense in depth.
    validateMagicBytesForMimetype(file.buffer, file.mimetype);

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
