import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { BulkQRCodeDto } from './dto/bulk-qrcode.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { SiteAccessService } from '../site-access/site-access.service';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Post()
  @Resource('assets') @Action('create')
  @ApiOperation({ summary: 'Create new asset' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req: AuthRequest) {
    return this.assetsService.create(req.user.tenantId, createAssetDto);
  }

  @Get()
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get all assets (filtered by user site access)' })
  async findAll(@Query() filter: FilterAssetDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('stats/by-type')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by type' })
  async getStatsByType(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.getStatsByType(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-site')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by site' })
  async getStatsBySite(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.getStatsBySite(req.user.tenantId, accessibleSiteIds);
  }

  @Get(':id')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get asset by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.findOne(id, req.user.tenantId);
  }

  @Post(':id/qr-code')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Generate QR code for asset' })
  generateQRCode(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.generateQRCode(id, req.user.tenantId);
  }

  @Post('qrcodes/bulk')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Generate QR codes for multiple assets' })
  bulkGenerateQRCodes(@Body() bulkQRCodeDto: BulkQRCodeDto, @Request() req: AuthRequest) {
    return this.assetsService.bulkGenerateQRCodes(bulkQRCodeDto.assetIds, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('assets') @Action('update')
  @ApiOperation({ summary: 'Update asset' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req: AuthRequest) {
    return this.assetsService.update(id, req.user.tenantId, updateAssetDto);
  }

  @Delete(':id')
  @Resource('assets') @Action('delete')
  @ApiOperation({ summary: 'Delete asset' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.remove(id, req.user.tenantId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @Resource('assets') @Action('update')
  @ApiOperation({ summary: 'Upload attachment to asset' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        description: {
          type: 'string',
        },
        category: {
          type: 'string',
          enum: ['spec', 'invoice', 'photo', 'report', 'manual', 'other'],
        },
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
    return this.assetsService.uploadAttachment(
      id,
      req.user.tenantId,
      req.user.userId,
      file,
      uploadAttachmentDto,
    );
  }

  @Get(':id/attachments')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'List attachments for asset' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @Resource('assets') @Action('update')
  @ApiOperation({ summary: 'Delete attachment from asset' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.assetsService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
