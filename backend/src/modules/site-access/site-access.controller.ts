import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SiteAccessService } from './site-access.service';
import { GrantSiteAccessDto, BulkGrantSiteAccessDto, UpdateSiteAccessDto } from './dto/grant-site-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('site-access')
@Controller('site-access')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class SiteAccessController {
  constructor(private readonly siteAccessService: SiteAccessService) {}

  @Post()
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Grant site access to a user' })
  grantAccess(@Body() dto: GrantSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.grantAccess(req.user.tenantId, dto, req.user.userId);
  }

  @Post('bulk')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Bulk grant site access to multiple users' })
  bulkGrantAccess(@Body() dto: BulkGrantSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.bulkGrantAccess(req.user.tenantId, dto, req.user.userId);
  }

  @Patch(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Update site access level' })
  updateAccess(@Param('id') id: string, @Body() dto: UpdateSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.updateAccess(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Revoke site access' })
  revokeAccess(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.siteAccessService.revokeAccess(req.user.tenantId, id);
  }

  @Get('site/:siteId')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'List all users with access to a site' })
  listBySite(@Param('siteId') siteId: string, @Request() req: AuthRequest) {
    return this.siteAccessService.listBySite(req.user.tenantId, siteId);
  }

  @Get('user/:userId')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'List all sites a user has access to' })
  listByUser(@Param('userId') userId: string, @Request() req: AuthRequest) {
    return this.siteAccessService.listByUser(req.user.tenantId, userId);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if current user has access to a site' })
  async checkAccess(
    @Query('siteId') siteId: string,
    @Request() req: AuthRequest,
  ) {
    const hasAccess = await this.siteAccessService.checkAccess(
      req.user.tenantId,
      req.user.userId,
      siteId,
    );
    return { hasAccess };
  }

  @Get('my-sites')
  @ApiOperation({ summary: 'Get all sites the current user has access to' })
  myAccessibleSites(@Request() req: AuthRequest) {
    return this.siteAccessService.listByUser(req.user.tenantId, req.user.userId);
  }

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get current user permissions (role + site access)' })
  async myPermissions(@Request() req: AuthRequest) {
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const siteAccess = await this.siteAccessService.listByUser(
      req.user.tenantId,
      req.user.userId,
    );
    return {
      role: req.user.role,
      allSitesAccess: accessibleSiteIds === null, // true for ADMIN/MANAGER
      accessibleSiteIds,
      siteAccess, // detailed access per site with resourcePermissions
    };
  }
}
