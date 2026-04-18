import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetModelsService } from './asset-models.service';
import { VendorTemplatesService } from './vendor-templates.service';
import { CreateAssetModelDto, UpdateAssetModelDto, FilterAssetModelDto } from './dto/create-asset-model.dto';
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
   * v1.4.x — Bulk-import the bundled Fortinet vendor catalog into AssetModel.
   * Super-admin only (SkipDelegation + RequireManage pattern). Idempotent:
   * re-running upserts by (tenantId, name), preserving operator-customised
   * notes when they've been edited manually.
   */
  @Post('import/fortinet')
  @RequireManage()
  @ApiOperation({ summary: 'Import the bundled Fortinet catalog (super admin only)' })
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
