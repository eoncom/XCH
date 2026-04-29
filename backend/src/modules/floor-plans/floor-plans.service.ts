import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto';
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { FilterFloorPlanDto } from './dto/filter-floor-plan.dto';
import { PaginatedResponse, buildPaginatedResponse } from '../../common/interfaces/paginated.interface';
import { StorageService } from '../../common/services/storage.service';
import { PermissionService } from '../../common/services/permission.service';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { validateMagicBytes, validateMagicBytesForMimetype } from '../../common/utils/upload-security';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class FloorPlansService {
  private readonly logger = new Logger(FloorPlansService.name);

  constructor(
    private prisma: PrismaClient,
    private storageService: StorageService,
    private perm: PermissionService,
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

    // Version number:
    // - If planGroupId is provided, auto-increment within that group
    // - Otherwise this is a brand-new plan → always start at version 1
    let version = createFloorPlanDto.version || 1;
    if (!createFloorPlanDto.version && createFloorPlanDto.planGroupId) {
      const lastPlan = await this.prisma.floorPlan.findFirst({
        where: { planGroupId: createFloorPlanDto.planGroupId },
        orderBy: { version: 'desc' },
      });
      if (lastPlan) {
        version = lastPlan.version + 1;
      }
    }

    const floorPlan = await this.prisma.floorPlan.create({
      data: {
        siteId: createFloorPlanDto.siteId,
        title: createFloorPlanDto.name,
        version,
        planGroupId: createFloorPlanDto.planGroupId || undefined,
        fileUrl: '',
        uploadedBy: tenantId,
        notes: createFloorPlanDto.notes,
      },
      include: {
        site: true,
        pins: true,
      },
    });

    // If no planGroupId was specified, set it to own id (first version of group)
    if (!floorPlan.planGroupId) {
      return await this.prisma.floorPlan.update({
        where: { id: floorPlan.id },
        data: { planGroupId: floorPlan.id },
        include: { site: true, pins: true },
      });
    }

    return floorPlan;
  }

  /**
   * Inspect a PDF file: get page count and thumbnails
   */
  async inspectPdf(file: Express.Multer.File): Promise<{ pageCount: number; pages: { page: number; thumbnail: string }[] }> {
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File is not a PDF');
    }

    // S1-closing 2026-04-26 — magic-bytes : on n'écrit jamais sur disque
    // un buffer dont la signature ne correspond pas à un PDF, même si le
    // mimetype HTTP dit "application/pdf" (defense in depth contre un
    // attaquant qui forge le header).
    validateMagicBytes(file.buffer, ['pdf']);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xch-pdf-'));
    const pdfPath = path.join(tmpDir, 'input.pdf');

    try {
      fs.writeFileSync(pdfPath, file.buffer);

      // Get page count using pdfinfo
      let pageCount = 1;
      try {
        const pdfInfoOutput = execSync(`pdfinfo "${pdfPath}" 2>/dev/null`, { encoding: 'utf-8' });
        const pagesMatch = pdfInfoOutput.match(/Pages:\s+(\d+)/);
        if (pagesMatch) {
          pageCount = parseInt(pagesMatch[1], 10);
        }
      } catch {
        this.logger.warn('pdfinfo failed, assuming 1 page');
      }

      // Generate thumbnails for each page (low-res for preview)
      const pages: { page: number; thumbnail: string }[] = [];
      for (let i = 1; i <= pageCount; i++) {
        const thumbPrefix = path.join(tmpDir, `thumb-${i}`);
        try {
          execSync(
            `pdftoppm -png -r 72 -f ${i} -l ${i} -singlefile "${pdfPath}" "${thumbPrefix}"`,
            { timeout: 15000 },
          );
          const thumbPath = `${thumbPrefix}.png`;
          if (fs.existsSync(thumbPath)) {
            const thumbData = fs.readFileSync(thumbPath);
            pages.push({
              page: i,
              thumbnail: `data:image/png;base64,${thumbData.toString('base64')}`,
            });
          }
        } catch (err) {
          this.logger.warn(`Failed to generate thumbnail for page ${i}: ${err}`);
        }
      }

      return { pageCount, pages };
    } finally {
      // Cleanup tmp files
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  /**
   * Convert a PDF page to PNG buffer using pdftoppm
   */
  private convertPdfPageToPng(pdfBuffer: Buffer, page: number = 1): Buffer {
    // Defense in depth: enforce integer range to prevent command injection even
    // if an untyped caller passes a crafted string (Semgrep detect-child-process).
    const safePage = Number(page);
    if (!Number.isInteger(safePage) || safePage < 1 || safePage > 10000) {
      throw new BadRequestException(`Invalid page number: ${page}`);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xch-pdf-'));
    const pdfPath = path.join(tmpDir, 'input.pdf');
    const outputPrefix = path.join(tmpDir, 'output');

    try {
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Convert specific page to PNG at 200 DPI (good quality for floor plans)
      execSync(
        `pdftoppm -png -r 200 -f ${safePage} -l ${safePage} -singlefile "${pdfPath}" "${outputPrefix}"`,
        { timeout: 30000 },
      );

      const outputPath = `${outputPrefix}.png`;
      if (!fs.existsSync(outputPath)) {
        throw new BadRequestException('PDF conversion failed: no output generated');
      }

      return fs.readFileSync(outputPath);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`PDF conversion failed: ${err}`);
      throw new BadRequestException('Failed to convert PDF to image. Please try uploading a PNG or JPG instead.');
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }

  /**
   * Upload floor plan file (PDF, PNG, JPG)
   * PDFs are automatically converted to PNG at the selected page
   */
  async uploadFile(
    floorPlanId: string,
    tenantId: string,
    file: Express.Multer.File,
    page?: number,
  ) {
    const floorPlan = await this.findOne(floorPlanId, tenantId);

    // Validate file type
    const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only PDF, PNG, and JPG are allowed.',
      );
    }

    // S1-closing 2026-04-26 — magic-bytes : confirme que le contenu
    // correspond bien au mimetype annoncé (PDF, PNG ou JPEG).
    validateMagicBytes(file.buffer, ['pdf', 'png', 'jpeg']);

    // Note: Multer fileSize limit (50MB) appliqué côté controller via
    // FLOOR_PLAN_LIMITS — la borne 10MB historique en service est
    // conservée comme garde-fou supplémentaire pour les assets monstres
    // (PDF haute déf 30+ MB rejeté ici si pas légitime).
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Convert PDF to PNG if needed
    if (file.mimetype === 'application/pdf') {
      const selectedPage = page || 1;
      this.logger.log(`Converting PDF page ${selectedPage} to PNG for plan ${floorPlanId}`);

      const pngBuffer = this.convertPdfPageToPng(file.buffer, selectedPage);

      // Replace file data with converted PNG
      file.buffer = pngBuffer;
      file.mimetype = 'image/png';
      file.size = pngBuffer.length;
      file.originalname = file.originalname.replace(/\.pdf$/i, '.png');
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
      `Floor plan file uploaded: ${floorPlanId} (${file.originalname}, ${file.size} bytes, type: ${file.mimetype})`,
    );

    return updated;
  }

  /**
   * Find all floor plans for tenant (with optional filters)
   */
  async findAll(tenantId: string, filters: FilterFloorPlanDto = {}, accessibleSiteIds?: string[] | null) {
    const where: any = {
      site: { tenantId }  // Filter via site relation
    };

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
    const sortOrder = filters.sortOrder || 'desc';

    // Default multi-column sort or single-column if sortBy specified
    const orderBy = filters.sortBy
      ? { [filters.sortBy]: sortOrder }
      : [{ siteId: 'asc' as const }, { version: 'desc' as const }];

    const [data, total] = await Promise.all([
      this.prisma.floorPlan.findMany({
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
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.floorPlan.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, pageSize);
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
  async findOne(id: string, tenantId: string, callerCtx?: CallerCtx) {
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

    // ADR-021 — guess-by-id defense. FloorPlan.siteId is REQUIRED (non-null).
    if (callerCtx && floorPlan.siteId) {
      await this.perm.assertCanReadSite(callerCtx, floorPlan.siteId);
    }

    return floorPlan;
  }

  /**
   * Update floor plan metadata
   */
  async update(id: string, tenantId: string, updateFloorPlanDto: UpdateFloorPlanDto, callerCtx?: CallerCtx) {
    const existing = await this.findOne(id, tenantId, callerCtx);

    // ADR-021 — write access check before mutation.
    if (callerCtx && existing.siteId) {
      await this.perm.assertCanWriteSite(callerCtx, existing.siteId);
    }

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
  async remove(id: string, tenantId: string, callerCtx?: CallerCtx) {
    const floorPlan = await this.findOne(id, tenantId, callerCtx);

    // ADR-021 — write access required to delete.
    if (callerCtx && floorPlan.siteId) {
      await this.perm.assertCanWriteSite(callerCtx, floorPlan.siteId);
    }

    // Best-effort cleanup of floor plan files from storage
    try {
      // Delete by prefix to catch all files associated with this plan
      await this.storageService.deleteByPrefix(`floor-plans/plan-${id}`);
    } catch (error) {
      this.logger.warn(`Failed to delete floor plan files by prefix for plan ${id}: ${error.message}`);
    }

    // Also try the legacy path extraction as fallback
    if (floorPlan.fileUrl) {
      try {
        const filePath = floorPlan.fileUrl.split('/uploads')[1];
        if (filePath) {
          await this.storageService.deleteFile(filePath);
        }
      } catch (error) {
        this.logger.warn(`Failed to delete floor plan file via legacy path for plan ${id}: ${error.message}`);
      }
    }

    // Delete pins cascade handled by Prisma schema
    await this.prisma.floorPlan.delete({ where: { id } });

    this.logger.log(`Floor plan deleted: ${id}`);
    return { message: 'Floor plan deleted successfully' };
  }

  // ==================== HEATMAP ====================

  /**
   * Get heatmap data: WIFI_AP pins with their linked assets and scale info
   */
  async getHeatmapData(id: string, tenantId: string) {
    const floorPlan = await this.prisma.floorPlan.findFirst({
      where: { id, site: { tenantId } },
      select: {
        id: true,
        scaleMetersPerPixel: true,
        scaleRefLine: true,
        pins: {
          where: {
            pinType: 'WIFI_AP',
          },
          select: {
            id: true,
            x: true,
            y: true,
            label: true,
            asset: {
              select: {
                id: true,
                name: true,
                manufacturer: true,
                model: true,
                type: true,
                status: true,
                ip: true,
                mac: true,
                hostname: true,
                vlan: true,
                port: true,
                wifiCoverageRadius: true,
                wifiFrequency: true,
                wifiAntennaType: true,
                wifiTxPowerDbm: true,
              },
            },
          },
        },
      },
    });

    if (!floorPlan) {
      throw new NotFoundException('Floor plan not found');
    }

    return {
      floorPlanId: floorPlan.id,
      scaleMetersPerPixel: floorPlan.scaleMetersPerPixel,
      scaleRefLine: floorPlan.scaleRefLine,
      accessPoints: floorPlan.pins.map(pin => ({
        pinId: pin.id,
        x: pin.x,
        y: pin.y,
        label: pin.label,
        asset: pin.asset,
      })),
    };
  }

  /**
   * Update floor plan scale calibration
   */
  async updateScale(id: string, tenantId: string, scaleMetersPerPixel: number, scaleRefLine?: any) {
    await this.findOne(id, tenantId);

    return await this.prisma.floorPlan.update({
      where: { id },
      data: {
        scaleMetersPerPixel,
        scaleRefLine: scaleRefLine || undefined,
      },
      select: {
        id: true,
        scaleMetersPerPixel: true,
        scaleRefLine: true,
      },
    });
  }

  // ==================== VERSIONING ====================

  /**
   * Create a new version of an existing floor plan (copies pins, optionally keeps previous plan image)
   */
  async createNewVersion(
    id: string,
    tenantId: string,
    notes?: string,
    file?: Express.Multer.File,
    page?: number,
  ) {
    const sourcePlan = await this.findOne(id, tenantId);

    // Get or create planGroupId
    const planGroupId = sourcePlan.planGroupId || sourcePlan.id;

    // Get next version number within this group
    const lastInGroup = await this.prisma.floorPlan.findFirst({
      where: { planGroupId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (lastInGroup?.version || sourcePlan.version) + 1;

    // Ensure source has planGroupId set (backfill for old plans)
    if (!sourcePlan.planGroupId) {
      await this.prisma.floorPlan.update({
        where: { id: sourcePlan.id },
        data: { planGroupId },
      });
    }

    // If no new file provided, keep the plan image from the source version
    const inheritedFileData = !file
      ? {
          fileUrl: sourcePlan.fileUrl || '',
          fileSize: sourcePlan.fileSize || null,
          mimeType: sourcePlan.mimeType || null,
        }
      : { fileUrl: '' };

    // Create new floor plan version
    const newPlan = await this.prisma.floorPlan.create({
      data: {
        siteId: sourcePlan.siteId,
        title: sourcePlan.title,
        version: nextVersion,
        planGroupId,
        ...inheritedFileData,
        uploadedBy: tenantId,
        notes: notes || `Version ${nextVersion} — basée sur v${sourcePlan.version}`,
      },
    });

    // Copy pins from source plan
    const sourcePins = await this.prisma.pin.findMany({
      where: { floorPlanId: sourcePlan.id },
    });

    if (sourcePins.length > 0) {
      await this.prisma.pin.createMany({
        data: sourcePins.map((pin) => ({
          floorPlanId: newPlan.id,
          pinType: pin.pinType,
          x: pin.x,
          y: pin.y,
          assetId: pin.assetId,
          rackId: pin.rackId,
          label: pin.label,
          description: pin.description,
          icon: pin.icon,
          color: pin.color,
        })),
      });
    }

    // Upload new file if provided (overrides inherited file)
    if (file) {
      return await this.uploadFile(newPlan.id, tenantId, file, page);
    }

    this.logger.log(
      `New version created: ${newPlan.id} (v${nextVersion}) from ${sourcePlan.id} (v${sourcePlan.version}), ${sourcePins.length} pins copied, file ${file ? 'new upload' : 'inherited from source'}`,
    );

    return await this.findOne(newPlan.id, tenantId);
  }

  /**
   * Get version history for a floor plan (all versions in the same group)
   */
  async getVersionHistory(id: string, tenantId: string) {
    const floorPlan = await this.findOne(id, tenantId);
    const planGroupId = floorPlan.planGroupId || floorPlan.id;

    return await this.prisma.floorPlan.findMany({
      where: {
        planGroupId,
        site: { tenantId },
      },
      include: {
        site: true,
        _count: { select: { pins: true } },
      },
      orderBy: { version: 'desc' },
    });
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
