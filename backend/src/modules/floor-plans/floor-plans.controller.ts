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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FloorPlansService } from './floor-plans.service';
import { CreateFloorPlanDto } from './dto/create-floor-plan.dto';
import { UpdateFloorPlanDto } from './dto/update-floor-plan.dto';
import { CreatePinDto } from './dto/create-pin.dto';
import { UpdatePinDto } from './dto/update-pin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource } from '../../common/decorators/permissions.decorator';
import { Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { SiteAccessService } from '../site-access/site-access.service';

@ApiTags('floor-plans')
@ApiBearerAuth()
@Controller('floor-plans')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class FloorPlansController {
  constructor(
    private readonly floorPlansService: FloorPlansService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Post()
  @Resource('floor-plans')
  @Action('create')
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
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Request() req: AuthRequest,
    @Body() createFloorPlanDto: CreateFloorPlanDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const floorPlan = await this.floorPlansService.create(req.user.tenantId, createFloorPlanDto);

    // If file is provided, upload it immediately
    if (file) {
      return this.floorPlansService.uploadFile(floorPlan.id, req.user.tenantId, file);
    }

    return floorPlan;
  }

  @Post(':id/upload')
  @Resource('floor-plans')
  @Action('update')
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
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.floorPlansService.uploadFile(id, req.user.tenantId, file);
  }

  @Get()
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get all floor plans (filtered by user site access)' })
  async findAll(@Request() req: AuthRequest, @Query('siteId') siteId?: string) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.floorPlansService.findAll(req.user.tenantId, siteId, accessibleSiteIds);
  }

  @Get('site/:siteId/latest')
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get latest floor plan version for site' })
  findLatestForSite(@Param('siteId') siteId: string, @Request() req: AuthRequest) {
    return this.floorPlansService.findLatestForSite(siteId, req.user.tenantId);
  }

  @Get(':id')
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get floor plan by ID with all pins' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.findOne(id, req.user.tenantId);
  }

  @Get(':id/stats')
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get floor plan statistics (pins count by type)' })
  getStats(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.getStats(id, req.user.tenantId);
  }

  @Get(':id/versions')
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get version history for a floor plan' })
  getVersionHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.getVersionHistory(id, req.user.tenantId);
  }

  @Post(':id/new-version')
  @Resource('floor-plans')
  @Action('create')
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
  @UseInterceptors(FileInterceptor('file'))
  async createNewVersion(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('notes') notes?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.floorPlansService.createNewVersion(
      id,
      req.user.tenantId,
      notes,
      file,
    );
  }

  @Patch(':id')
  @Resource('floor-plans')
  @Action('update')
  @ApiOperation({ summary: 'Update floor plan metadata' })
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() updateFloorPlanDto: UpdateFloorPlanDto,
  ) {
    return this.floorPlansService.update(id, req.user.tenantId, updateFloorPlanDto);
  }

  @Delete(':id')
  @Resource('floor-plans')
  @Action('delete')
  @ApiOperation({ summary: 'Delete floor plan (and file)' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.floorPlansService.remove(id, req.user.tenantId);
  }

  // ==================== PINS ENDPOINTS ====================

  @Post(':id/pins')
  @Resource('floor-plans')
  @Action('update')
  @ApiOperation({ summary: 'Create a pin on floor plan' })
  createPin(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Body() createPinDto: CreatePinDto,
  ) {
    return this.floorPlansService.createPin(floorPlanId, req.user.tenantId, createPinDto);
  }

  @Get(':id/pins')
  @Resource('floor-plans')
  @Action('read')
  @ApiOperation({ summary: 'Get all pins for floor plan (optionally filtered by type)' })
  findPins(
    @Param('id') floorPlanId: string,
    @Request() req: AuthRequest,
    @Query('type') type?: string,
  ) {
    return this.floorPlansService.findPins(floorPlanId, req.user.tenantId, type);
  }

  @Patch(':id/pins/:pinId')
  @Resource('floor-plans')
  @Action('update')
  @ApiOperation({ summary: 'Update pin' })
  updatePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
    @Body() updatePinDto: UpdatePinDto,
  ) {
    return this.floorPlansService.updatePin(
      floorPlanId,
      pinId,
      req.user.tenantId,
      updatePinDto,
    );
  }

  @Delete(':id/pins/:pinId')
  @Resource('floor-plans')
  @Action('update')
  @ApiOperation({ summary: 'Delete pin' })
  removePin(
    @Param('id') floorPlanId: string,
    @Param('pinId') pinId: string,
    @Request() req: AuthRequest,
  ) {
    return this.floorPlansService.removePin(floorPlanId, pinId, req.user.tenantId);
  }
}
