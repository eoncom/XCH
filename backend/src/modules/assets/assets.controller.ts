import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { FilterAssetDto } from './dto/filter-asset.dto';
import { BulkQRCodeDto } from './dto/bulk-qrcode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Resource('assets') @Action('create')
  @ApiOperation({ summary: 'Create new asset' })
  create(@Body() createAssetDto: CreateAssetDto, @Request() req: AuthRequest) {
    return this.assetsService.create(req.user.tenantId, createAssetDto);
  }

  @Get()
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get all assets' })
  findAll(@Query() filter: FilterAssetDto, @Request() req: AuthRequest) {
    return this.assetsService.findAll(req.user.tenantId, filter);
  }

  @Get('stats/by-type')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by type' })
  getStatsByType(@Request() req: AuthRequest) {
    return this.assetsService.getStatsByType(req.user.tenantId);
  }

  @Get('stats/by-site')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get assets statistics by site' })
  getStatsBySite(@Request() req: AuthRequest) {
    return this.assetsService.getStatsBySite(req.user.tenantId);
  }

  @Get(':id')
  @Resource('assets') @Action('read')
  @ApiOperation({ summary: 'Get asset by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.assetsService.findOne(id, req.user.tenantId);
  }

  @Get(':id/qrcode')
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
}
