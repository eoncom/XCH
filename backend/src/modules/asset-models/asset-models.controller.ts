import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetModelsService } from './asset-models.service';
import { VendorTemplatesService } from './vendor-templates.service';
import { CreateAssetModelDto, UpdateAssetModelDto, FilterAssetModelDto } from './dto/create-asset-model.dto';
import { UploadCatalogDto } from './dto/upload-catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { AuthRequest } from '../../types/request.interface';

/**
 * Asset models are a tenant-wide catalog.
 * Reads are open to any authenticated user (needed to pre-fill asset forms).
 * Writes (create/update/delete) are super-admin only (@SkipDelegation + @RequireWrite/Manage
 * resolves to isSuperAdmin — see PermissionGuard).
 */
@ApiTags('asset-models')
@Controller('asset-models')
@UseGuards(JwtAuthGuard)
@SkipDelegation()
@ApiBearerAuth()
export class AssetModelsController {
  constructor(
    private readonly service: AssetModelsService,
    private readonly vendorTemplates: VendorTemplatesService,
  ) {}

  /**
   * v1.4.x — Vendor-agnostic catalog imports. The UI lists the registered
   * vendors via `GET import/vendors` and triggers a specific one via
   * `POST import/:vendor`. Idempotent (upsert by (tenantId, name)).
   */
  @Get('import/vendors')
  @RequireRead()
  @ApiOperation({ summary: 'List available vendor catalogs' })
  listVendors() {
    return this.vendorTemplates.listVendors();
  }

  // NOTE: `import/upload` and `import/fortinet` MUST be declared before
  // `import/:vendor` — Nest resolves routes in declaration order and a
  // param route would otherwise swallow them (matched `:vendor='upload'`).

  /**
   * Upload an operator-provided vendor catalog JSON (Fortinet-native OR generic shape).
   * Super-admin only. The service validates the payload shape and upserts by (tenantId, name).
   * Use this when a fabricant isn't yet registered in the built-in registry.
   */
  @Post('import/upload')
  @RequireManage()
  @ApiOperation({ summary: 'Upload and import a vendor catalog JSON (super admin only)' })
  importUploaded(@Body() dto: UploadCatalogDto, @Request() req: AuthRequest) {
    return this.vendorTemplates.importCustomCatalog(req.user.tenantId, dto);
  }

  // The vendor-specific POST import/fortinet was removed in v1.4.x — the
  // generic POST import/:vendor route covers every bundled pack and the
  // POST import/upload route covers operator-uploaded ones.

  @Post('import/:vendor')
  @RequireManage()
  @ApiOperation({ summary: 'Import a vendor catalog by key (e.g. "fortinet"). Super admin only.' })
  importVendor(@Param('vendor') vendor: string, @Request() req: AuthRequest) {
    return this.vendorTemplates.importVendor(vendor, req.user.tenantId);
  }

  // ============================================================================
  // Vendor catalog packs (v1.4.x) — each imported JSON is stored as a
  // VendorCatalog row so operators can list, download, re-upload and delete
  // catalogs from the UI without touching the source code.
  // ============================================================================

  @Get('catalogs')
  @RequireRead()
  @ApiOperation({ summary: 'List vendor catalog packs for the current tenant' })
  listCatalogs(@Request() req: AuthRequest) {
    return this.vendorTemplates.listCatalogs(req.user.tenantId);
  }

  @Get('catalogs/:id/download')
  @RequireRead()
  @ApiOperation({ summary: 'Download the raw JSON payload of a stored catalog pack' })
  async downloadCatalog(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const cat = await this.vendorTemplates.getCatalogContent(req.user.tenantId, id);
    const filename = `catalog-${cat.vendor.toLowerCase().replace(/\s+/g, '-')}-${cat.version || 'latest'}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(cat.content, null, 2));
  }

  @Delete('catalogs/:id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a catalog pack. Pass ?withModels=true to also drop the linked AssetModels (only those with no assets attached)' })
  deleteCatalog(
    @Param('id') id: string,
    @Query('withModels', new DefaultValuePipe(false), ParseBoolPipe) withModels: boolean,
    @Request() req: AuthRequest,
  ) {
    return this.vendorTemplates.deleteCatalog(req.user.tenantId, id, withModels);
  }

  @Get('export')
  @RequireRead()
  @ApiOperation({ summary: 'Export matching AssetModels as a downloadable JSON pack (optional manufacturer/type/catalogId filter)' })
  async exportPack(
    @Query('manufacturer') manufacturer: string | undefined,
    @Query('type') type: string | undefined,
    @Query('catalogId') vendorCatalogId: string | undefined,
    @Request() req: AuthRequest,
    @Res() res: Response,
  ) {
    const pack = await this.vendorTemplates.exportPack(req.user.tenantId, {
      manufacturer,
      type,
      vendorCatalogId,
    });
    const slug = (manufacturer || type || 'catalog').toLowerCase().replace(/\s+/g, '-');
    const filename = `xch-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(pack, null, 2));
  }

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create an asset model' })
  create(@Body() dto: CreateAssetModelDto, @Request() req: AuthRequest) {
    return this.service.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List asset models' })
  findAll(@Query() filters: FilterAssetModelDto, @Request() req: AuthRequest) {
    return this.service.findAll(req.user.tenantId, filters);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get an asset model' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update an asset model' })
  update(@Param('id') id: string, @Body() dto: UpdateAssetModelDto, @Request() req: AuthRequest) {
    return this.service.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete an asset model (fails if assets linked)' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.remove(req.user.tenantId, id);
  }
}
