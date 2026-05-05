import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException } from '@nestjs/common';
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
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { RackResponseDto } from './dto/rack.response.dto';
import { RackListResponseDto } from './dto/rack-list.response.dto';
import { RackMountResultResponseDto } from './dto/rack-mount-result.response.dto';
import { RackAvailableSpacesResponseDto } from './dto/rack-available-spaces.response.dto';
import { RackAttachmentResponseDto } from './dto/rack-attachment.response.dto';
import {
  RackAttachmentDeletedResultResponseDto,
  RackDeletedResultResponseDto,
} from './dto/rack-action-result.response.dto';

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
  @ApiCreatedResponse({ type: RackResponseDto })
  async create(
    @Body() createRackDto: CreateRackDto,
    @Request() req: AuthRequest,
  ): Promise<RackResponseDto> {
    if (createRackDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createRackDto.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for racks on this site');
      }
    }
    const rack = await this.racksService.create(req.user.tenantId, createRackDto, req.user.userId);
    return toResponse(RackResponseDto, rack);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all racks (filtered by user site access + resource permissions)' })
  @ApiOkResponse({ type: RackListResponseDto })
  async findAll(
    @Query() filters: FilterRackDto,
    @Request() req: AuthRequest,
  ): Promise<RackListResponseDto> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const page = await this.racksService.findAll(req.user.tenantId, filters, accessibleSiteIds);
    return toResponse(RackListResponseDto, page);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get rack by id with occupation details' })
  @ApiOkResponse({ type: RackResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<RackResponseDto> {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to racks on this site');
      }
    }
    return toResponse(RackResponseDto, rack);
  }

  @Get(':id/available-spaces')
  @RequireRead()
  @ApiOperation({ summary: 'Find available spaces in rack for equipment of given height' })
  @ApiOkResponse({ type: RackAvailableSpacesResponseDto })
  async findAvailableSpaces(
    @Param('id') id: string,
    @Query('heightU') heightU: number,
    @Request() req: AuthRequest,
  ): Promise<RackAvailableSpacesResponseDto> {
    const result = await this.racksService.findAvailableSpaces(id, req.user.tenantId, Number(heightU));
    return toResponse(RackAvailableSpacesResponseDto, result);
  }

  @Post(':id/mount')
  @RequireWrite()
  @ApiOperation({ summary: 'Mount equipment on rack' })
  @ApiOkResponse({ type: RackMountResultResponseDto })
  async mountEquipment(
    @Param('id') id: string,
    @Body() mountDto: MountEquipmentDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<RackMountResultResponseDto> {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    const result = await this.racksService.mountEquipment(id, req.user.tenantId, mountDto, req.user.userId);
    return toResponse(RackMountResultResponseDto, result);
  }

  @Delete(':id/unmount/:assetId')
  @RequireWrite()
  @ApiOperation({ summary: 'Unmount equipment from rack' })
  @ApiOkResponse({ type: RackMountResultResponseDto })
  async unmountEquipment(
    @Param('id') id: string,
    @Param('assetId') assetId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<RackMountResultResponseDto> {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    const result = await this.racksService.unmountEquipment(id, assetId, req.user.tenantId, req.user.userId);
    return toResponse(RackMountResultResponseDto, result);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update rack' })
  @ApiOkResponse({ type: RackResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateRackDto: UpdateRackDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<RackResponseDto> {
    const rack = await this.racksService.findOne(id, req.user.tenantId, ctx);
    if (rack.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, rack.siteId, 'racks', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify racks on this site');
      }
    }
    const updated = await this.racksService.update(id, req.user.tenantId, updateRackDto, req.user.userId, ctx);
    return toResponse(RackResponseDto, updated);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete rack' })
  @ApiOkResponse({ type: RackDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<RackDeletedResultResponseDto> {
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
  @ApiCreatedResponse({ type: RackAttachmentResponseDto })
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
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @Request() req: AuthRequest,
  ): Promise<RackAttachmentResponseDto> {
    const attachment = await this.racksService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, uploadAttachmentDto);
    return toResponse(RackAttachmentResponseDto, attachment);
  }

  @Get(':id/attachments')
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for rack' })
  @ApiOkResponse({ type: RackAttachmentResponseDto, isArray: true })
  async listAttachments(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<RackAttachmentResponseDto[]> {
    const attachments = await this.racksService.listAttachments(id, req.user.tenantId);
    return toResponseArray(RackAttachmentResponseDto, attachments);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from rack' })
  @ApiOkResponse({ type: RackAttachmentDeletedResultResponseDto })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ): Promise<RackAttachmentDeletedResultResponseDto> {
    return this.racksService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
