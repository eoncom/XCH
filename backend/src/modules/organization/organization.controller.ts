import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
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
  constructor(private readonly organizationService: OrganizationService) {}

  // ============================================================================
  // DIVISIONS
  // ============================================================================

  @Post('divisions')
  @Resource('divisions') @Action('create')
  @ApiOperation({ summary: 'Create a division' })
  createDivision(@Body() dto: CreateDivisionDto, @Request() req: AuthRequest) {
    return this.organizationService.createDivision(req.user.tenantId, dto, req.user.userId);
  }

  @Get('divisions')
  @Resource('divisions') @Action('read')
  @ApiOperation({ summary: 'List all divisions' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllDivisions(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    return this.organizationService.findAllDivisions(req.user.tenantId, includeInactive === 'true');
  }

  @Get('divisions/:id')
  @Resource('divisions') @Action('read')
  @ApiOperation({ summary: 'Get a division with its delegations' })
  findOneDivision(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.findOneDivision(id, req.user.tenantId);
  }

  @Patch('divisions/:id')
  @Resource('divisions') @Action('update')
  @ApiOperation({ summary: 'Update a division' })
  updateDivision(@Param('id') id: string, @Body() dto: UpdateDivisionDto, @Request() req: AuthRequest) {
    return this.organizationService.updateDivision(id, req.user.tenantId, dto, req.user.userId);
  }

  @Delete('divisions/:id')
  @Resource('divisions') @Action('delete')
  @ApiOperation({ summary: 'Delete a division (must have no sites)' })
  removeDivision(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.organizationService.removeDivision(id, req.user.tenantId, req.user.userId);
  }

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
  @ApiOperation({ summary: 'List all delegations (filterable by divisionId)' })
  @ApiQuery({ name: 'divisionId', required: false })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  findAllDelegations(
    @Query('divisionId') divisionId: string,
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    return this.organizationService.findAllDelegations(req.user.tenantId, divisionId, includeInactive === 'true');
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
  @Resource('divisions') @Action('read')
  @ApiOperation({ summary: 'Get full organization tree: Divisions → Delegations → Sites' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  getTree(
    @Query('includeInactive') includeInactive: string,
    @Request() req: AuthRequest,
  ) {
    return this.organizationService.getTree(req.user.tenantId, includeInactive === 'true');
  }
}
