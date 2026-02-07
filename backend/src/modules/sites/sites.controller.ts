import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { UploadAttachmentDto } from '../assets/dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('sites')
@Controller('sites')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @Resource('sites') @Action('create')
  @ApiOperation({ summary: 'Create new site' })
  create(@Body() createSiteDto: CreateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.create(req.user.tenantId, createSiteDto);
  }

  @Get()
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'Get all sites' })
  findAll(@Query() filter: FilterSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.findAll(req.user.tenantId, filter);
  }

  @Get('nearby')
  @Resource('sites') @Action('read')
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
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'Get site by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Update site' })
  update(@Param('id') id: string, @Body() updateSiteDto: UpdateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.update(id, req.user.tenantId, updateSiteDto);
  }

  @Delete(':id')
  @Resource('sites') @Action('delete')
  @ApiOperation({ summary: 'Delete site' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.remove(id, req.user.tenantId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @Resource('sites') @Action('update')
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
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @Request() req: AuthRequest,
  ) {
    return this.sitesService.uploadAttachment(id, req.user.tenantId, req.user.userId, file, uploadAttachmentDto);
  }

  @Get(':id/attachments')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'List attachments for site' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.listAttachments(id, req.user.tenantId);
  }

  @Get(':id/documents')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'List ALL documents for site (aggregated: site + assets + racks + tasks)' })
  listAllDocuments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.listAllDocuments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Delete attachment from site' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.sitesService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
