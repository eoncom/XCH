import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SiteAccessService } from './site-access.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
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

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get current user permissions (delegations + grants)' })
  async myPermissions(@Request() req: AuthRequest) {
    const { tenantId, userId } = req.user;

    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(tenantId, userId);

    // Load user delegations with delegation info
    const userDelegations = await this.prisma.userDelegation.findMany({
      where: { tenantId, userId },
      include: {
        delegation: {
          select: { id: true, name: true, code: true, groupLabel: true, groupColor: true },
        },
      },
      orderBy: { grantedAt: 'desc' },
    });

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

    const hasDelegation = userDelegations.length > 0 || accessGrants.length > 0 || req.user.isSuperAdmin;

    return {
      isSuperAdmin: req.user.isSuperAdmin,
      hasDelegation,
      allSitesAccess: hasDelegation ? accessibleSiteIds === null : false,
      accessibleSiteIds: hasDelegation ? accessibleSiteIds : [],
      delegations: userDelegations,
      accessGrants,
    };
  }
}
