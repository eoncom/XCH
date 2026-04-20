import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { SyncNetBoxSitesDto, SyncNetBoxDevicesDto, MapAssetToNetBoxDto } from './dto/sync-netbox.dto';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';
import { PrismaClient } from '@prisma/client';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaClient,
  ) {}

  @Get('status')
  @RequireRead()
  @ApiOperation({ summary: 'Get all integrations status' })
  getStatus() {
    return this.integrationsService.getStatus();
  }

  @Get('config')
  @RequireRead()
  @ApiOperation({ summary: 'Get integration configuration (tokens masked)' })
  getConfig(@Request() req: AuthRequest) {
    return this.integrationsService.getIntegrationConfig(req.user.tenantId);
  }

  @Patch('config')
  @RequireWrite()
  @ApiOperation({ summary: 'Update integration configuration' })
  updateConfig(@Body() body: Record<string, any>, @Request() req: AuthRequest) {
    return this.integrationsService.updateIntegrationConfig(req.user.tenantId, body);
  }

  @Post('test/:provider')
  @RequireRead()
  @ApiOperation({ summary: 'Test connection to specific provider (netbox, uptime_kuma)' })
  testConnection(@Param('provider') provider: 'netbox' | 'uptime_kuma', @Request() req: AuthRequest) {
    return this.integrationsService.testConnection(provider, req.user.tenantId);
  }

  @Post('test-all')
  @RequireRead()
  @ApiOperation({ summary: 'Test all integrations connections' })
  testAllConnections() {
    return this.integrationsService.testAllConnections();
  }

  // ==================== NETBOX ====================

  @Post('netbox/sync/sites')
  @RequireManage()
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH (READ-ONLY)' })
  syncNetBoxSites(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxSitesDto) {
    return this.integrationsService.syncNetBoxSites(req.user.tenantId, syncDto);
  }

  @Post('netbox/sync/devices')
  @RequireManage()
  @ApiOperation({ summary: 'Sync devices from NetBox for a specific site (READ-ONLY)' })
  syncNetBoxDevices(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxDevicesDto) {
    return this.integrationsService.syncNetBoxDevices(req.user.tenantId, syncDto);
  }

  @Post('netbox/map-asset')
  @RequireManage()
  @ApiOperation({ summary: 'Manually map XCH asset to NetBox device' })
  mapAssetToNetBox(@Request() req: AuthRequest, @Body() mapDto: MapAssetToNetBoxDto) {
    return this.integrationsService.mapAssetToNetBox(req.user.tenantId, mapDto);
  }

  // ==================== NETBOX CONTACTS ====================

  @Get('netbox/contacts')
  @RequireRead()
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
  @RequireRead()
  @ApiOperation({ summary: 'List contact groups from NetBox' })
  getNetBoxContactGroups(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.integrationsService.getNetBoxContactGroups({ limit, offset });
  }

  @Post('netbox/sync/contacts')
  @RequireManage()
  @ApiOperation({ summary: 'Sync contacts from NetBox to XCH (READ-ONLY)' })
  syncNetBoxContacts(@Request() req: AuthRequest) {
    return this.integrationsService.syncNetBoxContacts(req.user.tenantId);
  }

  // ==================== MONITORING (generic) ====================

  @Get('monitoring/monitors')
  @RequireRead()
  @ApiOperation({ summary: 'List monitors from the active monitoring provider (filtered by site access)' })
  async getMonitors(@Request() req: AuthRequest) {
    const result = await this.integrationsService.getMonitors(req.user.tenantId);

    // Site-based filtering for TECHNICIEN/VIEWER
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
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
    const accessibleAssets = await this.prisma.asset.findMany({
      where: {
        tenantId: req.user.tenantId,
        siteId: { in: accessibleSiteIds },
      },
      select: { id: true, networkInfo: true },
    });

    // Get accessible connectivity link rows for link monitors
    // (phase 6.5: links live in ConnectivityLink table since v1.3, JSON dropped)
    const accessibleLinks = await this.prisma.connectivityLink.findMany({
      where: {
        siteId: { in: accessibleSiteIds },
        tenantId: req.user.tenantId,
      },
      select: { id: true, monitorName: true },
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

    // From connectivity link rows
    for (const link of accessibleLinks) {
      if (link.monitorName) allowedMonitorNames.add(link.monitorName);
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
  @RequireManage()
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
  @RequireRead()
  @ApiOperation({ summary: 'Get all monitor-to-site mappings' })
  getMonitorMappings(@Request() req: AuthRequest) {
    return this.integrationsService.getMonitorMappings(req.user.tenantId);
  }

  @Post('monitoring/sync/health/:siteId')
  @RequireManage()
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
  @RequireManage()
  @ApiOperation({ summary: 'Sync all sites health from monitoring provider (intelligent aggregation)' })
  syncAllSitesHealth(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Patch('monitoring/map-monitor-to-asset')
  @RequireManage()
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
  @RequireRead()
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/monitors instead' })
  getUptimeKumaMonitors(@Request() req: AuthRequest) {
    return this.getMonitors(req);
  }

  @Post('uptime-kuma/sync/health-all')
  @RequireManage()
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/sync/health-all instead' })
  syncAllSitesHealthLegacy(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Get('sites/:siteId/health-breakdown')
  @RequireRead()
  @ApiOperation({ summary: 'Get health breakdown details for a site' })
  getSiteHealthBreakdown(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
  ) {
    return this.integrationsService.getSiteHealthBreakdown(siteId, req.user.tenantId);
  }
}
