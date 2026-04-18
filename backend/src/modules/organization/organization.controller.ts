import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { PermissionService } from '../../common/services/permission.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { AuthRequest } from '../../types/request.interface';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';
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
  createDelegation(@Body() dto: CreateDelegationDto, @Request() req: AuthRequest) {
    return this.organizationService.createDelegation(req.user.tenantId, dto, req.user.userId);
  }

  @Get('delegations')
  @RequireRead()
  @ApiOperation({
    summary:
      "List delegations — scoped to the caller's UserDelegations. Super admin sees all (including system delegations).",
  })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllDelegations(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    return this.organizationService.findAllDelegations(
      req.user.tenantId,
      includeInactive === 'true',
      req.user.isSuperAdmin ? null : req.user.userId,
    );
  }

  @Get('delegations/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a delegation with its sites' })
  findOneDelegation(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.findOneDelegation(id, req.user.tenantId);
  }

  @Patch('delegations/:id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a delegation' })
  updateDelegation(@Param('id') id: string, @Body() dto: UpdateDelegationDto, @Request() req: AuthRequest) {
    return this.organizationService.updateDelegation(id, req.user.tenantId, dto, req.user.userId);
  }

  @Delete('delegations/:id')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'Delete a delegation (super admin only — must have no sites)' })
  removeDelegation(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.removeDelegation(id, req.user.tenantId, req.user.userId);
  }

  // ============================================================================
  // ORGANIZATION TREE
  // ============================================================================

  @Get('organization/tree')
  @RequireRead()
  @ApiOperation({ summary: 'Get organization tree (delegations with sites) filtered by user access' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async getTree(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.organizationService.getTree(req.user.tenantId, includeInactive === 'true', accessibleSiteIds);
  }
}
