import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { FilterSiteDto } from './dto/filter-site.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('sites')
@Controller('sites')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @Resource('sites') @Action('create')
  @ApiOperation({ summary: 'Create new site' })
  create(@Body() createSiteDto: CreateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.create(req.user.tenantId, createSiteDto);
  }

  @Get()
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'Get all sites' })
  findAll(@Query() filter: FilterSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.findAll(req.user.tenantId, filter);
  }

  @Get('nearby')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'Find sites nearby a location' })
  findNearby(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius') radius: number,
    @Request() req: AuthRequest,
  ) {
    return this.sitesService.findNearby(latitude, longitude, radius || 10, req.user.tenantId);
  }

  @Get(':id')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'Get site by id' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Update site' })
  update(@Param('id') id: string, @Body() updateSiteDto: UpdateSiteDto, @Request() req: AuthRequest) {
    return this.sitesService.update(id, req.user.tenantId, updateSiteDto);
  }

  @Delete(':id')
  @Resource('sites') @Action('delete')
  @ApiOperation({ summary: 'Delete site' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.sitesService.remove(id, req.user.tenantId);
  }
}
