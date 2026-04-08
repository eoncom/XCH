import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { SiteAccessService } from '../site-access/site-access.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('organization')
@Controller()
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  // ============================================================================
  // DELEGATIONS
  // ============================================================================

  @Post('delegations')
  @Resource('delegations') @Action('create')
  @ApiOperation({ summary: 'Create a delegation' })
  createDelegation(@Body() dto: CreateDelegationDto, @Request() req: AuthRequest) {
    return this.organizationService.createDelegation(req.user.tenantId, dto, req.user.userId);
  }

  @Get('delegations')
  @Resource('delegations') @Action('read')
  @ApiOperation({ summary: 'List all delegations' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllDelegations(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    return this.organizationService.findAllDelegations(req.user.tenantId, includeInactive === 'true');
  }

  @Get('delegations/:id')
  @Resource('delegations') @Action('read')
  @ApiOperation({ summary: 'Get a delegation with its sites' })
  findOneDelegation(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.findOneDelegation(id, req.user.tenantId);
  }

  @Patch('delegations/:id')
  @Resource('delegations') @Action('update')
  @ApiOperation({ summary: 'Update a delegation' })
  updateDelegation(@Param('id') id: string, @Body() dto: UpdateDelegationDto, @Request() req: AuthRequest) {
    return this.organizationService.updateDelegation(id, req.user.tenantId, dto, req.user.userId);
  }

  @Delete('delegations/:id')
  @Resource('delegations') @Action('delete')
  @ApiOperation({ summary: 'Delete a delegation (must have no sites)' })
  removeDelegation(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.removeDelegation(id, req.user.tenantId, req.user.userId);
  }

  // ============================================================================
  // ORGANIZATION TREE
  // ============================================================================

  @Get('organization/tree')
  @Resource('delegations') @Action('read')
  @ApiOperation({ summary: 'Get organization tree (delegations with sites) filtered by user access' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async getTree(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.organizationService.getTree(req.user.tenantId, includeInactive === 'true', accessibleSiteIds);
  }
}
