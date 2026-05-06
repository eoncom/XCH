import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, Res, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AssetModelsService } from './asset-models.service';
import { VendorTemplatesService } from './vendor-templates.service';
import { CreateAssetModelDto, UpdateAssetModelDto, FilterAssetModelDto } from './dto/create-asset-model.dto';
import { UploadCatalogDto } from './dto/upload-catalog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { AuthRequest } from '../../types/request.interface';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { AssetModelResponseDto } from './dto/asset-model.response.dto';
import { AssetModelListResponseDto } from './dto/asset-model-list.response.dto';
import {
  AssetModelImportResultResponseDto,
  AssetModelVendorResponseDto,
} from './dto/asset-model-vendor.response.dto';
import { AssetModelCatalogResponseDto } from './dto/asset-model-catalog.response.dto';
import {
  AssetModelCatalogDeletedResultResponseDto,
  AssetModelDeletedResultResponseDto,
} from './dto/asset-model-action-result.response.dto';

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

  @Get('import/vendors')
  @RequireRead()
  @ApiOperation({ summary: 'List available vendor catalogs' })
  @ApiOkResponse({ type: AssetModelVendorResponseDto, isArray: true })
  async listVendors(): Promise<AssetModelVendorResponseDto[]> {
    const vendors = await this.vendorTemplates.listVendors();
    return toResponseArray(AssetModelVendorResponseDto, vendors);
  }

  @Post('import/upload')
  @RequireManage()
  @ApiOperation({ summary: 'Upload and import a vendor catalog JSON (super admin only)' })
  @ApiCreatedResponse({ type: AssetModelImportResultResponseDto })
  async importUploaded(
    @Body() dto: UploadCatalogDto,
    @Request() req: AuthRequest,
  ): Promise<AssetModelImportResultResponseDto> {
    const result = await this.vendorTemplates.importCustomCatalog(req.user.tenantId, dto);
    return toResponse(AssetModelImportResultResponseDto, result);
  }

  @Post('import/:vendor')
  @RequireManage()
  @ApiOperation({ summary: 'Import a vendor catalog by key (e.g. "fortinet"). Super admin only.' })
  @ApiCreatedResponse({ type: AssetModelImportResultResponseDto })
  async importVendor(
    @Param('vendor') vendor: string,
    @Request() req: AuthRequest,
  ): Promise<AssetModelImportResultResponseDto> {
    const result = await this.vendorTemplates.importVendor(vendor, req.user.tenantId);
    return toResponse(AssetModelImportResultResponseDto, result);
  }

  @Get('catalogs')
  @RequireRead()
  @ApiOperation({ summary: 'List vendor catalog packs for the current tenant' })
  @ApiOkResponse({ type: AssetModelCatalogResponseDto, isArray: true })
  async listCatalogs(@Request() req: AuthRequest): Promise<AssetModelCatalogResponseDto[]> {
    const catalogs = await this.vendorTemplates.listCatalogs(req.user.tenantId);
    return toResponseArray(AssetModelCatalogResponseDto, catalogs);
  }

  @Get('catalogs/:id/download')
  @RequireRead()
  @ApiOperation({ summary: 'Download the raw JSON payload of a stored catalog pack' })
  @ApiOkResponse({ description: 'Binary JSON catalog stream (application/json attachment)' })
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
  @ApiOkResponse({ type: AssetModelCatalogDeletedResultResponseDto })
  async deleteCatalog(
    @Param('id') id: string,
    @Query('withModels', new DefaultValuePipe(false), ParseBoolPipe) withModels: boolean,
    @Request() req: AuthRequest,
  ): Promise<AssetModelCatalogDeletedResultResponseDto> {
    return this.vendorTemplates.deleteCatalog(req.user.tenantId, id, withModels);
  }

  @Get('export')
  @RequireRead()
  @ApiOperation({ summary: 'Export matching AssetModels as a downloadable JSON pack (optional manufacturer/type/catalogId filter)' })
  @ApiOkResponse({ description: 'Binary JSON pack stream (application/json attachment)' })
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
  @ApiCreatedResponse({ type: AssetModelResponseDto })
  async create(
    @Body() dto: CreateAssetModelDto,
    @Request() req: AuthRequest,
  ): Promise<AssetModelResponseDto> {
    const model = await this.service.create(req.user.tenantId, dto);
    return toResponse(AssetModelResponseDto, model);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List asset models' })
  @ApiOkResponse({ type: AssetModelListResponseDto })
  async findAll(
    @Query() filters: FilterAssetModelDto,
    @Request() req: AuthRequest,
  ): Promise<AssetModelListResponseDto> {
    const page = await this.service.findAll(req.user.tenantId, filters);
    return toResponse(AssetModelListResponseDto, page);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get an asset model' })
  @ApiOkResponse({ type: AssetModelResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<AssetModelResponseDto> {
    const model = await this.service.findOne(req.user.tenantId, id);
    return toResponse(AssetModelResponseDto, model);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update an asset model' })
  @ApiOkResponse({ type: AssetModelResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetModelDto,
    @Request() req: AuthRequest,
  ): Promise<AssetModelResponseDto> {
    const model = await this.service.update(req.user.tenantId, id, dto);
    return toResponse(AssetModelResponseDto, model);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete an asset model (fails if assets linked)' })
  @ApiOkResponse({ type: AssetModelDeletedResultResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<AssetModelDeletedResultResponseDto> {
    return this.service.remove(req.user.tenantId, id);
  }
}
