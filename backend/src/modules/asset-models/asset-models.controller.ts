import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
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

  @Post('import/:vendor')
  @RequireManage()
  @ApiOperation({ summary: 'Import a vendor catalog by key (e.g. "fortinet"). Super admin only.' })
  importVendor(@Param('vendor') vendor: string, @Request() req: AuthRequest) {
    return this.vendorTemplates.importVendor(vendor, req.user.tenantId);
  }

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

  /**
   * @deprecated keep the legacy endpoint for one version to avoid breaking
   * external tooling. New UIs call `POST import/:vendor`.
   */
  @Post('import/fortinet')
  @RequireManage()
  @ApiOperation({ summary: '[Legacy] Import the bundled Fortinet catalog. Prefer POST import/:vendor' })
  importFortinet(@Request() req: AuthRequest) {
    return this.vendorTemplates.importFortinet(req.user.tenantId);
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
