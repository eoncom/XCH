import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException } from '@nestjs/common';
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
import { ResourcePermissionLevel } from '../site-access/dto/grant-site-access.dto';

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
  async create(@Body() createAssetDto: CreateAssetDto, @Request() req: AuthRequest) {
    // Check per-resource permission on the target site
    if (createAssetDto.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, createAssetDto.siteId, 'assets',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    return this.assetsService.create(req.user.tenantId, createAssetDto, req.user.userId);
  }

  @Get()
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get all assets (filtered by user site access + resource permissions)' })
  async findAll(@Query() filter: FilterAssetDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'assets',
    );
    return this.assetsService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('stats/by-type')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by type' })
  async getStatsByType(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'assets',
    );
    return this.assetsService.getStatsByType(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-site')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by site' })
  async getStatsBySite(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIdsForResource(
      req.user.tenantId,
      req.user.userId,
      'assets',
    );
    return this.assetsService.getStatsBySite(req.user.tenantId, accessibleSiteIds);
  }

  @Get(':id')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get asset by id' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    // Check per-resource read permission
    if (asset.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, asset.siteId, 'assets',
      );
      if (perm === ResourcePermissionLevel.NONE) {
        throw new ForbiddenException('No access to assets on this site');
      }
    }
    return asset;
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
  async update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req: AuthRequest) {
    // Get asset to check siteId
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, asset.siteId, 'assets',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to modify assets on this site');
      }
    }
    return this.assetsService.update(id, req.user.tenantId, updateAssetDto, req.user.userId);
  }

  @Delete(':id')
  @Resource('assets') @Action('delete')
  @ApiOperation({ summary: 'Delete asset' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.siteAccessService.getResourcePermission(
        req.user.tenantId, req.user.userId, asset.siteId, 'assets',
      );
      if (perm !== ResourcePermissionLevel.WRITE) {
        throw new ForbiddenException('Insufficient permissions to delete assets on this site');
      }
    }
    return this.assetsService.remove(id, req.user.tenantId);
  }

  // ============================================================================
  // MOVEMENT HISTORY
  // ============================================================================

  @Get(':id/movements')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get movement history for asset' })
  getMovementHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.getMovementHistory(id, req.user.tenantId);
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
