import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SiteAccessService } from './site-access.service';
import { GrantSiteAccessDto, BulkGrantSiteAccessDto, UpdateSiteAccessDto } from './dto/grant-site-access.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { PrismaClient } from '@prisma/client';

@ApiTags('site-access')
@Controller('site-access')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class SiteAccessController {
  constructor(
    private readonly siteAccessService: SiteAccessService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post()
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Grant site access to a user (legacy)' })
  grantAccess(@Body() dto: GrantSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.grantAccess(req.user.tenantId, dto, req.user.userId);
  }

  @Post('bulk')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Bulk grant site access to multiple users (legacy)' })
  bulkGrantAccess(@Body() dto: BulkGrantSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.bulkGrantAccess(req.user.tenantId, dto, req.user.userId);
  }

  @Patch(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Update site access level (legacy)' })
  updateAccess(@Param('id') id: string, @Body() dto: UpdateSiteAccessDto, @Request() req: AuthRequest) {
    return this.siteAccessService.updateAccess(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Resource('sites') @Action('update')
  @ApiOperation({ summary: 'Revoke site access (legacy)' })
  revokeAccess(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.siteAccessService.revokeAccess(req.user.tenantId, id);
  }

  @Get('site/:siteId')
  @Resource('sites') @Action('read')
  @ApiOperation({ summary: 'List all users with access to a site (legacy)' })
  listBySite(@Param('siteId') siteId: string, @Request() req: AuthRequest) {
    return this.siteAccessService.listBySite(req.user.tenantId, siteId);
  }

  @Get('user/:userId')
  @Resource('users') @Action('read')
  @ApiOperation({ summary: 'List all sites a user has access to (legacy)' })
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
  @ApiOperation({ summary: 'Get current user permissions (role + scopes + grants)' })
  async myPermissions(@Request() req: AuthRequest) {
    const { tenantId, userId, role } = req.user;

    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(tenantId, userId);

    // Load user scopes with resolved labels
    const scopes = await this.prisma.userScope.findMany({
      where: { tenantId, userId },
      orderBy: { grantedAt: 'desc' },
    });

    // Enrich scopes with entity names
    const enrichedScopes = await Promise.all(
      scopes.map(async (scope) => {
        let scopeLabel = '';
        if (scope.scopeType === 'TENANT') {
          scopeLabel = 'Tout le tenant';
        } else if (scope.scopeType === 'DIVISION' && scope.scopeId) {
          const div = await this.prisma.division.findUnique({ where: { id: scope.scopeId }, select: { name: true } });
          scopeLabel = div?.name || scope.scopeId;
        } else if (scope.scopeType === 'DELEGATION' && scope.scopeId) {
          const del = await this.prisma.delegation.findUnique({ where: { id: scope.scopeId }, select: { name: true } });
          scopeLabel = del?.name || scope.scopeId;
        } else if (scope.scopeType === 'SITE' && scope.scopeId) {
          const site = await this.prisma.site.findUnique({ where: { id: scope.scopeId }, select: { name: true } });
          scopeLabel = site?.name || scope.scopeId;
        }
        return { ...scope, scopeLabel };
      }),
    );

    // Load non-expired access grants
    const accessGrants = await this.prisma.accessGrant.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { grantedAt: 'desc' },
    });

    return {
      role,
      allSitesAccess: accessibleSiteIds === null,
      accessibleSiteIds,
      scopes: enrichedScopes,
      accessGrants,
    };
  }
}
