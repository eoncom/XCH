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
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';

@RequireModule('racks')
@ApiTags('racks')
@Controller('racks')
@UseGuards(JwtAuthGuard, ModuleGuard)
@ApiBearerAuth()
export class RacksController {
  constructor(
    private readonly racksService: RacksService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create new rack' })
  async create(@Body() createRackDto: CreateRackDto, @Request() req: AuthRequest) {
    if (createRackDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createRackDto.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for racks on this site');
      }
    }
    return this.racksService.create(req.user.tenantId, createRackDto, req.user.userId);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all racks (filtered by user site access + resource permissions)' })
  async findAll(@Query() filters: FilterRackDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.racksService.findAll(req.user.tenantId, filters, accessibleSiteIds);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get rack by id with occupation details' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to racks on this site');
      }
    }
    return rack;
  }

  @Get(':id/available-spaces')
  @RequireRead()
  @ApiOperation({ summary: 'Find available spaces in rack for equipment of given height' })
  findAvailableSpaces(
    @Param('id') id: string,
    @Query('heightU') heightU: number,
    @Request() req: AuthRequest,
  ) {
    return this.racksService.findAvailableSpaces(id, req.user.tenantId, Number(heightU));
  }

  @Post(':id/mount')
  @RequireWrite()
  @ApiOperation({ summary: 'Mount equipment on rack' })
  async mountEquipment(
    @Param('id') id: string,
    @Body() mountDto: MountEquipmentDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.mountEquipment(id, req.user.tenantId, mountDto, req.user.userId);
  }

  @Delete(':id/unmount/:assetId')
  @RequireWrite()
  @ApiOperation({ summary: 'Unmount equipment from rack' })
  async unmountEquipment(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.unmountEquipment(id, assetId, req.user.tenantId, req.user.userId);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update rack' })
  async update(@Param('id') id: string, @Body() updateRackDto: UpdateRackDto, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    return this.racksService.update(id, req.user.tenantId, updateRackDto, req.user.userId, ctx);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete rack' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to delete racks on this site');
      }
    }
    return this.racksService.remove(id, req.user.tenantId, req.user.userId, ctx);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
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
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for rack' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.racksService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from rack' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.racksService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
