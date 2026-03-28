import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { SyncNetBoxSitesDto, SyncNetBoxDevicesDto, MapAssetToNetBoxDto } from './dto/sync-netbox.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource } from '../../common/decorators/permissions.decorator';
import { Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';
import { SiteAccessService } from '../site-access/site-access.service';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly siteAccessService: SiteAccessService,
  ) {}

  @Get('status')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Get all integrations status' })
  getStatus() {
    return this.integrationsService.getStatus();
  }

  @Get('config')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Get integration configuration (tokens masked)' })
  getConfig(@Request() req: AuthRequest) {
    return this.integrationsService.getIntegrationConfig(req.user.tenantId);
  }

  @Patch('config')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Update integration configuration' })
  updateConfig(@Body() body: Record<string, any>, @Request() req: AuthRequest) {
    return this.integrationsService.updateIntegrationConfig(req.user.tenantId, body);
  }

  @Post('test/:provider')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Test connection to specific provider (netbox, uptime_kuma)' })
  testConnection(@Param('provider') provider: 'netbox' | 'uptime_kuma', @Request() req: AuthRequest) {
    return this.integrationsService.testConnection(provider, req.user.tenantId);
  }

  @Post('test-all')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Test all integrations connections' })
  testAllConnections() {
    return this.integrationsService.testAllConnections();
  }

  // ==================== NETBOX ====================

  @Post('netbox/sync/sites')
  @Resource('netbox')
  @Action('manage')
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH (READ-ONLY)' })
  syncNetBoxSites(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxSitesDto) {
    return this.integrationsService.syncNetBoxSites(req.user.tenantId, syncDto);
  }

  @Post('netbox/sync/devices')
  @Resource('netbox')
  @Action('manage')
  @ApiOperation({ summary: 'Sync devices from NetBox for a specific site (READ-ONLY)' })
  syncNetBoxDevices(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxDevicesDto) {
    return this.integrationsService.syncNetBoxDevices(req.user.tenantId, syncDto);
  }

  @Post('netbox/map-asset')
  @Resource('netbox')
  @Action('manage')
  @ApiOperation({ summary: 'Manually map XCH asset to NetBox device' })
  mapAssetToNetBox(@Request() req: AuthRequest, @Body() mapDto: MapAssetToNetBoxDto) {
    return this.integrationsService.mapAssetToNetBox(req.user.tenantId, mapDto);
  }

  // ==================== NETBOX CONTACTS ====================

  @Get('netbox/contacts')
  @Resource('netbox')
  @Action('read')
  @ApiOperation({ summary: 'List contacts from NetBox' })
  getNetBoxContacts(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
    @Query('group_id') groupId?: number,
  ) {
    return this.integrationsService.getNetBoxContacts({
      limit,
      offset,
      name,
      group_id: groupId,
    });
  }

  @Get('netbox/contact-groups')
  @Resource('netbox')
  @Action('read')
  @ApiOperation({ summary: 'List contact groups from NetBox' })
  getNetBoxContactGroups(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.integrationsService.getNetBoxContactGroups({ limit, offset });
  }

  @Post('netbox/sync/contacts')
  @Resource('netbox')
  @Action('manage')
  @ApiOperation({ summary: 'Sync contacts from NetBox to XCH (READ-ONLY)' })
  syncNetBoxContacts(@Request() req: AuthRequest) {
    return this.integrationsService.syncNetBoxContacts(req.user.tenantId);
  }

  // ==================== MONITORING (generic) ====================

  @Get('monitoring/monitors')
  @Resource('monitoring')
  @Action('read')
  @ApiOperation({ summary: 'List monitors from the active monitoring provider (filtered by site access)' })
  async getMonitors(@Request() req: AuthRequest) {
    const result = await this.integrationsService.getMonitors(req.user.tenantId);

    // Site-based filtering for TECHNICIEN/VIEWER
    const accessibleSiteIds = await this.siteAccessService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );

    // null = all sites (ADMIN/MANAGER) → no filtering needed
    if (accessibleSiteIds === null) {
      return result;
    }

    // No accessible sites → return empty
    if (accessibleSiteIds.length === 0) {
      if (Array.isArray(result)) {
        return [];
      }
      return { ...result, monitors: [] };
    }

    // Filter monitors: get assets and sites to match monitor names
    // We need to know which monitors belong to which sites
    // The frontend does enrichment, but we also need to filter server-side
    // Get all assets for accessible sites to match monitor names
    const prisma = this.siteAccessService['prisma'];
    const accessibleAssets = await prisma.asset.findMany({
      where: {
        tenantId: req.user.tenantId,
        siteId: { in: accessibleSiteIds },
      },
      select: { id: true, networkInfo: true },
    });

    // Get accessible sites with connectivity info for link/sdwan monitors
    const accessibleSites = await prisma.site.findMany({
      where: {
        id: { in: accessibleSiteIds },
        tenantId: req.user.tenantId,
      },
      select: { id: true, connectivity: true },
    });

    // Build set of allowed monitor names
    const allowedMonitorNames = new Set<string>();

    // From assets
    for (const asset of accessibleAssets) {
      const networkInfo = asset.networkInfo as any;
      if (networkInfo?.monitorName) {
        allowedMonitorNames.add(networkInfo.monitorName);
      }
    }

    // From site connectivity (links + sdwan)
    for (const site of accessibleSites) {
      const connectivity = site.connectivity as any;
      const links = connectivity?.links || connectivity?.v2?.links || [];
      for (const link of links) {
        if (link.monitorName) allowedMonitorNames.add(link.monitorName);
      }
      const sdwan = connectivity?.sdwan || connectivity?.v2?.sdwan;
      if (sdwan?.monitorName) allowedMonitorNames.add(sdwan.monitorName);
    }

    // Filter monitors
    const monitors = Array.isArray(result) ? result : (result.monitors || []);
    const filteredMonitors = monitors.filter((m: any) =>
      allowedMonitorNames.has(m.name),
    );

    if (Array.isArray(result)) {
      return filteredMonitors;
    }
    return { ...result, monitors: filteredMonitors };
  }

  @Patch('monitoring/map-monitor')
  @Resource('monitoring')
  @Action('manage')
  @ApiOperation({ summary: 'Map a monitor to a site' })
  mapMonitorToSite(
    @Request() req: AuthRequest,
    @Body() body: { siteId: string; monitorName: string | null },
  ) {
    return this.integrationsService.mapMonitorToSite(
      body.siteId,
      req.user.tenantId,
      body.monitorName,
    );
  }

  @Get('monitoring/monitor-mappings')
  @Resource('monitoring')
  @Action('read')
  @ApiOperation({ summary: 'Get all monitor-to-site mappings' })
  getMonitorMappings(@Request() req: AuthRequest) {
    return this.integrationsService.getMonitorMappings(req.user.tenantId);
  }

  @Post('monitoring/sync/health/:siteId')
  @Resource('monitoring')
  @Action('manage')
  @ApiOperation({ summary: 'Update site health status from monitoring provider' })
  updateSiteHealth(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @Query('monitor') monitorIdentifier: string,
  ) {
    return this.integrationsService.updateSiteHealthFromMonitor(
      siteId,
      req.user.tenantId,
      monitorIdentifier,
    );
  }

  @Post('monitoring/sync/health-all')
  @Resource('monitoring')
  @Action('manage')
  @ApiOperation({ summary: 'Sync all sites health from monitoring provider (intelligent aggregation)' })
  syncAllSitesHealth(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Patch('monitoring/map-monitor-to-asset')
  @Resource('monitoring')
  @Action('manage')
  @ApiOperation({ summary: 'Map a monitor to an asset' })
  mapMonitorToAsset(
    @Request() req: AuthRequest,
    @Body() body: { assetId: string; monitorName: string | null },
  ) {
    return this.integrationsService.mapMonitorToAsset(
      body.assetId,
      req.user.tenantId,
      body.monitorName,
    );
  }

  // ==================== LEGACY ALIASES (backward compat) ====================

  @Get('uptime-kuma/monitors')
  @Resource('monitoring')
  @Action('read')
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/monitors instead' })
  getUptimeKumaMonitors(@Request() req: AuthRequest) {
    return this.getMonitors(req);
  }

  @Post('uptime-kuma/sync/health-all')
  @Resource('monitoring')
  @Action('manage')
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/sync/health-all instead' })
  syncAllSitesHealthLegacy(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Get('sites/:siteId/health-breakdown')
  @Resource('monitoring')
  @Action('read')
  @ApiOperation({ summary: 'Get health breakdown details for a site' })
  getSiteHealthBreakdown(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
  ) {
    return this.integrationsService.getSiteHealthBreakdown(siteId, req.user.tenantId);
  }
}
