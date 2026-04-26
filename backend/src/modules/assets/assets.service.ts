import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as Papa from 'papaparse';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { BatchUpdateAssetsDto } from './dto/batch-update-asset.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { ImportResultDto } from './dto/import-asset.dto';
import { QRCodeService } from '../../common/services/qrcode.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/services/storage.service';
import { validateMagicBytesForMimetype } from '../../common/utils/upload-security';
import { AuditLogService } from '../../common/services/audit-log.service';
import { NotificationEmitter } from '../notifications/notification-emitter';
import { MonitorReactionsService } from '../monitoring/monitor-reactions.service';
import { createId } from '@paralleldrive/cuid2';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);
  private readonly SERIAL_REQUIRED_TYPES = ['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'TEAMS_ROOM'];

  constructor(
    private prisma: PrismaClient,
    private qrCodeService: QRCodeService,
    private configService: ConfigService,
    private storageService: StorageService,
    private auditLogService: AuditLogService,
    private notificationEmitter: NotificationEmitter,
    private monitorReactions: MonitorReactionsService,
  ) {}

  /**
   * Validate a dynamic enum value for this tenant.
   * Accepts built-in values OR tenant-specific active EnumLabel entries (isActive=true, isHidden=false).
   * Throws BadRequestException if the value is not valid.
   */
  private async validateDynamicEnum(
    tenantId: string,
    enumType: 'AssetType' | 'AssetStatus',
    value: string | undefined,
  ): Promise<void> {
    if (value === undefined) return;
    const builtIns =
      enumType === 'AssetType' ? AssetsService.KNOWN_ASSET_TYPES : AssetsService.KNOWN_ASSET_STATUSES;
    if (builtIns.has(value)) return;
    // Check tenant custom values
    const custom = await this.prisma.enumLabel.findUnique({
      where: {
        tenantId_enumType_enumValue: { tenantId, enumType, enumValue: value },
      },
      select: { isActive: true, isHidden: true },
    });
    if (custom && custom.isActive && !custom.isHidden) return;
    throw new BadRequestException(
      `Invalid ${enumType} "${value}". Use an allowed value (see /api/admin/enum-labels?enumType=${enumType}).`,
    );
  }

  async create(tenantId: string, createAssetDto: CreateAssetDto, userId?: string) {
    // Validate dynamic enums (type required, status optional with default)
    await this.validateDynamicEnum(tenantId, 'AssetType', createAssetDto.type);
    await this.validateDynamicEnum(tenantId, 'AssetStatus', createAssetDto.status);

    // Validate serial number for critical types
    if (this.SERIAL_REQUIRED_TYPES.includes(createAssetDto.type) && !createAssetDto.serialNumber) {
      throw new BadRequestException(
        `Serial number is required for asset type: ${createAssetDto.type}`,
      );
    }

    // Check unique serial number if provided
    if (createAssetDto.serialNumber) {
      const existing = await this.prisma.asset.findFirst({
        where: {
          tenantId,
          serialNumber: createAssetDto.serialNumber,
        },
      });

      if (existing) {
        throw new ConflictException('Asset with this serial number already exists');
      }
    }

    // Resolve delegationId. Priority:
    //   1. explicit delegationId in payload
    //   2. derived from siteId
    //   3. null (asset is unassigned — stored/removed)
    let delegationId: string | null = (createAssetDto as any).delegationId ?? null;
    if (!delegationId && createAssetDto.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: createAssetDto.siteId },
        select: { delegationId: true },
      });
      delegationId = site?.delegationId ?? null;
    }
    // If both siteId and delegationId are present, ensure the site belongs to the delegation
    if (delegationId && createAssetDto.siteId) {
      const site = await this.prisma.site.findUnique({
        where: { id: createAssetDto.siteId },
        select: { delegationId: true },
      });
      if (site && site.delegationId !== delegationId) {
        throw new ConflictException('Site does not belong to the specified delegation');
      }
    }

    const asset = await this.prisma.asset.create({
      data: {
        ...createAssetDto,
        tenantId,
        delegationId: delegationId ?? undefined,
      },
      include: {
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        rack: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Log creation movement
    try {
      await this.prisma.assetMovement.create({
        data: {
          tenantId,
          assetId: asset.id,
          userId: userId || null,
          type: 'CREATED',
          toSiteId: asset.siteId || null,
          toRackId: asset.rackId || null,
          toRackPositionU: asset.rackPositionU || null,
          toStatus: asset.status,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to log CREATED movement for asset ${asset.id}: ${e.message}`);
    }

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'CREATE',
        entityType: 'asset',
        entityId: asset.id,
        changes: { after: { type: asset.type, status: asset.status, serialNumber: asset.serialNumber, siteId: asset.siteId, model: asset.model, manufacturer: asset.manufacturer } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for asset ${asset.id}: ${e.message}`);
    }

    return asset;
  }

  async findAll(tenantId: string, filter?: FilterAssetDto, accessibleSiteIds?: string[] | null): Promise<PaginatedResponse<any>> {
    const page = filter?.page ?? 1;
    const pageSize = filter?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };

    // Site access filtering: restrict to accessible sites for TECHNICIEN/VIEWER
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return buildPaginatedResponse([], 0, page, pageSize);
      where.siteId = { in: accessibleSiteIds };
    }

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.siteId) {
      // Override with specific siteId filter (already validated by site access if array)
      if (accessibleSiteIds && !accessibleSiteIds.includes(filter.siteId)) return buildPaginatedResponse([], 0, page, pageSize);
      where.siteId = filter.siteId;
    }

    if ((filter as any)?.delegationId) {
      where.delegationId = (filter as any).delegationId;
    }

    if ((filter as any)?.unassigned === 'true') {
      where.siteId = null;
      where.delegationId = null;
    }

    if (filter?.rackId) {
      where.rackId = filter.rackId;
    }

    if (filter?.withoutSerialNumber === 'true') {
      where.serialNumber = null;
    }

    if (filter?.withoutLocation === 'true') {
      where.AND = [
        { locationText: null },
        { rackId: null },
      ];
    }

    if (filter?.search) {
      where.OR = [
        { model: { contains: filter.search, mode: 'insensitive' } },
        { serialNumber: { contains: filter.search, mode: 'insensitive' } },
        { manufacturer: { contains: filter.search, mode: 'insensitive' } },
        { inventoryTag: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Determine sort order (default: updatedAt desc)
    const allowedSortFields = ['updatedAt', 'createdAt', 'type', 'status', 'serialNumber', 'manufacturer', 'model'];
    const hasExplicitSort = filter?.sortBy && allowedSortFields.includes(filter.sortBy);
    const sortBy: string = hasExplicitSort ? filter.sortBy! : 'updatedAt';
    const sortOrder = hasExplicitSort ? (filter?.sortOrder ?? 'desc') : 'desc';

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          rack: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: pageSize,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return buildPaginatedResponse(assets, total, page, pageSize);
  }

  async findOne(id: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        site: true,
        rack: true,
        pins: {
          include: {
            floorPlan: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            description: true,
            dueDate: true,
            assignedUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        photos: true,
        externalRefs: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async update(id: string, tenantId: string, updateAssetDto: UpdateAssetDto, userId?: string) {
    // Get current state BEFORE update for movement tracking
    const currentAsset = await this.findOne(id, tenantId);

    // Validate dynamic enums if changed
    await this.validateDynamicEnum(tenantId, 'AssetType', updateAssetDto.type);
    await this.validateDynamicEnum(tenantId, 'AssetStatus', updateAssetDto.status);

    // Validate serial number if type is being changed to critical type
    if (updateAssetDto.type && this.SERIAL_REQUIRED_TYPES.includes(updateAssetDto.type)) {
      if (!currentAsset.serialNumber && !updateAssetDto.serialNumber) {
        throw new BadRequestException(
          `Serial number is required for asset type: ${updateAssetDto.type}`,
        );
      }
    }

    // Resolve delegationId on update — keep site/delegation in sync
    const updateData: any = { ...updateAssetDto };
    const hasSiteChange = Object.prototype.hasOwnProperty.call(updateAssetDto, 'siteId');
    const hasDelegationChange = Object.prototype.hasOwnProperty.call(updateAssetDto, 'delegationId');
    if (hasSiteChange || hasDelegationChange) {
      let nextDelegationId: string | null | undefined;
      if (hasDelegationChange) {
        nextDelegationId = (updateAssetDto as any).delegationId || null;
      } else if (hasSiteChange) {
        if (updateAssetDto.siteId) {
          const site = await this.prisma.site.findUnique({
            where: { id: updateAssetDto.siteId },
            select: { delegationId: true },
          });
          nextDelegationId = site?.delegationId ?? null;
        } else {
          // siteId cleared and delegation not explicitly set → keep current delegation
          nextDelegationId = undefined;
        }
      }
      if (nextDelegationId !== undefined) {
        updateData.delegationId = nextDelegationId;
      }
      // Consistency check
      if (updateData.siteId && updateData.delegationId) {
        const site = await this.prisma.site.findUnique({
          where: { id: updateData.siteId },
          select: { delegationId: true },
        });
        if (site && site.delegationId !== updateData.delegationId) {
          throw new ConflictException('Site does not belong to the specified delegation');
        }
      }
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        site: true,
        rack: true,
      },
    });

    // Track movement history
    try {
      await this.trackMovements(tenantId, id, currentAsset, asset, userId);
    } catch (e) {
      this.logger.warn(`Failed to log movement for asset ${id}: ${e.message}`);
    }

    // Audit log with diff
    try {
      const changes = this.auditLogService.diffChanges(
        currentAsset as Record<string, any>,
        updateAssetDto as Record<string, any>,
      );
      if (changes) {
        await this.auditLogService.log({
          tenantId,
          userId,
          action: 'UPDATE',
          entityType: 'asset',
          entityId: id,
          changes,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to write audit log for asset ${id}: ${e.message}`);
    }

    // Notification: asset goes OUT_OF_SERVICE
    if (updateAssetDto.status === 'OUT_OF_SERVICE' && currentAsset.status !== 'OUT_OF_SERVICE') {
      const actor = userId ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }) : undefined;
      const assetName = (asset as any).hostname || asset.serialNumber || asset.model || `${asset.type} #${asset.id.slice(-6)}`;
      this.notificationEmitter.assetCritical({
        tenantId,
        asset: { id: asset.id, name: assetName, type: asset.type, siteId: asset.siteId || undefined },
        reason: 'Passage en statut Hors Service',
        actor: actor || undefined,
      }).catch((e) => this.logger.warn(`Notification failed: ${e.message}`));
    }

    // ADR-016 — auto-disable monitor checks when the asset leaves IN_SERVICE.
    // Returns the count so the response includes it (frontend toasts it).
    let disabledMonitorCount = 0;
    if (updateAssetDto.status && updateAssetDto.status !== currentAsset.status) {
      const r = await this.monitorReactions
        .onAssetStatusChange(tenantId, id, currentAsset.status, updateAssetDto.status, userId)
        .catch((e) => {
          this.logger.warn(`monitor auto-disable failed for asset ${id}: ${e.message}`);
          return { disabledCount: 0 };
        });
      disabledMonitorCount = r.disabledCount;
    }

    return { ...asset, disabledMonitorCount };
  }

  async batchUpdate(tenantId: string, dto: BatchUpdateAssetsDto) {
    if (!dto.ids || dto.ids.length === 0) {
      throw new BadRequestException('At least one asset ID is required');
    }

    // Build the update data from provided fields
    const updateData: any = {};
    if (dto.status) updateData.status = dto.status;
    if (dto.siteId) updateData.siteId = dto.siteId;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('At least one field to update is required (status or siteId)');
    }

    // Validate all asset IDs belong to the tenant
    const count = await this.prisma.asset.count({
      where: {
        id: { in: dto.ids },
        tenantId,
      },
    });

    if (count !== dto.ids.length) {
      throw new BadRequestException(
        `Some asset IDs were not found or do not belong to this tenant (found ${count} of ${dto.ids.length})`,
      );
    }

    // If siteId is provided, validate it belongs to the tenant
    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, tenantId },
      });
      if (!site) {
        throw new BadRequestException(`Site ${dto.siteId} not found or does not belong to this tenant`);
      }
    }

    const result = await this.prisma.asset.updateMany({
      where: {
        id: { in: dto.ids },
        tenantId,
      },
      data: updateData,
    });

    return { updated: result.count };
  }

  /**
   * Detect and log all location/status changes between old and new asset state
   */
  private async trackMovements(
    tenantId: string,
    assetId: string,
    oldAsset: any,
    newAsset: any,
    userId?: string,
  ) {
    const movements: any[] = [];

    // Detect site change
    if (oldAsset.siteId !== newAsset.siteId) {
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'SITE_CHANGE',
        fromSiteId: oldAsset.siteId || null,
        toSiteId: newAsset.siteId || null,
      });
    }

    // Detect rack changes
    const oldRackId = oldAsset.rackId;
    const newRackId = newAsset.rackId;
    const oldPosition = oldAsset.rackPositionU;
    const newPosition = newAsset.rackPositionU;

    if (!oldRackId && newRackId) {
      // Mounted in rack
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'RACK_MOUNT',
        toRackId: newRackId,
        toRackPositionU: newPosition || null,
      });
    } else if (oldRackId && !newRackId) {
      // Unmounted from rack
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'RACK_UNMOUNT',
        fromRackId: oldRackId,
        fromRackPositionU: oldPosition || null,
      });
    } else if (oldRackId && newRackId && oldRackId !== newRackId) {
      // Changed rack
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'RACK_CHANGE',
        fromRackId: oldRackId,
        fromRackPositionU: oldPosition || null,
        toRackId: newRackId,
        toRackPositionU: newPosition || null,
      });
    } else if (oldRackId && newRackId && oldRackId === newRackId && oldPosition !== newPosition) {
      // Moved within same rack (position change)
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'RACK_MOVE',
        fromRackId: oldRackId,
        fromRackPositionU: oldPosition || null,
        toRackId: newRackId,
        toRackPositionU: newPosition || null,
      });
    }

    // Detect status change
    if (oldAsset.status !== newAsset.status) {
      movements.push({
        tenantId,
        assetId,
        userId: userId || null,
        type: 'STATUS_CHANGE',
        fromStatus: oldAsset.status,
        toStatus: newAsset.status,
      });
    }

    // Batch create all movements
    if (movements.length > 0) {
      await this.prisma.assetMovement.createMany({ data: movements });
    }
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const asset = await this.findOne(id, tenantId);

    // Best-effort cleanup of attachment files from storage
    try {
      const attachments = await this.prisma.attachment.findMany({
        where: { tenantId, assetId: id },
        select: { path: true },
      });

      for (const attachment of attachments) {
        try {
          await this.storageService.deleteFile(attachment.path);
        } catch (error) {
          this.logger.warn(`Failed to delete attachment file: ${attachment.path} - ${error.message}`);
        }
      }

      // Also clean up the entire folder prefix to catch any orphaned files
      await this.storageService.deleteByPrefix(`attachments/${tenantId}/assets/${id}`);

      if (attachments.length > 0) {
        this.logger.log(`Cleaned up ${attachments.length} attachment files for asset ${id}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up storage files for asset ${id}, proceeding with DB deletion: ${error.message}`);
    }

    await this.prisma.asset.delete({
      where: { id },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'DELETE',
        entityType: 'asset',
        entityId: id,
        changes: { before: { type: asset.type, status: asset.status, serialNumber: asset.serialNumber, siteId: asset.siteId, model: asset.model } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for asset ${id}: ${e.message}`);
    }

    return { message: 'Asset deleted successfully' };
  }

  async generateQRCode(id: string, tenantId: string) {
    const asset = await this.findOne(id, tenantId);

    const token = this.qrCodeService.generateSecureToken();
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || this.configService.get<string>('APP_URL') || 'http://localhost:3001';
    const qrUrl = this.qrCodeService.generateAssetQRUrl(frontendUrl, asset.id, token);

    const qrCodeDataUrl = await this.qrCodeService.generateQRCode(qrUrl);

    // Persist QR code in database
    await this.prisma.asset.update({
      where: { id },
      data: {
        qrCodeUrl: qrCodeDataUrl,
        qrCodeToken: token,
      },
    });

    return {
      assetId: asset.id,
      qrCodeDataUrl,
      qrUrl,
      token,
    };
  }

  async bulkGenerateQRCodes(assetIds: string[], tenantId: string) {
    const qrCodes = [];

    for (const assetId of assetIds) {
      try {
        const qrCode = await this.generateQRCode(assetId, tenantId);
        qrCodes.push(qrCode);
      } catch (error) {
        qrCodes.push({
          assetId,
          error: error.message,
        });
      }
    }

    return qrCodes;
  }

  // ============================================================================
  // CSV IMPORT
  // ============================================================================

  /**
   * Header mapping: supports English and French column names.
   * Keys are lowercased, trimmed header names. Values are the canonical field names.
   */
  private static readonly HEADER_MAP: Record<string, string> = {
    type: 'type',
    statut: 'status',
    status: 'status',
    nom: 'name',
    name: 'name',
    'numéro_série': 'serialNumber',
    numero_serie: 'serialNumber',
    serial_number: 'serialNumber',
    serialnumber: 'serialNumber',
    fabricant: 'manufacturer',
    manufacturer: 'manufacturer',
    'modèle': 'model',
    modele: 'model',
    model: 'model',
    site: 'siteId',
    siteid: 'siteId',
    emplacement: 'location',
    location: 'location',
    ip: 'ipAddress',
    ipaddress: 'ipAddress',
    ip_address: 'ipAddress',
    mac: 'macAddress',
    macaddress: 'macAddress',
    mac_address: 'macAddress',
    firmware: 'firmwareVersion',
    firmwareversion: 'firmwareVersion',
    firmware_version: 'firmwareVersion',
    garantie: 'warrantyEnd',
    warrantyend: 'warrantyEnd',
    warranty_end: 'warrantyEnd',
    achat: 'purchaseDate',
    purchasedate: 'purchaseDate',
    purchase_date: 'purchaseDate',
    notes: 'notes',
  };

  // Known built-in asset types and statuses (for CSV import validation)
  // These are also seeded into EnumLabel with isBuiltIn=true
  private static readonly KNOWN_ASSET_TYPES = new Set([
    'PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'ROUTER', 'WIFI_AP',
    'TEAMS_ROOM', 'WEBCAM', 'DISPLAY', 'CAMERA', 'SERVER', 'CABLE',
    'PATCH_PANEL', 'PDU', 'BOX_5G', 'OTHER',
  ]);
  private static readonly KNOWN_ASSET_STATUSES = new Set([
    'IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED',
  ]);

  /**
   * Import assets from CSV content.
   *
   * @param tenantId  Tenant ID from the authenticated user
   * @param csvContent  Raw CSV string (may include BOM)
   * @param siteId  Optional override: all imported rows will be assigned to this site
   */
  async importFromCsv(
    tenantId: string,
    csvContent: string,
    siteId?: string,
  ): Promise<ImportResultDto> {
    // Strip BOM if present
    const cleanCsv = csvContent.replace(/^\uFEFF/, '');

    const parsed = Papa.parse(cleanCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new BadRequestException(
        `CSV parsing failed: ${parsed.errors.map((e) => e.message).join(', ')}`,
      );
    }

    const errors: ImportResultDto['errors'] = [];
    const validRows: any[] = [];

    // If siteId override is provided, verify it belongs to the tenant
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, tenantId },
      });
      if (!site) {
        throw new BadRequestException(
          `Site ${siteId} not found or does not belong to this tenant`,
        );
      }
    }

    // Cache site lookups by code for rows that reference a site by code
    const siteCodeCache = new Map<string, string | null>();

    for (let i = 0; i < parsed.data.length; i++) {
      const rawRow = parsed.data[i] as Record<string, string>;
      const rowNum = i + 2; // +2 because row 1 is the header, data starts at row 2

      // Map headers to canonical field names
      const mapped: Record<string, string> = {};
      for (const [rawHeader, value] of Object.entries(rawRow)) {
        const key = rawHeader.toLowerCase().trim();
        const canonical = AssetsService.HEADER_MAP[key];
        if (canonical && value !== undefined && value !== null && value.trim() !== '') {
          mapped[canonical] = value.trim();
        }
      }

      // --- Validate type (required) ---
      if (!mapped.type) {
        errors.push({ row: rowNum, field: 'type', message: 'Type is required' });
        continue;
      }
      const typeUpper = mapped.type.toUpperCase();
      if (!AssetsService.KNOWN_ASSET_TYPES.has(typeUpper)) {
        // Accept unknown types (could be custom via EnumLabel) but warn
        this.logger.warn(`CSV import row ${rowNum}: type "${typeUpper}" is not a built-in type`);
      }

      // --- Validate status (optional, defaults to STOCK) ---
      let status = 'STOCK';
      if (mapped.status) {
        const statusUpper = mapped.status.toUpperCase();
        if (!AssetsService.KNOWN_ASSET_STATUSES.has(statusUpper)) {
          errors.push({
            row: rowNum,
            field: 'status',
            message: `Invalid status "${mapped.status}". Valid values: ${[...AssetsService.KNOWN_ASSET_STATUSES].join(', ')}`,
          });
          continue;
        }
        status = statusUpper;
      }

      // --- Resolve siteId ---
      let resolvedSiteId: string | null = siteId || null;
      if (!resolvedSiteId && mapped.siteId) {
        // Try to resolve: could be an ID or a site code
        const siteValue = mapped.siteId;
        // Check cache first
        if (siteCodeCache.has(siteValue)) {
          resolvedSiteId = siteCodeCache.get(siteValue) || null;
        } else {
          // Try as ID first
          let site = await this.prisma.site.findFirst({
            where: { id: siteValue, tenantId },
          });
          if (!site) {
            // Try as code
            site = await this.prisma.site.findFirst({
              where: { code: siteValue, tenantId },
            });
          }
          if (site) {
            siteCodeCache.set(siteValue, site.id);
            resolvedSiteId = site.id;
          } else {
            siteCodeCache.set(siteValue, null);
            errors.push({
              row: rowNum,
              field: 'siteId',
              message: `Site "${siteValue}" not found in this tenant`,
            });
            continue;
          }
        }
      }

      // --- Validate date fields ---
      let purchaseDate: Date | undefined;
      if (mapped.purchaseDate) {
        const d = new Date(mapped.purchaseDate);
        if (isNaN(d.getTime())) {
          errors.push({ row: rowNum, field: 'purchaseDate', message: `Invalid date "${mapped.purchaseDate}"` });
          continue;
        }
        purchaseDate = d;
      }

      let warrantyEnd: Date | undefined;
      if (mapped.warrantyEnd) {
        const d = new Date(mapped.warrantyEnd);
        if (isNaN(d.getTime())) {
          errors.push({ row: rowNum, field: 'warrantyEnd', message: `Invalid date "${mapped.warrantyEnd}"` });
          continue;
        }
        warrantyEnd = d;
      }

      // Build networkInfo if IP or MAC provided
      let networkInfo: any = undefined;
      if (mapped.ipAddress || mapped.macAddress || mapped.firmwareVersion) {
        networkInfo = {};
        if (mapped.ipAddress) networkInfo.ip = mapped.ipAddress;
        if (mapped.macAddress) networkInfo.mac = mapped.macAddress;
        if (mapped.firmwareVersion) networkInfo.firmware = mapped.firmwareVersion;
      }

      validRows.push({
        tenantId,
        type: typeUpper,
        status,
        name: mapped.name || null,
        serialNumber: mapped.serialNumber || null,
        manufacturer: mapped.manufacturer || null,
        model: mapped.model || null,
        siteId: resolvedSiteId,
        locationText: mapped.location || null,
        networkInfo: networkInfo || undefined,
        purchaseDate: purchaseDate || undefined,
        warrantyEnd: warrantyEnd || undefined,
        notes: mapped.notes || null,
      });
    }

    // Batch create valid rows
    let importedCount = 0;
    if (validRows.length > 0) {
      // Use individual creates for better error handling (serial uniqueness, etc.)
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await this.prisma.asset.create({ data: row });
          importedCount++;
        } catch (e) {
          // Find the original CSV row number for this valid row
          // Since we skipped error rows, we need to track the row index
          const message = e.message || 'Database error';
          const isUnique = message.includes('Unique constraint');
          errors.push({
            row: 0, // row number is approximate in batch context
            field: isUnique ? 'serialNumber' : 'unknown',
            message: isUnique
              ? `Duplicate serial number "${row.serialNumber}"`
              : `Failed to create asset: ${message}`,
          });
        }
      }
    }

    return {
      total: parsed.data.length,
      imported: importedCount,
      errors,
    };
  }

  /**
   * Parse CSV and return both valid rows (ready to insert) and invalid rows (with errors).
   * Does NOT write to database — for the import preview UI.
   */
  async previewImportFromCsv(
    tenantId: string,
    csvContent: string,
    siteId?: string,
  ): Promise<{
    total: number;
    validRows: Array<{ row: number; data: any }>;
    invalidRows: Array<{ row: number; data: Record<string, string>; errors: Array<{ field: string; message: string }> }>;
  }> {
    const cleanCsv = csvContent.replace(/^\uFEFF/, '');
    const parsed = Papa.parse(cleanCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new BadRequestException(
        `CSV parsing failed: ${parsed.errors.map((e) => e.message).join(', ')}`,
      );
    }

    // Validate override site
    if (siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, tenantId },
      });
      if (!site) {
        throw new BadRequestException(
          `Site ${siteId} not found or does not belong to this tenant`,
        );
      }
    }

    const validRows: Array<{ row: number; data: any }> = [];
    const invalidRows: Array<{ row: number; data: Record<string, string>; errors: Array<{ field: string; message: string }> }> = [];
    const siteCodeCache = new Map<string, string | null>();

    for (let i = 0; i < parsed.data.length; i++) {
      const rawRow = parsed.data[i] as Record<string, string>;
      const rowNum = i + 2;
      const rowErrors: Array<{ field: string; message: string }> = [];

      const mapped: Record<string, string> = {};
      for (const [rawHeader, value] of Object.entries(rawRow)) {
        const key = rawHeader.toLowerCase().trim();
        const canonical = AssetsService.HEADER_MAP[key];
        if (canonical && value !== undefined && value !== null && String(value).trim() !== '') {
          mapped[canonical] = String(value).trim();
        }
      }

      if (!mapped.type) {
        rowErrors.push({ field: 'type', message: 'Type is required' });
      }
      const typeUpper = mapped.type ? mapped.type.toUpperCase() : '';

      let status = 'STOCK';
      if (mapped.status) {
        const statusUpper = mapped.status.toUpperCase();
        if (!AssetsService.KNOWN_ASSET_STATUSES.has(statusUpper)) {
          rowErrors.push({
            field: 'status',
            message: `Invalid status "${mapped.status}". Valid: ${[...AssetsService.KNOWN_ASSET_STATUSES].join(', ')}`,
          });
        } else {
          status = statusUpper;
        }
      }

      let resolvedSiteId: string | null = siteId || null;
      if (!resolvedSiteId && mapped.siteId) {
        const siteValue = mapped.siteId;
        if (siteCodeCache.has(siteValue)) {
          resolvedSiteId = siteCodeCache.get(siteValue) || null;
          if (!resolvedSiteId) {
            rowErrors.push({ field: 'siteId', message: `Site "${siteValue}" not found` });
          }
        } else {
          let site = await this.prisma.site.findFirst({ where: { id: siteValue, tenantId } });
          if (!site) {
            site = await this.prisma.site.findFirst({ where: { code: siteValue, tenantId } });
          }
          if (site) {
            siteCodeCache.set(siteValue, site.id);
            resolvedSiteId = site.id;
          } else {
            siteCodeCache.set(siteValue, null);
            rowErrors.push({ field: 'siteId', message: `Site "${siteValue}" not found` });
          }
        }
      }

      let purchaseDate: Date | undefined;
      if (mapped.purchaseDate) {
        const d = new Date(mapped.purchaseDate);
        if (isNaN(d.getTime())) {
          rowErrors.push({ field: 'purchaseDate', message: `Invalid date "${mapped.purchaseDate}"` });
        } else {
          purchaseDate = d;
        }
      }

      let warrantyEnd: Date | undefined;
      if (mapped.warrantyEnd) {
        const d = new Date(mapped.warrantyEnd);
        if (isNaN(d.getTime())) {
          rowErrors.push({ field: 'warrantyEnd', message: `Invalid date "${mapped.warrantyEnd}"` });
        } else {
          warrantyEnd = d;
        }
      }

      // Check duplicate serial (future: this might exist in DB)
      if (mapped.serialNumber) {
        const existing = await this.prisma.asset.findFirst({
          where: { tenantId, serialNumber: mapped.serialNumber },
          select: { id: true },
        });
        if (existing) {
          rowErrors.push({
            field: 'serialNumber',
            message: `Duplicate serial "${mapped.serialNumber}" already exists`,
          });
        }
      }

      let networkInfo: any = undefined;
      if (mapped.ipAddress || mapped.macAddress || mapped.firmwareVersion) {
        networkInfo = {};
        if (mapped.ipAddress) networkInfo.ip = mapped.ipAddress;
        if (mapped.macAddress) networkInfo.mac = mapped.macAddress;
        if (mapped.firmwareVersion) networkInfo.firmware = mapped.firmwareVersion;
      }

      if (rowErrors.length > 0) {
        invalidRows.push({ row: rowNum, data: mapped, errors: rowErrors });
      } else {
        validRows.push({
          row: rowNum,
          data: {
            tenantId,
            type: typeUpper,
            status,
            name: mapped.name || null,
            serialNumber: mapped.serialNumber || null,
            manufacturer: mapped.manufacturer || null,
            model: mapped.model || null,
            siteId: resolvedSiteId,
            locationText: mapped.location || null,
            networkInfo: networkInfo || undefined,
            purchaseDate: purchaseDate || undefined,
            warrantyEnd: warrantyEnd || undefined,
            notes: mapped.notes || null,
          },
        });
      }
    }

    return {
      total: parsed.data.length,
      validRows,
      invalidRows,
    };
  }

  /**
   * Generate a CSV template for asset import.
   */
  getImportTemplate(): string {
    const headers = [
      'type',
      'status',
      'name',
      'serial_number',
      'manufacturer',
      'model',
      'site',
      'location',
      'ip_address',
      'mac_address',
      'firmware_version',
      'warranty_end',
      'purchase_date',
      'notes',
    ];
    const sample = [
      'SWITCH',
      'IN_SERVICE',
      'Switch Cisco 9300 Etage 2',
      'FOC1234ABCD',
      'Cisco',
      'C9300-48P',
      'SITE-PARIS-01',
      'Baie A - U10',
      '10.0.1.20',
      'AA:BB:CC:DD:EE:FF',
      '17.3.5',
      '2028-06-30',
      '2024-06-30',
      'Switch coeur de réseau',
    ];
    return [headers.join(','), sample.map((s) => `"${s.replace(/"/g, '""')}"`).join(',')].join('\r\n') + '\r\n';
  }

  async getStatsByType(tenantId: string, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      where.siteId = { in: accessibleSiteIds };
    }

    const stats = await this.prisma.asset.groupBy({
      by: ['type'],
      where,
      _count: {
        type: true,
      },
    });

    return stats;
  }

  async getStatsBySite(tenantId: string, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      where.siteId = { in: accessibleSiteIds };
    }

    const stats = await this.prisma.asset.groupBy({
      by: ['siteId'],
      where,
      _count: {
        siteId: true,
      },
    });

    const sitesData = await this.prisma.site.findMany({
      where: {
        id: {
          in: stats.map(s => s.siteId).filter((id): id is string => id !== null),
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return stats.map(stat => ({
      siteId: stat.siteId,
      count: stat._count.siteId,
      site: sitesData.find(s => s.id === stat.siteId),
    }));
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async uploadAttachment(
    assetId: string,
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadAttachmentDto,
  ) {
    // Verify asset exists
    await this.findOne(assetId, tenantId);

    // S1-closing 2026-04-26 — magic-bytes : pour les mimetypes connus
    // (PDF, image, ZIP, Office moderne) on valide la signature du buffer
    // avant de pousser sur MinIO. Pour les types text-based (csv/txt) ou
    // Office legacy non couverts, le helper est silencieux et on retombe
    // sur le check mimetype + extension du attachmentFileFilter.
    validateMagicBytesForMimetype(file.buffer, file.mimetype);

    // Generate unique filename
    const filename = this.storageService.generateFilename(file.originalname, 'attachment');
    const folder = `attachments/${tenantId}/assets/${assetId}`;

    // Upload to storage
    const filePath = await this.storageService.uploadFile(file, folder, filename);

    // Create database entry
    const attachment = await this.prisma.attachment.create({
      data: {
        id: createId(),
        tenantId,
        assetId,
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

    // Get file URL
    const url = this.storageService.getFileUrl(filePath);

    return {
      ...attachment,
      url,
    };
  }

  async listAttachments(assetId: string, tenantId: string) {
    // Verify asset exists
    await this.findOne(assetId, tenantId);

    const attachments = await this.prisma.attachment.findMany({
      where: {
        tenantId,
        assetId,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    // Add URLs to all attachments
    const attachmentsWithUrls = attachments.map((attachment) => ({
      ...attachment,
      url: this.storageService.getFileUrl(attachment.path),
    }));

    return attachmentsWithUrls;
  }

  async deleteAttachment(attachmentId: string, tenantId: string, assetId: string) {
    // Verify attachment exists and belongs to tenant/asset
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        tenantId,
        assetId,
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete from storage
    await this.storageService.deleteFile(attachment.path);

    // Delete from database
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    return { message: 'Attachment deleted successfully' };
  }

  // ============================================================================
  // MOVEMENT HISTORY
  // ============================================================================

  async getMovementHistory(assetId: string, tenantId: string) {
    // Verify asset exists
    await this.findOne(assetId, tenantId);

    const movements = await this.prisma.assetMovement.findMany({
      where: {
        assetId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        fromSite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        toSite: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        fromRack: {
          select: {
            id: true,
            name: true,
          },
        },
        toRack: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return movements;
  }
}
