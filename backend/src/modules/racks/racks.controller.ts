import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { attachmentFileFilter } from '../../common/utils/upload-security';
import { RacksService } from './racks.service';
import { CreateRackDto } from './dto/create-rack.dto';
import { UpdateRackDto } from './dto/update-rack.dto';
import { MountEquipmentDto } from './dto/mount-equipment.dto';
import { FilterRackDto } from './dto/filter-rack.dto';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { SiteAccessService } from '../site-access/site-access.service';
import { ResourcePermissionLevel } from '../site-access/dto/grant-site-access.dto';

@RequireModule('racks')
@ApiTags('racks')
@Controller('racks')
@UseGuards(JwtAuthGuard, CasbinGuard, ModuleGuard)
@ApiBearerAuth()
export class RacksController {
  constructor(
    private readonly racksService: RacksService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Post()
  @Resource('racks') @Action('create')
  @ApiOperation({ summary: 'Create new rack' })
  async create(@Body() createRackDto: CreateRackDto, @Request() req: AuthRequest) {
    if (createRackDto.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, createRackDto.siteId, 'racks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions for racks on this site');
      }
    }
    return this.racksService.create(req.user.tenantId, createRackDto, req.user.userId);
  }

  @Get()
  @Resource('racks') @Action('read')
  @ApiOperation({ summary: 'Get all racks (filtered by user site access + resource permissions)' })
  async findAll(@Query() filters: FilterRackDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'racks',
    );
    return this.racksService.findAll(req.user.tenantId, filters, accessibleSiteIds);
  }

  @Get(':id')
  @Resource('racks') @Action('read')
  @ApiOperation({ summary: 'Get rack by id with occupation details' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const rack = await this.racksService.findOne(id, req.user.tenantId);
    if (rack.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, rack.siteId, 'racks',
      );
      if (perm === ResourcePermissionLevel.NONE) {
        throw new ForbiddenException('No access to racks on this site');
      }
    }
    return rack;
  }

  @Get(':id/available-spaces')
  @Resource('racks') @Action('read')
  @ApiOperation({ summary: 'Find available spaces in rack for equipment of given height' })
  findAvailableSpaces(
    @Param('id') id: string,
    @Query('heightU') heightU: number,
    @Request() req: AuthRequest,
  ) {
    return this.racksService.findAvailableSpaces(id, req.user.tenantId, Number(heightU));
  }

  @Post(':id/mount')
  @Resource('racks') @Action('update')
  @ApiOperation({ summary: 'Mount equipment on rack' })
  async mountEquipment(
    @Param('id') id: string,
    @Body() mountDto: MountEquipmentDto,
    @Request() req: AuthRequest,
  ) {
    const rack = await this.racksService.findOne(id, req.user.tenantId);
    if (rack.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, rack.siteId, 'racks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.mountEquipment(id, req.user.tenantId, mountDto, req.user.userId);
  }

  @Delete(':id/unmount/:assetId')
  @Resource('racks') @Action('update')
  @ApiOperation({ summary: 'Unmount equipment from rack' })
  async unmountEquipment(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Request() req: AuthRequest,
  ) {
    const rack = await this.racksService.findOne(id, req.user.tenantId);
    if (rack.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, rack.siteId, 'racks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.unmountEquipment(id, assetId, req.user.tenantId, req.user.userId);
  }

  @Patch(':id')
  @Resource('racks') @Action('update')
  @ApiOperation({ summary: 'Update rack' })
  async update(@Param('id') id: string, @Body() updateRackDto: UpdateRackDto, @Request() req: AuthRequest) {
    const rack = await this.racksService.findOne(id, req.user.tenantId);
    if (rack.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, rack.siteId, 'racks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.update(id, req.user.tenantId, updateRackDto, req.user.userId);
  }

  @Delete(':id')
  @Resource('racks') @Action('delete')
  @ApiOperation({ summary: 'Delete rack' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const rack = await this.racksService.findOne(id, req.user.tenantId);
    if (rack.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, rack.siteId, 'racks',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to delete racks on this site');
      }
    }
    return this.racksService.remove(id, req.user.tenantId, req.user.userId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @Resource('racks') @Action('update')
  @ApiOperation({ summary: 'Upload attachment to rack' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        description: { type: 'string' },
        category: { type: 'string', enum: ['spec', 'invoice', 'photo', 'report', 'manual', 'other'] },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: attachmentFileFilter,
  }))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @Request() req: AuthRequest,
  ) {
    return this.racksService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, uploadAttachmentDto);
  }

  @Get(':id/attachments')
  @Resource('racks') @Action('read')
  @ApiOperation({ summary: 'List attachments for rack' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.racksService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @Resource('racks') @Action('update')
  @ApiOperation({ summary: 'Delete attachment from rack' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.racksService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
