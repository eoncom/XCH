import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, UseInterceptors, UploadedFile, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { csvFileFilter, attachmentFileFilter } from '../../common/utils/upload-security';

// S1-closing 2026-04-26 — Multer fileSize limits par catégorie d'upload.
// Les FileInterceptor sans `limits` acceptent par défaut N'IMPORTE QUELLE
// taille, ce qui ouvre un DoS trivial (upload de 10 GB blocque la RAM).
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
  // CSV import : parsing + validation + bulk insert. 5/min/user empêche
  // le flood mais reste OK pour usage normal.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @UseInterceptors(FileInterceptor('file', { limits: CSV_IMPORT_LIMITS, fileFilter: csvFileFilter }))
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

  @Post('import/preview')
  @RequireWrite()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Preview CSV import (dry-run): returns valid rows + invalid rows with errors' })
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
  ) {
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
    return this.assetsService.previewImportFromCsv(req.user.tenantId, csvContent, siteId);
  }

  @Post('import/commit')
  @RequireWrite()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Commit CSV import (writes to DB) — same as /import but named for clarity' })
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
  ) {
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
    return this.assetsService.importFromCsv(req.user.tenantId, csvContent, siteId);
  }

  @Get('import/template')
  @RequireRead()
  @ApiOperation({ summary: 'Download a CSV template for asset import' })
  getImportTemplate(@Request() req: AuthRequest) {
    const csv = this.assetsService.getImportTemplate();
    return { filename: 'asset-import-template.csv', content: csv };
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
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const asset = await this.assetsService.findOne(id, req.user.tenantId, ctx);
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
  async update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    // Get asset to check siteId
    const asset = await this.assetsService.findOne(id, req.user.tenantId, ctx);
    if (asset.siteId) {
      const perm = await this.permissionService.resolve(
        req.user.userId, asset.siteId, 'assets', req.user.tenantId,
      );
      if (perm !== 'WRITE') {
        throw new ForbiddenException('Insufficient permissions to modify assets on this site');
      }
    }
    return this.assetsService.update(id, req.user.tenantId, updateAssetDto, req.user.userId, ctx);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete asset' })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
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
  @UseInterceptors(FileInterceptor('file', { limits: ATTACHMENT_LIMITS, fileFilter: attachmentFileFilter }))
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

  // ========== ADR-011 Inline Expense generation ==========

  /**
   * Generate an Expense from this asset.
   * - kind=ACQUISITION → ONE_TIME EQUIPMENT (acquisitionPrice)
   * - kind=MONTHLY     → MONTHLY LICENSE (monthlyPrice)
   * Multiple expenses can be linked over time (1:N via Expense.assetId).
   */
  @Post(':id/generate-expense')
  @RequireWrite()
  @ApiOperation({
    summary:
      'Generate an Expense linked to this asset (ADR-011). Validates that the caller has WRITE on the target site / delegation.',
  })
  async generateExpense(
    @Param('id') id: string,
    @Body() body: { kind: 'ACQUISITION' | 'MONTHLY'; bearerId: string; label?: string; type?: string },
    @Request() req: AuthRequest,
  ) {
    // Resolve permission per-resource (scoped check, same pattern as create())
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
    );
  }

  /**
   * Resync the totalAmount of an Expense linked to this asset, based on the
   * current asset/AssetModel price. Frozen-by-default policy (ADR-011 §2):
   * this is the explicit way to refresh after a price update.
   */
  @Patch(':id/expenses/:expenseId/resync')
  @RequireWrite()
  @ApiOperation({ summary: 'Resync linked expense from asset price (ADR-011)' })
  async resyncExpense(
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Body() body: { kind: 'ACQUISITION' | 'MONTHLY' },
    @Request() req: AuthRequest,
  ) {
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
    });
  }
}
