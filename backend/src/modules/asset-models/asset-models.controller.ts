import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetModelsService } from './asset-models.service';
import { CreateAssetModelDto, UpdateAssetModelDto, FilterAssetModelDto } from './dto/create-asset-model.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('asset-models')
@Controller('asset-models')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssetModelsController {
  constructor(private readonly service: AssetModelsService) {}

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
