import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
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
import { SitesService } from './sites.service';
import { PermissionService } from '../../common/services/permission.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { SiteResponseDto } from './dto/site.response.dto';
import { SiteListResponseDto } from './dto/site-list.response.dto';
import { SiteAttachmentResponseDto } from './dto/site-attachment.response.dto';
import { SiteDocumentResponseDto } from './dto/site-document.response.dto';
import { SiteAuditLogResponseDto } from './dto/site-audit-log.response.dto';
import {
  SiteAttachmentDeletedResultResponseDto,
  SiteDeletedResultResponseDto,
} from './dto/site-action-result.response.dto';

@ApiTags('sites')
@Controller('sites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(
    private readonly sitesService: SitesService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create new site' })
  @ApiCreatedResponse({ type: SiteResponseDto })
  async create(
    @Body() createSiteDto: CreateSiteDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SiteResponseDto> {
    const site = await this.sitesService.create(req.user.tenantId, createSiteDto, req.user.userId, ctx);
    return toResponse(SiteResponseDto, site);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all sites (filtered by user access for TECHNICIEN/VIEWER)' })
  @ApiOkResponse({ type: SiteListResponseDto })
  async findAll(
    @Query() filter: FilterSiteDto,
    @Request() req: AuthRequest,
  ): Promise<SiteListResponseDto> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const page = await this.sitesService.findAll(req.user.tenantId, filter, accessibleSiteIds);
    return toResponse(SiteListResponseDto, page);
  }

  @Get('nearby')
  @RequireRead()
  @ApiOperation({ summary: 'Find sites nearby a location' })
  @ApiOkResponse({ type: SiteResponseDto, isArray: true })
  async findNearby(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Request() req: AuthRequest,
  ): Promise<SiteResponseDto[]> {
    const sites = (await this.sitesService.findNearby(
      latitude,
      longitude,
      radius || 10,
      req.user.tenantId,
    )) as unknown[];
    return toResponseArray(SiteResponseDto, sites);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get site by id' })
  @ApiOkResponse({ type: SiteResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SiteResponseDto> {
    const site = await this.sitesService.findOne(id, req.user.tenantId, ctx);
    return toResponse(SiteResponseDto, site);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update site' })
  @ApiOkResponse({ type: SiteResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SiteResponseDto> {
    const site = await this.sitesService.update(id, req.user.tenantId, updateSiteDto, req.user.userId, ctx);
    return toResponse(SiteResponseDto, site);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete site' })
  @ApiOkResponse({ type: SiteDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SiteDeletedResultResponseDto> {
    return this.sitesService.remove(id, req.user.tenantId, req.user.userId, ctx);
  }

  // ============================================================================
  // AUDIT HISTORY
  // ============================================================================

  @Get(':id/history')
  @RequireRead()
  @ApiOperation({ summary: 'Get modification history for a site' })
  @ApiOkResponse({ type: SiteAuditLogResponseDto, isArray: true })
  async getAuditHistory(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<SiteAuditLogResponseDto[]> {
    const history = await this.sitesService.getAuditHistory(id, req.user.tenantId);
    return toResponseArray(SiteAuditLogResponseDto, history);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload attachment to site' })
  @ApiCreatedResponse({ type: SiteAttachmentResponseDto })
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
  ): Promise<SiteAttachmentResponseDto> {
    const attachment = await this.sitesService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, uploadAttachmentDto);
    return toResponse(SiteAttachmentResponseDto, attachment);
  }

  @Get(':id/attachments')
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for site' })
  @ApiOkResponse({ type: SiteAttachmentResponseDto, isArray: true })
  async listAttachments(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<SiteAttachmentResponseDto[]> {
    const attachments = await this.sitesService.listAttachments(id, req.user.tenantId);
    return toResponseArray(SiteAttachmentResponseDto, attachments);
  }

  @Get(':id/documents')
  @RequireRead()
  @ApiOperation({ summary: 'List ALL documents for site (aggregated: site + assets + racks + tasks)' })
  @ApiOkResponse({ type: SiteDocumentResponseDto, isArray: true })
  async listAllDocuments(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<SiteDocumentResponseDto[]> {
    const docs = await this.sitesService.listAllDocuments(id, req.user.tenantId);
    return toResponseArray(SiteDocumentResponseDto, docs);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from site' })
  @ApiOkResponse({ type: SiteAttachmentDeletedResultResponseDto })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ): Promise<SiteAttachmentDeletedResultResponseDto> {
    return this.sitesService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
