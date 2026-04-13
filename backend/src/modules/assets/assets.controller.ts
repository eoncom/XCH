import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { BatchUpdateAssetsDto } from './dto/batch-update-asset.dto';
import { BulkQRCodeDto } from './dto/bulk-qrcode.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly permissionService: PermissionService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create new asset' })
  async create(@Body() createAssetDto: CreateAssetDto, @Request() req: AuthRequest) {
    // Check per-resource permission on the target site
    if (createAssetDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createAssetDto.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    return this.assetsService.create(req.user.tenantId, createAssetDto, req.user.userId);
  }

  @Post('import')
  @RequireWrite()
  @ApiOperation({ summary: 'Import assets from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file to import' },
        siteId: { type: 'string', description: 'Optional site ID to assign all imported assets to' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Request() req: AuthRequest,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    // Validate site access if siteId is provided
    if (siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    const csvContent = file.buffer.toString('utf-8');
    return this.assetsService.importFromCsv(req.user.tenantId, csvContent, siteId);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all assets (filtered by user site access + resource permissions)' })
  async findAll(@Query() filter: FilterAssetDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.findAll(req.user.tenantId, filter, accessibleSiteIds);
  }

  @Get('stats/by-type')
  @RequireRead()
  @ApiOperation({ summary: 'Get assets statistics by type' })
  async getStatsByType(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.getStatsByType(req.user.tenantId, accessibleSiteIds);
  }

  @Get('stats/by-site')
  @RequireRead()
  @ApiOperation({ summary: 'Get assets statistics by site' })
  async getStatsBySite(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.assetsService.getStatsBySite(req.user.tenantId, accessibleSiteIds);
  }

  @Patch('batch')
  @RequireWrite()
  @ApiOperation({ summary: 'Batch update multiple assets (status and/or site)' })
  async batchUpdate(@Body() body: BatchUpdateAssetsDto, @Request() req: AuthRequest) {
    return this.assetsService.batchUpdate(req.user.tenantId, body);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get asset by id' })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    // Check per-resource read permission
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to assets on this site');
      }
    }
    return asset;
  }

  @Post(':id/qr-code')
  @RequireRead()
  @ApiOperation({ summary: 'Generate QR code for asset' })
  generateQRCode(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.generateQRCode(id, req.user.tenantId);
  }

  @Post('qrcodes/bulk')
  @RequireRead()
  @ApiOperation({ summary: 'Generate QR codes for multiple assets' })
  bulkGenerateQRCodes(@Body() bulkQRCodeDto: BulkQRCodeDto, @Request() req: AuthRequest) {
    return this.assetsService.bulkGenerateQRCodes(bulkQRCodeDto.assetIds, req.user.tenantId);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update asset' })
  async update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req: AuthRequest) {
    // Get asset to check siteId
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify assets on this site');
      }
    }
    return this.assetsService.update(id, req.user.tenantId, updateAssetDto, req.user.userId);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete asset' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest) {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to delete assets on this site');
      }
    }
    return this.assetsService.remove(id, req.user.tenantId, req.user.userId);
  }

  // ============================================================================
  // MOVEMENT HISTORY
  // ============================================================================

  @Get(':id/movements')
  @RequireRead()
  @ApiOperation({ summary: 'Get movement history for asset' })
  getMovementHistory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.getMovementHistory(id, req.user.tenantId);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
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
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for asset' })
  listAttachments(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.listAttachments(id, req.user.tenantId);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from asset' })
  deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ) {
    return this.assetsService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }
}
