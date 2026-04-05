import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { MountEquipmentDto } from './dto/mount-equipment.dto';
import { FilterRackDto } from './dto/filter-rack.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { StorageService } from '../../common/services/storage.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class RacksService {
  private readonly logger = new Logger(RacksService.name);

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private auditLogService: AuditLogService,
  ) {}

  async create(tenantId: string, createRackDto: CreateRackDto, userId?: string) {
    const existing = await this.prisma.rack.findFirst({
      where: {
        tenantId,
        siteId: createRackDto.siteId,
        name: createRackDto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Rack with this name already exists on this site');
    }

    const rack = await this.prisma.rack.create({
      data: {
        ...createRackDto,
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
      },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'CREATE',
        entityType: 'rack',
        entityId: rack.id,
        changes: { after: { name: rack.name, siteId: rack.siteId, heightU: rack.heightU, rackType: rack.rackType, location: rack.location } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for rack ${rack.id}: ${e.message}`);
    }

    return rack;
  }

  async findAll(tenantId: string, filters: FilterRackDto = {}, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };

    // Site access filtering
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return buildPaginatedResponse([], 0, filters.page ?? 1, filters.pageSize ?? 25);
      where.siteId = { in: accessibleSiteIds };
    }

    if (filters.siteId) {
      if (accessibleSiteIds && !accessibleSiteIds.includes(filters.siteId)) return buildPaginatedResponse([], 0, filters.page ?? 1, filters.pageSize ?? 25);
      where.siteId = filters.siteId;
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const sortField = filters.sortBy === 'totalU' ? 'heightU' : (filters.sortBy || 'updatedAt');
    const sortOrder = filters.sortOrder || 'desc';

    const [racks, total] = await Promise.all([
      this.prisma.rack.findMany({
        where,
        include: {
          site: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          assets: {
            select: {
              id: true,
              name: true,
              type: true,
              manufacturer: true,
              model: true,
              serialNumber: true,
              status: true,
              rackHeightU: true,
              rackPositionU: true,
            },
          },
        },
        orderBy: {
          [sortField]: sortOrder,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.rack.count({ where }),
    ]);

    // Calculate occupation for each rack
    const data = racks.map(rack => {
      const usedU = rack.assets.reduce((sum, asset) => sum + (asset.rackHeightU || 0), 0);
      const freeU = rack.heightU - usedU;
      const occupationPercent = Math.round((usedU / rack.heightU) * 100);

      return {
        ...rack,
        occupation: {
          totalU: rack.heightU,
          usedU,
          freeU,
          percent: occupationPercent,
        },
        _count: {
          assets: rack.assets.length,
        },
      };
    });

    return buildPaginatedResponse(data, total, page, pageSize);
  }

  async findOne(id: string, tenantId: string) {
    const rack = await this.prisma.rack.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        site: true,
        assets: {
          orderBy: {
            rackPositionU: 'asc',
          },
          select: {
            id: true,
            type: true,
            manufacturer: true,
            model: true,
            serialNumber: true,
            rackPositionU: true,
            rackHeightU: true,
            rackNotes: true,
            status: true,
          },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Rack not found');
    }

    // Calculate occupation
    const totalU = rack.heightU;
    const usedU = rack.assets.reduce((sum: number, asset) => sum + (asset.rackHeightU || 0), 0);
    const freeU = totalU - usedU;
    const occupationPercent = (usedU / totalU) * 100;

    return {
      ...rack,
      occupation: {
        totalU,
        usedU,
        freeU,
        percent: Math.round(occupationPercent),
      },
    };
  }

  async update(id: string, tenantId: string, updateRackDto: UpdateRackDto, userId?: string) {
    const before = await this.prisma.rack.findFirst({ where: { id, tenantId } });
    if (!before) {
      throw new NotFoundException('Rack not found');
    }

    const rack = await this.prisma.rack.update({
      where: { id },
      data: updateRackDto,
      include: {
        site: true,
      },
    });

    // Audit log with diff
    try {
      const changes = this.auditLogService.diffChanges(
        before as Record<string, any>,
        updateRackDto as Record<string, any>,
      );
      if (changes) {
        await this.auditLogService.log({
          tenantId,
          userId,
          action: 'UPDATE',
          entityType: 'rack',
          entityId: id,
          changes,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to write audit log for rack ${id}: ${e.message}`);
    }

    return rack;
  }

  async remove(id: string, tenantId: string, userId?: string) {
    // Check if rack exists and has equipment
    const rack = await this.prisma.rack.findFirst({
      where: { id, tenantId },
      include: {
        assets: {
          select: { id: true },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Rack not found');
    }

    if (rack.assets && rack.assets.length > 0) {
      throw new BadRequestException('Cannot delete rack with mounted equipment. Unmount all equipment first.');
    }

    // Best-effort cleanup of attachment files from storage
    try {
      const attachments = await this.prisma.attachment.findMany({
        where: { tenantId, rackId: id },
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
      await this.storageService.deleteByPrefix(`attachments/${tenantId}/racks/${id}`);

      if (attachments.length > 0) {
        this.logger.log(`Cleaned up ${attachments.length} attachment files for rack ${id}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up storage files for rack ${id}, proceeding with DB deletion: ${error.message}`);
    }

    await this.prisma.rack.delete({
      where: { id },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'DELETE',
        entityType: 'rack',
        entityId: id,
        changes: { before: { name: rack.name, siteId: rack.siteId, heightU: rack.heightU } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for rack ${id}: ${e.message}`);
    }

    return { message: 'Rack deleted successfully' };
  }

  async mountEquipment(rackId: string, tenantId: string, mountDto: MountEquipmentDto, userId?: string) {
    // Get rack with assets for validation
    const rack = await this.prisma.rack.findFirst({
      where: { id: rackId, tenantId },
      include: {
        site: true,
        assets: {
          select: {
            id: true,
            model: true,
            rackPositionU: true,
            rackHeightU: true,
          },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Rack not found');
    }

    // Validate equipment belongs to same tenant and site
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: mountDto.assetId,
        tenantId,
        siteId: rack.siteId,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found or not on the same site as the rack');
    }

    // Check asset is not retired
    if (asset.status === 'RETIRED') {
      throw new BadRequestException('Cannot mount a retired asset. Change its status first.');
    }

    // Check if asset is already mounted in another rack
    if (asset.rackId && asset.rackId !== rackId) {
      throw new BadRequestException(
        `Asset is already mounted in another rack. Unmount it first.`,
      );
    }

    // Validate position and height
    if (mountDto.positionU < 1 || mountDto.positionU > rack.heightU) {
      throw new BadRequestException(`Position U must be between 1 and ${rack.heightU}`);
    }

    if (mountDto.heightU < 1) {
      throw new BadRequestException('Height U must be at least 1');
    }

    const endPositionU = mountDto.positionU + mountDto.heightU - 1;
    if (endPositionU > rack.heightU) {
      throw new BadRequestException(
        `Equipment extends beyond rack height (${endPositionU}U > ${rack.heightU}U)`,
      );
    }

    // Check for overlaps with existing equipment
    const overlaps = rack.assets.filter((existingAsset) => {
      if (existingAsset.id === mountDto.assetId) return false; // Skip if updating same asset
      if (!existingAsset.rackPositionU || !existingAsset.rackHeightU) return false; // Skip if no position

      const existingStart = existingAsset.rackPositionU;
      const existingEnd = existingStart + existingAsset.rackHeightU - 1;

      const newStart = mountDto.positionU;
      const newEnd = newStart + mountDto.heightU - 1;

      return (
        (newStart >= existingStart && newStart <= existingEnd) ||
        (newEnd >= existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      );
    });

    if (overlaps.length > 0) {
      throw new BadRequestException(
        `Position U ${mountDto.positionU} to ${endPositionU} overlaps with existing equipment: ${overlaps.map((a) => `${a.model} (${a.rackPositionU}U)`).join(', ')}`,
      );
    }

    // Mount equipment
    const updatedAsset = await this.prisma.asset.update({
      where: { id: mountDto.assetId },
      data: {
        rackId,
        rackPositionU: mountDto.positionU,
        rackHeightU: mountDto.heightU,
      },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'UPDATE',
        entityType: 'rack',
        entityId: rackId,
        changes: { after: { action: 'MOUNT_EQUIPMENT', assetId: mountDto.assetId, positionU: mountDto.positionU, heightU: mountDto.heightU } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for rack mount ${rackId}: ${e.message}`);
    }

    return {
      message: 'Equipment mounted successfully',
      asset: updatedAsset,
    };
  }

  async unmountEquipment(rackId: string, assetId: string, tenantId: string, userId?: string) {
    // Verify rack exists and asset is mounted in it
    const rack = await this.prisma.rack.findFirst({
      where: { id: rackId, tenantId },
      include: {
        assets: {
          where: { id: assetId },
          select: { id: true },
        },
      },
    });

    if (!rack) {
      throw new NotFoundException('Rack not found');
    }

    if (!rack.assets || rack.assets.length === 0) {
      throw new NotFoundException('Equipment not found in this rack');
    }

    const updatedAsset = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        rackId: null,
        rackPositionU: null,
        rackHeightU: null,
      },
    });

    // Audit log
    try {
      await this.auditLogService.log({
        tenantId,
        userId,
        action: 'UPDATE',
        entityType: 'rack',
        entityId: rackId,
        changes: { before: { action: 'UNMOUNT_EQUIPMENT', assetId } },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log for rack unmount ${rackId}: ${e.message}`);
    }

    return {
      message: 'Equipment unmounted successfully',
      asset: updatedAsset,
    };
  }

  async findAvailableSpaces(rackId: string, tenantId: string, requiredHeightU: number) {
    const rack = await this.findOne(rackId, tenantId);

    // Type-safe handling of assets with explicit type
    interface MountedAsset {
      rackPositionU: number | null;
      rackHeightU: number | null;
    }

    const rackAssets = rack.assets as unknown as MountedAsset[];

    const occupiedRanges = rackAssets
      .filter((a) => a.rackPositionU !== null && a.rackHeightU !== null)
      .map((asset) => ({
        start: asset.rackPositionU!,
        end: asset.rackPositionU! + asset.rackHeightU! - 1,
      }));

    const availableSpaces = [];

    for (let positionU = 1; positionU <= rack.heightU; positionU++) {
      const endPositionU = positionU + requiredHeightU - 1;

      if (endPositionU > rack.heightU) break;

      const isAvailable = !occupiedRanges.some((range) => {
        return (
          (positionU >= range.start && positionU <= range.end) ||
          (endPositionU >= range.start && endPositionU <= range.end) ||
          (positionU <= range.start && endPositionU >= range.end)
        );
      });

      if (isAvailable) {
        availableSpaces.push({
          positionU,
          endPositionU,
          heightU: requiredHeightU,
        });
      }
    }

    return {
      rackId: rack.id,
      rackName: rack.name,
      totalU: rack.heightU,
      requiredU: requiredHeightU,
      availableSpaces,
    };
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async uploadAttachment(
    rackId: string,
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadAttachmentDto,
  ) {
    await this.findOne(rackId, tenantId);

    const filename = this.storageService.generateFilename(file.originalname, 'attachment');
    const folder = `attachments/${tenantId}/racks/${rackId}`;
    const filePath = await this.storageService.uploadFile(file, folder, filename);

    const attachment = await this.prisma.attachment.create({
      data: {
        id: createId(),
        tenantId,
        rackId,
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

  async listAttachments(rackId: string, tenantId: string) {
    await this.findOne(rackId, tenantId);

    const attachments = await this.prisma.attachment.findMany({
      where: { tenantId, rackId },
      orderBy: { uploadedAt: 'desc' },
    });

    return attachments.map((a) => ({
      ...a,
      url: this.storageService.getFileUrl(a.path),
    }));
  }

  async deleteAttachment(attachmentId: string, tenantId: string, rackId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, tenantId, rackId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.storageService.deleteFile(attachment.path);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });

    return { message: 'Attachment deleted successfully' };
  }
}
