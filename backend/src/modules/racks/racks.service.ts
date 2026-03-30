import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { MountEquipmentDto } from './dto/mount-equipment.dto';
import { StorageService } from '../../common/services/storage.service';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class RacksService {
  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
  ) {}

  async create(tenantId: string, createRackDto: CreateRackDto) {
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

    return rack;
  }

  async findAll(tenantId: string, siteId?: string, accessibleSiteIds?: string[] | null) {
    const where: any = { tenantId };

    // Site access filtering
    if (accessibleSiteIds !== undefined && accessibleSiteIds !== null) {
      if (accessibleSiteIds.length === 0) return [];
      where.siteId = { in: accessibleSiteIds };
    }

    if (siteId) {
      if (accessibleSiteIds && !accessibleSiteIds.includes(siteId)) return [];
      where.siteId = siteId;
    }

    const racks = await this.prisma.rack.findMany({
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
        updatedAt: 'desc',
      },
    });

    // Calculate occupation for each rack
    return racks.map(rack => {
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

  async update(id: string, tenantId: string, updateRackDto: UpdateRackDto) {
    await this.findOne(id, tenantId);

    const rack = await this.prisma.rack.update({
      where: { id },
      data: updateRackDto,
      include: {
        site: true,
      },
    });

    return rack;
  }

  async remove(id: string, tenantId: string) {
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

    await this.prisma.rack.delete({
      where: { id },
    });

    return { message: 'Rack deleted successfully' };
  }

  async mountEquipment(rackId: string, tenantId: string, mountDto: MountEquipmentDto) {
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

    return {
      message: 'Equipment mounted successfully',
      asset: updatedAsset,
    };
  }

  async unmountEquipment(rackId: string, assetId: string, tenantId: string) {
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
