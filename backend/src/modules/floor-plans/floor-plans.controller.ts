import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { floorPlanFileFilter, pdfOnlyFileFilter } from '../../common/utils/upload-security';
import { FloorPlansService } from './floor-plans.service';

// S1-closing 2026-04-26 — Multer fileSize limit pour les uploads de plans
// d'étage. Les PDF haute résolution + grands PNG peuvent atteindre 30-40 MB
// légitimement (plans CAD exportés). 50 MB couvre largement les cas réels
// sans laisser ouvert un DoS upload géant.
const FLOOR_PLAN_LIMITS = { fileSize: 50 * 1024 * 1024 };       // 50 MB
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto';
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { FilterFloorPlanDto } from './dto/filter-floor-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';

@RequireModule('floor_plans')
@ApiTags('floor-plans')
@ApiBearerAuth()
@Controller('floor-plans')
@UseGuards(JwtAuthGuard, ModuleGuard)
export class FloorPlansController {
  constructor(
    private readonly floorPlansService: FloorPlansService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post('inspect-pdf')
  @RequireWrite()
  @ApiOperation({ summary: 'Inspect a PDF file: get page count and thumbnails' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: pdfOnlyFileFilter }))
  async inspectPdf(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.floorPlansService.inspectPdf(file);
  }

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new floor plan with optional file upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        siteId: { type: 'string' },
        name: { type: 'string' },
        floor: { type: 'string' },
        building: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['siteId', 'name'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: floorPlanFileFilter }))
  async create(
    @Request() req: AuthRequest,
    @Body() createFloorPlanDto: CreateFloorPlanDto,
    @UploadedFile() file?: Express.Multer.File,
    @Query('page') page?: string,
  ) {
    // Check per-resource permission
    if (createFloorPlanDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createFloorPlanDto.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for floor plans on this site');
      }
    }

    const floorPlan = await this.floorPlansService.create(req.user.tenantId, createFloorPlanDto);

    // If file is provided, upload it immediately (PDFs converted to PNG automatically)
    if (file) {
      const pageNum = page ? parseInt(page, 10) : undefined;
      return this.floorPlansService.uploadFile(floorPlan.id, req.user.tenantId, file, pageNum);
    }

    return floorPlan;
  }

  @Post(':id/upload')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload floor plan file (PDF, PNG, JPG)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: floorPlanFileFilter }))
  async uploadFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Query('page') page?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
      }
    }

    const pageNum = page ? parseInt(page, 10) : undefined;
    return this.floorPlansService.uploadFile(id, req.user.tenantId, file, pageNum);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all floor plans (filtered by user site access + resource permissions)' })
  async findAll(@Query() filters: FilterFloorPlanDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.floorPlansService.findAll(req.user.tenantId, filters, accessibleSiteIds);
  }

  @Get('site/:siteId/latest')
  @RequireRead()
  @ApiOperation({ summary: 'Get latest floor plan version for site' })
  findLatestForSite(@Param('siteId') siteId: string, @Request() req: AuthRequest) {
    return this.floorPlansService.findLatestForSite(siteId, req.user.tenantId);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get floor plan by ID with all pins' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to floor plans on this site');
      }
    }
    return floorPlan;
  }

  @Get(':id/heatmap-data')
  @RequireRead()
  @ApiOperation({ summary: 'Get heatmap data: AP pins with linked assets and scale info' })
  async getHeatmapData(@Param('id') id: string, @Request() req: AuthRequest) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to floor plans on this site');
      }
    }
    return this.floorPlansService.getHeatmapData(id, req.user.tenantId);
  }

  @Patch(':id/scale')
  @RequireWrite()
  @ApiOperation({ summary: 'Update floor plan scale calibration' })
  async updateScale(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: { scaleMetersPerPixel: number; scaleRefLine?: any },
  ) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plan scale');
      }
    }
    return this.floorPlansService.updateScale(id, req.user.tenantId, body.scaleMetersPerPixel, body.scaleRefLine);
  }

  @Get(':id/stats')
  @RequireRead()
  @ApiOperation({ summary: 'Get floor plan statistics (pins count by type)' })
  getStats(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.getStats(id, req.user.tenantId);
  }

  @Get(':id/versions')
  @RequireRead()
  @ApiOperation({ summary: 'Get version history for a floor plan' })
  getVersionHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.getVersionHistory(id, req.user.tenantId);
  }

  @Post(':id/new-version')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new version of a floor plan (copies pins)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        notes: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: floorPlanFileFilter }))
  async createNewVersion(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('notes') notes?: string,
    @UploadedFile() file?: Express.Multer.File,
    @Query('page') page?: string,
  ) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to create floor plan versions on this site');
      }
    }
    const pageNum = page ? parseInt(page, 10) : undefined;
    return this.floorPlansService.createNewVersion(
      id,
      req.user.tenantId,
      notes,
      file,
      pageNum,
    );
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update floor plan metadata' })
  async update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() updateFloorPlanDto: UpdateFloorPlanDto,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
      }
    }
    return this.floorPlansService.update(id, req.user.tenantId, updateFloorPlanDto, ctx);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete floor plan (and file)' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to delete floor plans on this site');
      }
    }
    return this.floorPlansService.remove(id, req.user.tenantId, ctx);
  }

  // ==================== PINS ENDPOINTS ====================

  @Post(':id/pins')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a pin on floor plan' })
  async createPin(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Body() createPinDto: CreatePinDto,
  ) {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
      }
    }
    return this.floorPlansService.createPin(floorPlanId, req.user.tenantId, createPinDto);
  }

  @Get(':id/pins')
  @RequireRead()
  @ApiOperation({ summary: 'Get all pins for floor plan (optionally filtered by type)' })
  findPins(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Query('type') type?: string,
  ) {
    return this.floorPlansService.findPins(floorPlanId, req.user.tenantId, type);
  }

  @Patch(':id/pins/:pinId')
  @RequireWrite()
  @ApiOperation({ summary: 'Update pin' })
  async updatePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
    @Body() updatePinDto: UpdatePinDto,
  ) {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
      }
    }
    return this.floorPlansService.updatePin(
      floorPlanId,
      pinId,
      req.user.tenantId,
      updatePinDto,
    );
  }

  @Delete(':id/pins/:pinId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete pin' })
  async removePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
  ) {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
      }
    }
    return this.floorPlansService.removePin(floorPlanId, pinId, req.user.tenantId);
  }
}
