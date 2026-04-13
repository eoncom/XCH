import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { attachmentFileFilter } from '../../common/utils/upload-security';
import { SitesService } from './sites.service';
import { PermissionService } from '../../common/services/permission.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { PaginatedResponse } from '../../common/interfaces/paginated.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

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
  create(@Body() createSiteDto: CreateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.create(req.user.tenantId, createSiteDto, req.user.userId);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all sites (filtered by user access for TECHNICIEN/VIEWER)' })
  async findAll(@Query() filter: FilterSiteDto, @Request() req: AuthRequest): Promise<PaginatedResponse<any>> {
    // Get accessible site IDs (null = all sites for ADMIN/MANAGER)
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );

    return this.sitesService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('nearby')
  @RequireRead()
  @ApiOperation({ summary: 'Find sites nearby a location' })
  findNearby(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Request() req: AuthRequest,
  ) {
    return this.sitesService.findNearby(latitude, longitude, radius || 10, req.user.tenantId);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get site by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update site' })
  update(@Param('id') id: string, @Body() updateSiteDto: UpdateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.update(id, req.user.tenantId, updateSiteDto, req.user.userId);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete site' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.remove(id, req.user.tenantId, req.user.userId);
  }

  // ============================================================================
  // AUDIT HISTORY
  // ============================================================================

  @Get(':id/history')
  @RequireRead()
  @ApiOperation({ summary: 'Get modification history for a site' })
  getAuditHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.getAuditHistory(id, req.user.tenantId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload attachment to site' })
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
    return this.sitesService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, uploadAttachmentDto);
  }

  @Get(':id/attachments')
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for site' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.listAttachments(id, req.user.tenantId);
  }

  @Get(':id/documents')
  @RequireRead()
  @ApiOperation({ summary: 'List ALL documents for site (aggregated: site + assets + racks + tasks)' })
  listAllDocuments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.listAllDocuments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from site' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.sitesService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
