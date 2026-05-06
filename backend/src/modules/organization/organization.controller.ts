import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { PermissionService } from '../../common/services/permission.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import {
  DelegationResponseDto,
  DelegationDeletedResultResponseDto,
  DelegationTreeNodeResponseDto,
} from './dto/delegation.response.dto';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import { AuthRequest } from '../../types/request.interface';
import { RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';

@ApiTags('organization')
@Controller()
@ApiBearerAuth()
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly permissionService: PermissionService,
  ) {}

  // ============================================================================
  // DELEGATIONS
  // ============================================================================

  @Post('delegations')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Create a delegation (super admin only — tenant-wide organization structure)' })
  @ApiCreatedResponse({ type: DelegationResponseDto })
  async createDelegation(@Body() dto: CreateDelegationDto, @Request() req: AuthRequest): Promise<DelegationResponseDto> {
    const created = await this.organizationService.createDelegation(req.user.tenantId, dto, req.user.userId);
    return toResponse(DelegationResponseDto, created);
  }

  @Get('delegations')
  @RequireRead()
  @ApiOperation({
    summary:
      "List delegations — scoped to the caller's UserDelegations. Super admin sees all (including system delegations).",
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOkResponse({ type: [DelegationResponseDto] })
  async findAllDelegations(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ): Promise<DelegationResponseDto[]> {
    const rows = await this.organizationService.findAllDelegations(
      req.user.tenantId,
      includeInactive === 'true',
      req.user.isSuperAdmin ? null : req.user.userId,
    );
    return toResponseArray(DelegationResponseDto, rows);
  }

  @Get('delegations/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a delegation with its sites' })
  @ApiOkResponse({ type: DelegationResponseDto })
  async findOneDelegation(@Param('id') id: string, @Request() req: AuthRequest): Promise<DelegationResponseDto> {
    const row = await this.organizationService.findOneDelegation(id, req.user.tenantId);
    return toResponse(DelegationResponseDto, row);
  }

  @Patch('delegations/:id')
  @RequireManage()
  @ApiOperation({ summary: 'Update a delegation (MANAGE on the delegation — see AUTH_MODEL §7 “Ma délégation”)' })
  @ApiOkResponse({ type: DelegationResponseDto })
  async updateDelegation(@Param('id') id: string, @Body() dto: UpdateDelegationDto, @Request() req: AuthRequest): Promise<DelegationResponseDto> {
    const updated = await this.organizationService.updateDelegation(id, req.user.tenantId, dto, req.user.userId);
    return toResponse(DelegationResponseDto, updated);
  }

  @Delete('delegations/:id')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Delete a delegation (super admin only — must have no sites)' })
  @ApiOkResponse({ type: DelegationDeletedResultResponseDto })
  async removeDelegation(@Param('id') id: string, @Request() req: AuthRequest): Promise<DelegationDeletedResultResponseDto> {
    const result = await this.organizationService.removeDelegation(id, req.user.tenantId, req.user.userId);
    return toResponse(DelegationDeletedResultResponseDto, result);
  }

  // ============================================================================
  // ORGANIZATION TREE
  // ============================================================================

  @Get('organization/tree')
  @RequireRead()
  @ApiOperation({ summary: 'Get organization tree (delegations with sites) filtered by user access' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiOkResponse({ type: [DelegationTreeNodeResponseDto], description: 'Delegations with their accessible sites' })
  async getTree(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ): Promise<DelegationTreeNodeResponseDto[]> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const rows = await this.organizationService.getTree(req.user.tenantId, includeInactive === 'true', accessibleSiteIds);
    return toResponseArray(DelegationTreeNodeResponseDto, rows);
  }
}
