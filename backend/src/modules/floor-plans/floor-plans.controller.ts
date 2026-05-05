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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { floorPlanFileFilter, pdfOnlyFileFilter } from '../../common/utils/upload-security';
import { FloorPlansService } from './floor-plans.service';

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
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { FloorPlanResponseDto } from './dto/floor-plan.response.dto';
import { FloorPlanListResponseDto } from './dto/floor-plan-list.response.dto';
import { PinResponseDto } from './dto/pin.response.dto';
import { FloorPlanPdfInspectResponseDto } from './dto/floor-plan-pdf-inspect.response.dto';
import { FloorPlanHeatmapDataResponseDto } from './dto/floor-plan-heatmap-data.response.dto';
import { FloorPlanStatsResponseDto } from './dto/floor-plan-stats.response.dto';
import {
  FloorPlanDeletedResultResponseDto,
  FloorPlanPinDeletedResultResponseDto,
} from './dto/floor-plan-action-result.response.dto';

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
  @ApiOkResponse({ type: FloorPlanPdfInspectResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: pdfOnlyFileFilter }))
  async inspectPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FloorPlanPdfInspectResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    const result = await this.floorPlansService.inspectPdf(file);
    return toResponse(FloorPlanPdfInspectResponseDto, result);
  }

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new floor plan with optional file upload' })
  @ApiCreatedResponse({ type: FloorPlanResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
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
  ): Promise<FloorPlanResponseDto> {
    if (createFloorPlanDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createFloorPlanDto.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions for floor plans on this site');
    }

    const floorPlan = await this.floorPlansService.create(req.user.tenantId, createFloorPlanDto);

    if (file) {
      const pageNum = page ? parseInt(page, 10) : undefined;
      const updated = await this.floorPlansService.uploadFile(floorPlan.id, req.user.tenantId, file, pageNum);
      return toResponse(FloorPlanResponseDto, updated);
    }

    return toResponse(FloorPlanResponseDto, floorPlan);
  }

  @Post(':id/upload')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload floor plan file (PDF, PNG, JPG)' })
  @ApiOkResponse({ type: FloorPlanResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: floorPlanFileFilter }))
  async uploadFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Query('page') page?: string,
  ): Promise<FloorPlanResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
    }
    const pageNum = page ? parseInt(page, 10) : undefined;
    const updated = await this.floorPlansService.uploadFile(id, req.user.tenantId, file, pageNum);
    return toResponse(FloorPlanResponseDto, updated);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all floor plans (filtered by user site access + resource permissions)' })
  @ApiOkResponse({ type: FloorPlanListResponseDto })
  async findAll(
    @Query() filters: FilterFloorPlanDto,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanListResponseDto> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const page = await this.floorPlansService.findAll(req.user.tenantId, filters, accessibleSiteIds);
    return toResponse(FloorPlanListResponseDto, page);
  }

  @Get('site/:siteId/latest')
  @RequireRead()
  @ApiOperation({ summary: 'Get latest floor plan version for site' })
  @ApiOkResponse({ type: FloorPlanResponseDto })
  async findLatestForSite(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanResponseDto | null> {
    const result = await this.floorPlansService.findLatestForSite(siteId, req.user.tenantId);
    return result ? toResponse(FloorPlanResponseDto, result) : null;
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get floor plan by ID with all pins' })
  @ApiOkResponse({ type: FloorPlanResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<FloorPlanResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm === null) throw new ForbiddenException('No access to floor plans on this site');
    }
    return toResponse(FloorPlanResponseDto, floorPlan);
  }

  @Get(':id/heatmap-data')
  @RequireRead()
  @ApiOperation({ summary: 'Get heatmap data: AP pins with linked assets and scale info' })
  @ApiOkResponse({ type: FloorPlanHeatmapDataResponseDto })
  async getHeatmapData(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanHeatmapDataResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm === null) throw new ForbiddenException('No access to floor plans on this site');
    }
    const data = await this.floorPlansService.getHeatmapData(id, req.user.tenantId);
    return toResponse(FloorPlanHeatmapDataResponseDto, data);
  }

  @Patch(':id/scale')
  @RequireWrite()
  @ApiOperation({ summary: 'Update floor plan scale calibration' })
  @ApiOkResponse({ type: FloorPlanResponseDto })
  async updateScale(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() body: { scaleMetersPerPixel: number; scaleRefLine?: unknown },
  ): Promise<FloorPlanResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plan scale');
    }
    const updated = await this.floorPlansService.updateScale(id, req.user.tenantId, body.scaleMetersPerPixel, body.scaleRefLine);
    return toResponse(FloorPlanResponseDto, updated);
  }

  @Get(':id/stats')
  @RequireRead()
  @ApiOperation({ summary: 'Get floor plan statistics (pins count by type)' })
  @ApiOkResponse({ type: FloorPlanStatsResponseDto })
  async getStats(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanStatsResponseDto> {
    const stats = await this.floorPlansService.getStats(id, req.user.tenantId);
    return toResponse(FloorPlanStatsResponseDto, stats);
  }

  @Get(':id/versions')
  @RequireRead()
  @ApiOperation({ summary: 'Get version history for a floor plan' })
  @ApiOkResponse({ type: FloorPlanResponseDto, isArray: true })
  async getVersionHistory(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanResponseDto[]> {
    const versions = await this.floorPlansService.getVersionHistory(id, req.user.tenantId);
    return toResponseArray(FloorPlanResponseDto, versions);
  }

  @Post(':id/new-version')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a new version of a floor plan (copies pins)' })
  @ApiCreatedResponse({ type: FloorPlanResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' }, notes: { type: 'string' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: FLOOR_PLAN_LIMITS, fileFilter: floorPlanFileFilter }))
  async createNewVersion(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('notes') notes?: string,
    @UploadedFile() file?: Express.Multer.File,
    @Query('page') page?: string,
  ): Promise<FloorPlanResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to create floor plan versions on this site');
    }
    const pageNum = page ? parseInt(page, 10) : undefined;
    const newVer = await this.floorPlansService.createNewVersion(id, req.user.tenantId, notes, file, pageNum);
    return toResponse(FloorPlanResponseDto, newVer);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update floor plan metadata' })
  @ApiOkResponse({ type: FloorPlanResponseDto })
  async update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() updateFloorPlanDto: UpdateFloorPlanDto,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<FloorPlanResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
    }
    const updated = await this.floorPlansService.update(id, req.user.tenantId, updateFloorPlanDto, ctx);
    return toResponse(FloorPlanResponseDto, updated);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete floor plan (and file)' })
  @ApiOkResponse({ type: FloorPlanDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<FloorPlanDeletedResultResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(id, req.user.tenantId, ctx);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to delete floor plans on this site');
    }
    return this.floorPlansService.remove(id, req.user.tenantId, ctx);
  }

  // ==================== PINS ENDPOINTS ====================

  @Post(':id/pins')
  @RequireWrite()
  @ApiOperation({ summary: 'Create a pin on floor plan' })
  @ApiCreatedResponse({ type: PinResponseDto })
  async createPin(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Body() createPinDto: CreatePinDto,
  ): Promise<PinResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
    }
    const pin = await this.floorPlansService.createPin(floorPlanId, req.user.tenantId, createPinDto);
    return toResponse(PinResponseDto, pin);
  }

  @Get(':id/pins')
  @RequireRead()
  @ApiOperation({ summary: 'Get all pins for floor plan (optionally filtered by type)' })
  @ApiOkResponse({ type: PinResponseDto, isArray: true })
  async findPins(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Query('type') type?: string,
  ): Promise<PinResponseDto[]> {
    const pins = await this.floorPlansService.findPins(floorPlanId, req.user.tenantId, type);
    return toResponseArray(PinResponseDto, pins);
  }

  @Patch(':id/pins/:pinId')
  @RequireWrite()
  @ApiOperation({ summary: 'Update pin' })
  @ApiOkResponse({ type: PinResponseDto })
  async updatePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
    @Body() updatePinDto: UpdatePinDto,
  ): Promise<PinResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
    }
    const pin = await this.floorPlansService.updatePin(floorPlanId, pinId, req.user.tenantId, updatePinDto);
    return toResponse(PinResponseDto, pin);
  }

  @Delete(':id/pins/:pinId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete pin' })
  @ApiOkResponse({ type: FloorPlanPinDeletedResultResponseDto })
  async removePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
  ): Promise<FloorPlanPinDeletedResultResponseDto> {
    const floorPlan = await this.floorPlansService.findOne(floorPlanId, req.user.tenantId);
    if (floorPlan.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, floorPlan.siteId, 'plans', req.user.tenantId,
      );
      if (perm !== 'WRITE') throw new ForbiddenException('Insufficient permissions to modify floor plans on this site');
    }
    return this.floorPlansService.removePin(floorPlanId, pinId, req.user.tenantId);
  }
}
