import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingEntitiesService } from './billing-entities.service';
import { CreateBillingEntityDto, UpdateBillingEntityDto } from './dto/create-billing-entity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('billing-entities')
@Controller('billing-entities')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class BillingEntitiesController {
  constructor(private readonly billingEntitiesService: BillingEntitiesService) {}

  @Post()
  @Resource('billing-entities') @Action('create')
  @ApiOperation({ summary: 'Create a billing entity' })
  create(@Body() dto: CreateBillingEntityDto, @Request() req: AuthRequest) {
    return this.billingEntitiesService.create(req.user.tenantId, dto);
  }

  @Get()
  @Resource('billing-entities') @Action('read')
  @ApiOperation({ summary: 'List all billing entities' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'scopeType', required: false })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiQuery({ name: 'forScopeType', required: false, description: 'Hierarchical filter: include entities visible at this scope' })
  @ApiQuery({ name: 'forScopeId', required: false })
  findAll(
    @Query('type') type: string,
    @Query('isActive') isActive: string,
    @Query('search') search: string,
    @Query('scopeType') scopeType: string,
    @Query('scopeId') scopeId: string,
    @Query('forScopeType') forScopeType: string,
    @Query('forScopeId') forScopeId: string,
    @Request() req: AuthRequest,
  ) {
    return this.billingEntitiesService.findAll(req.user.tenantId, {
      type, isActive, search, scopeType, scopeId, forScopeType, forScopeId,
    });
  }

  @Get(':id')
  @Resource('billing-entities') @Action('read')
  @ApiOperation({ summary: 'Get a billing entity' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.findOne(req.user.tenantId, id);
  }

  @Get(':id/summary')
  @Resource('billing-entities') @Action('read')
  @ApiOperation({ summary: 'Get billing entity summary (totals)' })
  getSummary(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.getSummary(req.user.tenantId, id);
  }

  @Patch(':id')
  @Resource('billing-entities') @Action('update')
  @ApiOperation({ summary: 'Update a billing entity' })
  update(@Param('id') id: string, @Body() dto: UpdateBillingEntityDto, @Request() req: AuthRequest) {
    return this.billingEntitiesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Resource('billing-entities') @Action('delete')
  @ApiOperation({ summary: 'Delete a billing entity' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.remove(req.user.tenantId, id);
  }
}
