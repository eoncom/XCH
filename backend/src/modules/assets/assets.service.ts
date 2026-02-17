import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { QRCodeService } from '../../common/services/qrcode.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/services/storage.service';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);
  private readonly SERIAL_REQUIRED_TYPES = ['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'TEAMS_ROOM'];

  constructor(
    private prisma: PrismaClient,
    private qrCodeService: QRCodeService,
    private configService: ConfigService,
    private storageService: StorageService,
  ) {}

  async create(tenantId: string, createAssetDto: CreateAssetDto, userId?: string) {
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

    const asset = await this.prisma.asset.create({
      data: {
        ...createAssetDto,
        tenantId,
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

    return asset;
  }

  async findAll(tenantId: string, filter?: FilterAssetDto, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };

    // Site access filtering: restrict to accessible sites for TECHNICIEN/VIEWER
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
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
      if (accessibleSiteIds && !accessibleSiteIds.includes(filter.siteId)) return [];
      where.siteId = filter.siteId;
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

    const assets = await this.prisma.asset.findMany({
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
        updatedAt: 'desc',
      },
    });

    return assets;
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

    // Validate serial number if type is being changed to critical type
    if (updateAssetDto.type && this.SERIAL_REQUIRED_TYPES.includes(updateAssetDto.type)) {
      if (!currentAsset.serialNumber && !updateAssetDto.serialNumber) {
        throw new BadRequestException(
          `Serial number is required for asset type: ${updateAssetDto.type}`,
        );
      }
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: updateAssetDto,
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

    return asset;
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

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    await this.prisma.asset.delete({
      where: { id },
    });

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
