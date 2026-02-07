import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto';
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class FloorPlansService {
  private readonly logger = new Logger(FloorPlansService.name);

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
  ) {}

  /**
   * Create a new floor plan
   */
  async create(tenantId: string, createFloorPlanDto: CreateFloorPlanDto) {
    // Verify site exists and belongs to tenant
    const site = await this.prisma.site.findFirst({
      where: { id: createFloorPlanDto.siteId, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    // Auto-increment version if not specified
    let version = createFloorPlanDto.version || 1;
    if (!createFloorPlanDto.version) {
      const lastPlan = await this.prisma.floorPlan.findFirst({
        where: { siteId: createFloorPlanDto.siteId },
        orderBy: { version: 'desc' },
      });
      if (lastPlan) {
        version = lastPlan.version + 1;
      }
    }

    return await this.prisma.floorPlan.create({
      data: {
        siteId: createFloorPlanDto.siteId,
        title: createFloorPlanDto.name,
        version,
        fileUrl: '',
        uploadedBy: tenantId,
        notes: createFloorPlanDto.notes,
      },
      include: {
        site: true,
        pins: true,
      },
    });
  }

  /**
   * Upload floor plan file (PDF, PNG, JPG)
   */
  async uploadFile(
    floorPlanId: string,
    tenantId: string,
    file: Express.Multer.File,
  ) {
    const floorPlan = await this.findOne(floorPlanId, tenantId);

    // Validate file type
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, PNG, and JPG are allowed.',
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Delete old file if exists
    if (floorPlan.fileUrl) {
      const oldFilePath = floorPlan.fileUrl.split('/uploads')[1];
      if (oldFilePath) {
        await this.storageService.deleteFile(oldFilePath);
      }
    }

    // Generate unique filename
    const filename = this.storageService.generateFilename(
      file.originalname,
      `plan-${floorPlanId}`,
    );

    // Upload file
    const filePath = await this.storageService.uploadFile(
      file,
      'floor-plans',
      filename,
    );

    // Update floor plan with file info
    const fileUrl = this.storageService.getFileUrl(filePath);
    const updated = await this.prisma.floorPlan.update({
      where: { id: floorPlanId },
      data: {
        fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedAt: new Date(),
      },
      include: {
        site: true,
        pins: true,
      },
    });

    this.logger.log(
      `Floor plan file uploaded: ${floorPlanId} (${file.originalname}, ${file.size} bytes)`,
    );

    return updated;
  }

  /**
   * Find all floor plans for tenant (with optional filters)
   */
  async findAll(tenantId: string, siteId?: string) {
    const where: any = {
      site: { tenantId }  // Filter via site relation
    };
    if (siteId) {
      where.siteId = siteId;
    }

    return await this.prisma.floorPlan.findMany({
      where,
      include: {
        site: true,
        pins: {
          include: {
            asset: true,
            rack: { include: { assets: true } },
          },
        },
      },
      orderBy: [{ siteId: 'asc' }, { version: 'desc' }],
    });
  }

  /**
   * Find latest version of floor plan for site
   */
  async findLatestForSite(siteId: string, tenantId: string) {
    const floorPlan = await this.prisma.floorPlan.findFirst({
      where: { siteId, site: { tenantId } },
      orderBy: { version: 'desc' },
      include: {
        site: true,
        pins: {
          include: {
            asset: true,
            rack: { include: { assets: true } },
          },
        },
      },
    });

    if (!floorPlan) {
      throw new NotFoundException('No floor plan found for this site');
    }

    return floorPlan;
  }

  /**
   * Find one floor plan
   */
  async findOne(id: string, tenantId: string) {
    const floorPlan = await this.prisma.floorPlan.findFirst({
      where: { id, site: { tenantId } },
      include: {
        site: true,
        pins: {
          include: {
            asset: true,
            rack: { include: { assets: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!floorPlan) {
      throw new NotFoundException('Floor plan not found');
    }

    return floorPlan;
  }

  /**
   * Update floor plan metadata
   */
  async update(id: string, tenantId: string, updateFloorPlanDto: UpdateFloorPlanDto) {
    await this.findOne(id, tenantId);

    return await this.prisma.floorPlan.update({
      where: { id },
      data: updateFloorPlanDto,
      include: {
        site: true,
        pins: true,
      },
    });
  }

  /**
   * Delete floor plan (and associated file)
   */
  async remove(id: string, tenantId: string) {
    const floorPlan = await this.findOne(id, tenantId);

    // Delete file from storage
    if (floorPlan.fileUrl) {
      const filePath = floorPlan.fileUrl.split('/uploads')[1];
      if (filePath) {
        await this.storageService.deleteFile(filePath);
      }
    }

    // Delete pins cascade handled by Prisma schema
    await this.prisma.floorPlan.delete({ where: { id } });

    this.logger.log(`Floor plan deleted: ${id}`);
    return { message: 'Floor plan deleted successfully' };
  }

  // ==================== PINS CRUD ====================

  /**
   * Create pin on floor plan
   */
  async createPin(floorPlanId: string, tenantId: string, createPinDto: CreatePinDto) {
    // Verify floor plan exists
    await this.findOne(floorPlanId, tenantId);

    // Validate asset if provided
    if (createPinDto.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: createPinDto.assetId, tenantId },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }
    }

    // Validate rack if provided (for RACK type pins)
    if (createPinDto.rackId) {
      const rack = await this.prisma.rack.findFirst({
        where: { id: createPinDto.rackId, tenantId },
      });

      if (!rack) {
        throw new NotFoundException('Rack not found');
      }
    }

    return await this.prisma.pin.create({
      data: {
        ...createPinDto,
        floorPlanId,
      },
      include: {
        asset: true,
        rack: { include: { assets: true } },
      },
    });
  }

  /**
   * Find all pins for floor plan
   */
  async findPins(floorPlanId: string, tenantId: string, type?: string) {
    await this.findOne(floorPlanId, tenantId);

    const where: any = { floorPlanId };
    if (type) {
      where.pinType = type;
    }

    return await this.prisma.pin.findMany({
      where,
      include: {
        asset: true,
        rack: { include: { assets: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update pin
   */
  async updatePin(
    floorPlanId: string,
    pinId: string,
    tenantId: string,
    updatePinDto: UpdatePinDto,
  ) {
    // Verify pin exists and belongs to floor plan
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, floorPlanId },
    });

    if (!pin) {
      throw new NotFoundException('Pin not found');
    }

    // Validate asset if changing to ASSET type or updating assetId
    if (updatePinDto.assetId || pin.assetId) {
      const assetId = updatePinDto.assetId || pin.assetId;
      if (!assetId) {
        throw new BadRequestException('assetId is required for pins of type ASSET');
      }

      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId, tenantId },
      });

      if (!asset) {
        throw new NotFoundException('Asset not found');
      }
    }

    return await this.prisma.pin.update({
      where: { id: pinId },
      data: updatePinDto,
      include: {
        asset: true,
        rack: { include: { assets: true } },
      },
    });
  }

  /**
   * Delete pin
   */
  async removePin(floorPlanId: string, pinId: string, tenantId: string) {
    const pin = await this.prisma.pin.findFirst({
      where: { id: pinId, floorPlanId },
    });

    if (!pin) {
      throw new NotFoundException('Pin not found');
    }

    await this.prisma.pin.delete({ where: { id: pinId } });

    return { message: 'Pin deleted successfully' };
  }

  /**
   * Get stats for floor plan
   */
  async getStats(floorPlanId: string, tenantId: string) {
    await this.findOne(floorPlanId, tenantId);

    const pins = await this.prisma.pin.findMany({
      where: { floorPlanId },
    });

    const statsByType = pins.reduce((acc, pin) => {
      acc[pin.pinType] = (acc[pin.pinType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPins: pins.length,
      byType: statsByType,
    };
  }
}
