import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { csvFileFilter, attachmentFileFilter } from '../../common/utils/upload-security';

const CSV_IMPORT_LIMITS = { fileSize: 10 * 1024 * 1024 };       // 10 MB
const ATTACHMENT_LIMITS = { fileSize: 25 * 1024 * 1024 };       // 25 MB
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
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';
import { ExpensesService } from '../expenses/expenses.service';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { AssetResponseDto } from './dto/asset.response.dto';
import { AssetListResponseDto } from './dto/asset-list.response.dto';
import {
  AssetStatsBySiteResponseDto,
  AssetStatsByTypeResponseDto,
} from './dto/asset-stats.response.dto';
import {
  AssetImportPreviewResponseDto,
  AssetImportResultResponseDto,
  AssetImportTemplateResponseDto,
} from './dto/asset-import.response.dto';
import {
  AssetBulkQRCodeResponseDto,
  AssetQRCodeResponseDto,
} from './dto/asset-qrcode.response.dto';
import { AssetAttachmentResponseDto } from './dto/asset-attachment.response.dto';
import { AssetMovementResponseDto } from './dto/asset-movement.response.dto';
import {
  AssetAttachmentDeletedResultResponseDto,
  AssetBatchUpdateResultResponseDto,
  AssetDeletedResultResponseDto,
} from './dto/asset-action-result.response.dto';
import { AssetExpenseResultResponseDto } from './dto/asset-expense-result.response.dto';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly permissionService: PermissionService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create new asset' })
  @ApiCreatedResponse({ type: AssetResponseDto })
  async create(
    @Body() createAssetDto: CreateAssetDto,
    @Request() req: AuthRequest,
  ): Promise<AssetResponseDto> {
    if (createAssetDto.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, createAssetDto.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    const asset = await this.assetsService.create(req.user.tenantId, createAssetDto, req.user.userId);
    return toResponse(AssetResponseDto, asset);
  }

  @Post('import')
  @RequireWrite()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Import assets from CSV file' })
  @ApiCreatedResponse({ type: AssetImportResultResponseDto })
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
  @UseInterceptors(FileInterceptor('file', { limits: CSV_IMPORT_LIMITS, fileFilter: csvFileFilter }))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Request() req: AuthRequest,
  ): Promise<AssetImportResultResponseDto> {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    if (siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    const csvContent = file.buffer.toString('utf-8');
    const result = await this.assetsService.importFromCsv(req.user.tenantId, csvContent, siteId);
    return toResponse(AssetImportResultResponseDto, result);
  }

  @Post('import/preview')
  @RequireWrite()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Preview CSV import (dry-run): returns valid rows + invalid rows with errors' })
  @ApiOkResponse({ type: AssetImportPreviewResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        siteId: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: CSV_IMPORT_LIMITS, fileFilter: csvFileFilter }))
  async importPreview(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Request() req: AuthRequest,
  ): Promise<AssetImportPreviewResponseDto> {
    if (!file) throw new BadRequestException('CSV file is required');
    if (siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    const csvContent = file.buffer.toString('utf-8');
    const preview = await this.assetsService.previewImportFromCsv(req.user.tenantId, csvContent, siteId);
    return toResponse(AssetImportPreviewResponseDto, preview);
  }

  @Post('import/commit')
  @RequireWrite()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Commit CSV import (writes to DB) — same as /import but named for clarity' })
  @ApiCreatedResponse({ type: AssetImportResultResponseDto })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        siteId: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: CSV_IMPORT_LIMITS, fileFilter: csvFileFilter }))
  async importCommit(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Request() req: AuthRequest,
  ): Promise<AssetImportResultResponseDto> {
    if (!file) throw new BadRequestException('CSV file is required');
    if (siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions for assets on this site');
      }
    }
    const csvContent = file.buffer.toString('utf-8');
    const result = await this.assetsService.importFromCsv(req.user.tenantId, csvContent, siteId);
    return toResponse(AssetImportResultResponseDto, result);
  }

  @Get('import/template')
  @RequireRead()
  @ApiOperation({ summary: 'Download a CSV template for asset import' })
  @ApiOkResponse({ type: AssetImportTemplateResponseDto })
  getImportTemplate(): AssetImportTemplateResponseDto {
    const csv = this.assetsService.getImportTemplate();
    return { filename: 'asset-import-template.csv', content: csv };
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Get all assets (filtered by user site access + resource permissions)' })
  @ApiOkResponse({ type: AssetListResponseDto })
  async findAll(
    @Query() filter: FilterAssetDto,
    @Request() req: AuthRequest,
  ): Promise<AssetListResponseDto> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const page = await this.assetsService.findAll(req.user.tenantId, filter, accessibleSiteIds);
    return toResponse(AssetListResponseDto, page);
  }

  @Get('stats/by-type')
  @RequireRead()
  @ApiOperation({ summary: 'Get assets statistics by type' })
  @ApiOkResponse({ type: AssetStatsByTypeResponseDto })
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
  @ApiOkResponse({ type: AssetStatsBySiteResponseDto })
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
  @ApiOkResponse({ type: AssetBatchUpdateResultResponseDto })
  async batchUpdate(
    @Body() body: BatchUpdateAssetsDto,
    @Request() req: AuthRequest,
  ): Promise<AssetBatchUpdateResultResponseDto> {
    return this.assetsService.batchUpdate(req.user.tenantId, body);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get asset by id' })
  @ApiOkResponse({ type: AssetResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetsService.findOne(id, req.user.tenantId, ctx);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm === null) {
        throw new ForbiddenException('No access to assets on this site');
      }
    }
    return toResponse(AssetResponseDto, asset);
  }

  @Post(':id/qr-code')
  @RequireRead()
  @ApiOperation({ summary: 'Generate QR code for asset' })
  @ApiOkResponse({ type: AssetQRCodeResponseDto })
  async generateQRCode(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<AssetQRCodeResponseDto> {
    const result = await this.assetsService.generateQRCode(id, req.user.tenantId);
    return toResponse(AssetQRCodeResponseDto, result);
  }

  @Post('qrcodes/bulk')
  @RequireRead()
  @ApiOperation({ summary: 'Generate QR codes for multiple assets' })
  @ApiOkResponse({ type: AssetBulkQRCodeResponseDto })
  async bulkGenerateQRCodes(
    @Body() bulkQRCodeDto: BulkQRCodeDto,
    @Request() req: AuthRequest,
  ): Promise<AssetBulkQRCodeResponseDto> {
    const result = await this.assetsService.bulkGenerateQRCodes(bulkQRCodeDto.assetIds, req.user.tenantId);
    return toResponse(AssetBulkQRCodeResponseDto, result);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update asset' })
  @ApiOkResponse({ type: AssetResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateAssetDto: UpdateAssetDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<AssetResponseDto> {
    const asset = await this.assetsService.findOne(id, req.user.tenantId, ctx);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify assets on this site');
      }
    }
    const updated = await this.assetsService.update(id, req.user.tenantId, updateAssetDto, req.user.userId, ctx);
    return toResponse(AssetResponseDto, updated);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete asset' })
  @ApiOkResponse({ type: AssetDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<AssetDeletedResultResponseDto> {
    const asset = await this.assetsService.findOne(id, req.user.tenantId, ctx);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to delete assets on this site');
      }
    }
    return this.assetsService.remove(id, req.user.tenantId, req.user.userId, ctx);
  }

  // ============================================================================
  // MOVEMENT HISTORY
  // ============================================================================

  @Get(':id/movements')
  @RequireRead()
  @ApiOperation({ summary: 'Get movement history for asset' })
  @ApiOkResponse({ type: AssetMovementResponseDto, isArray: true })
  async getMovementHistory(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<AssetMovementResponseDto[]> {
    const movements = await this.assetsService.getMovementHistory(id, req.user.tenantId);
    return toResponseArray(AssetMovementResponseDto, movements);
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  @Post(':id/attachments')
  @RequireWrite()
  @ApiOperation({ summary: 'Upload attachment to asset' })
  @ApiCreatedResponse({ type: AssetAttachmentResponseDto })
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
  @UseInterceptors(FileInterceptor('file', { limits: ATTACHMENT_LIMITS, fileFilter: attachmentFileFilter }))
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadAttachmentDto: UploadAttachmentDto,
    @Request() req: AuthRequest,
  ): Promise<AssetAttachmentResponseDto> {
    const attachment = await this.assetsService.uploadAttachment(
      id,
      req.user.tenantId,
      req.user.userId,
      file,
      uploadAttachmentDto,
    );
    return toResponse(AssetAttachmentResponseDto, attachment);
  }

  @Get(':id/attachments')
  @RequireRead()
  @ApiOperation({ summary: 'List attachments for asset' })
  @ApiOkResponse({ type: AssetAttachmentResponseDto, isArray: true })
  async listAttachments(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<AssetAttachmentResponseDto[]> {
    const attachments = await this.assetsService.listAttachments(id, req.user.tenantId);
    return toResponseArray(AssetAttachmentResponseDto, attachments);
  }

  @Delete(':id/attachments/:attachmentId')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete attachment from asset' })
  @ApiOkResponse({ type: AssetAttachmentDeletedResultResponseDto })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: AuthRequest,
  ): Promise<AssetAttachmentDeletedResultResponseDto> {
    return this.assetsService.deleteAttachment(attachmentId, req.user.tenantId, id);
  }

  // ========== ADR-011 Inline Expense generation ==========

  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({
    summary:
      'Generate an Expense linked to this asset (ADR-011). Validates that the caller has WRITE on the target site / delegation.',
  })
  @ApiCreatedResponse({ type: AssetExpenseResultResponseDto })
  async generateExpense(
    @Param('id') id: string,
    @Body() body: { kind: 'ACQUISITION' | 'MONTHLY'; bearerId: string; label?: string; type?: string },
    @Request() req: AuthRequest,
  ): Promise<AssetExpenseResultResponseDto> {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'expenses', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to create expenses on this site');
      }
    }
    return this.expensesService.createFromAsset(
      req.user.tenantId,
      id,
      { ...body, fallbackDelegationId: req.delegationId },
      req.user.userId,
    ) as unknown as AssetExpenseResultResponseDto;
  }

  @Patch(':id/expenses/:expenseId/resync')
  @RequireWrite()
  @ApiOperation({ summary: 'Resync linked expense from asset price (ADR-011)' })
  @ApiOkResponse({ type: AssetExpenseResultResponseDto })
  async resyncExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Body() body: { kind: 'ACQUISITION' | 'MONTHLY' },
    @Request() req: AuthRequest,
  ): Promise<AssetExpenseResultResponseDto> {
    const asset = await this.assetsService.findOne(id, req.user.tenantId);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'expenses', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to edit expenses on this site');
      }
    }
    return this.expensesService.resyncExpense(req.user.tenantId, expenseId, {
      kind: 'asset',
      sourceId: id,
      assetExpenseKind: body.kind,
    }) as unknown as AssetExpenseResultResponseDto;
  }
}
