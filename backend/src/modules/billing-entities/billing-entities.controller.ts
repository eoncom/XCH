import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query, ForbiddenException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { BillingEntitiesService } from './billing-entities.service';
import { CreateBillingEntityDto, UpdateBillingEntityDto } from './dto/create-billing-entity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';
import { BillingEntityResponseDto } from './dto/billing-entity.response.dto';
import { BillingEntitySummaryResponseDto } from './dto/billing-entity-summary.response.dto';
import { BillingEntityDeletedResultResponseDto } from './dto/billing-entity-action-result.response.dto';

@ApiTags('billing-entities')
@Controller('billing-entities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingEntitiesController {
  constructor(
    private readonly billingEntitiesService: BillingEntitiesService,
    private readonly permissionService: PermissionService,
  ) {}

  private async scopeOrFail(req: AuthRequest, filterDelegationId?: string | null): Promise<string[] | null> {
    const scope = await this.permissionService.getManagedDelegationIds(
      req.user.tenantId,
      req.user.userId,
    );
    if (scope === null) return null;
    if (scope.length === 0) {
      throw new ForbiddenException('Aucune délégation managée — accès refusé.');
    }
    if (filterDelegationId && !scope.includes(filterDelegationId)) {
      throw new ForbiddenException('Délégation hors périmètre managé.');
    }
    return scope;
  }

  @Post()
  @RequireManage()
  @ApiOperation({ summary: 'Create a billing entity' })
  @ApiCreatedResponse({ type: BillingEntityResponseDto })
  async create(@Body() dto: CreateBillingEntityDto, @Request() req: AuthRequest) {
    const scope = await this.scopeOrFail(req, dto.delegationId ?? undefined);
    if (scope !== null && !dto.delegationId) {
      throw new ForbiddenException(
        'Un centre de coût global (sans délégation) est réservé aux super administrateurs.',
      );
    }
    return this.billingEntitiesService.create(req.user.tenantId, dto);
  }

  @Get()
  @RequireManage()
  @ApiOperation({ summary: 'List all billing entities (managed delegations + globals)' })
  @ApiOkResponse({ type: BillingEntityResponseDto, isArray: true })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'delegationId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'includeGlobal', required: false })
  async findAll(
    @Query('type') type: string,
    @Query('isActive') isActive: string,
    @Query('search') search: string,
    @Query('delegationId') delegationId: string,
    @Query('siteId') siteId: string,
    @Query('includeGlobal') includeGlobal: string,
    @Request() req: AuthRequest,
  ) {
    const scope = await this.scopeOrFail(req, delegationId);
    return this.billingEntitiesService.findAll(
      req.user.tenantId,
      { type, isActive, search, delegationId, siteId, includeGlobal: includeGlobal !== 'false' },
      scope,
    );
  }

  @Get(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Get a billing entity' })
  @ApiOkResponse({ type: BillingEntityResponseDto })
  async findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const entity = await this.billingEntitiesService.findOne(req.user.tenantId, id, ctx);
    if ((entity as { delegationId?: string }).delegationId) {
      await this.scopeOrFail(req, (entity as { delegationId?: string }).delegationId);
    }
    return entity;
  }

  @Get(':id/summary')
  @RequireManage()
  @ApiOperation({ summary: 'Get billing entity summary (totals)' })
  @ApiOkResponse({ type: BillingEntitySummaryResponseDto })
  async getSummary(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const entity = await this.billingEntitiesService.findOne(req.user.tenantId, id, ctx);
    if ((entity as { delegationId?: string }).delegationId) {
      await this.scopeOrFail(req, (entity as { delegationId?: string }).delegationId);
    }
    return this.billingEntitiesService.getSummary(req.user.tenantId, id);
  }

  @Patch(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Update a billing entity' })
  @ApiOkResponse({ type: BillingEntityResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateBillingEntityDto, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const existing = await this.billingEntitiesService.findOne(req.user.tenantId, id, ctx);
    if ((existing as { delegationId?: string }).delegationId) {
      await this.scopeOrFail(req, (existing as { delegationId?: string }).delegationId);
    } else {
      const scope = await this.scopeOrFail(req);
      if (scope !== null) {
        throw new ForbiddenException('Seul un super administrateur peut modifier un centre de coût global.');
      }
    }
    if (dto.delegationId) await this.scopeOrFail(req, dto.delegationId);
    return this.billingEntitiesService.update(req.user.tenantId, id, dto, ctx);
  }

  @Delete(':id')
  @RequireManage()
  @ApiOperation({ summary: 'Delete a billing entity' })
  @ApiOkResponse({ type: BillingEntityDeletedResultResponseDto })
  async remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    const existing = await this.billingEntitiesService.findOne(req.user.tenantId, id, ctx);
    if ((existing as { delegationId?: string }).delegationId) {
      await this.scopeOrFail(req, (existing as { delegationId?: string }).delegationId);
    } else {
      const scope = await this.scopeOrFail(req);
      if (scope !== null) {
        throw new ForbiddenException('Seul un super administrateur peut supprimer un centre de coût global.');
      }
    }
    return this.billingEntitiesService.remove(req.user.tenantId, id, ctx);
  }
}
