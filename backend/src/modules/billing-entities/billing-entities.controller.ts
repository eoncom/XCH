import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingEntitiesService } from './billing-entities.service';
import { CreateBillingEntityDto, UpdateBillingEntityDto } from './dto/create-billing-entity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('billing-entities')
@Controller('billing-entities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingEntitiesController {
  constructor(private readonly billingEntitiesService: BillingEntitiesService) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a billing entity' })
  create(@Body() dto: CreateBillingEntityDto, @Request() req: AuthRequest) {
    return this.billingEntitiesService.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List all billing entities' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'delegationId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'includeGlobal', required: false })
  findAll(
    @Query('type') type: string,
    @Query('isActive') isActive: string,
    @Query('search') search: string,
    @Query('delegationId') delegationId: string,
    @Query('siteId') siteId: string,
    @Query('includeGlobal') includeGlobal: string,
    @Request() req: AuthRequest,
  ) {
    return this.billingEntitiesService.findAll(req.user.tenantId, {
      type, isActive, search, delegationId, siteId, includeGlobal: includeGlobal !== 'false',
    });
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a billing entity' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.findOne(req.user.tenantId, id);
  }

  @Get(':id/summary')
  @RequireRead()
  @ApiOperation({ summary: 'Get billing entity summary (totals)' })
  getSummary(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.getSummary(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a billing entity' })
  update(@Param('id') id: string, @Body() dto: UpdateBillingEntityDto, @Request() req: AuthRequest) {
    return this.billingEntitiesService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a billing entity' })
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.billingEntitiesService.remove(req.user.tenantId, id);
  }
}
