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

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

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
  @Resource('integrations')
  @Action('create')
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH (READ-ONLY)' })
  syncNetBoxSites(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxSitesDto) {
    return this.integrationsService.syncNetBoxSites(req.user.tenantId, syncDto);
  }

  @Post('netbox/sync/devices')
  @Resource('integrations')
  @Action('create')
  @ApiOperation({ summary: 'Sync devices from NetBox for a specific site (READ-ONLY)' })
  syncNetBoxDevices(@Request() req: AuthRequest, @Body() syncDto: SyncNetBoxDevicesDto) {
    return this.integrationsService.syncNetBoxDevices(req.user.tenantId, syncDto);
  }

  @Post('netbox/map-asset')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Manually map XCH asset to NetBox device' })
  mapAssetToNetBox(@Request() req: AuthRequest, @Body() mapDto: MapAssetToNetBoxDto) {
    return this.integrationsService.mapAssetToNetBox(req.user.tenantId, mapDto);
  }

  // ==================== NETBOX CONTACTS ====================

  @Get('netbox/contacts')
  @Resource('integrations')
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
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'List contact groups from NetBox' })
  getNetBoxContactGroups(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.integrationsService.getNetBoxContactGroups({ limit, offset });
  }

  @Post('netbox/sync/contacts')
  @Resource('integrations')
  @Action('create')
  @ApiOperation({ summary: 'Sync contacts from NetBox to XCH (READ-ONLY)' })
  syncNetBoxContacts(@Request() req: AuthRequest) {
    return this.integrationsService.syncNetBoxContacts(req.user.tenantId);
  }

  // ==================== MONITORING (generic) ====================

  @Get('monitoring/monitors')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'List all monitors from the active monitoring provider' })
  getMonitors(@Request() req: AuthRequest) {
    return this.integrationsService.getMonitors(req.user.tenantId);
  }

  @Patch('monitoring/map-monitor')
  @Resource('integrations')
  @Action('update')
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
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Get all monitor-to-site mappings' })
  getMonitorMappings(@Request() req: AuthRequest) {
    return this.integrationsService.getMonitorMappings(req.user.tenantId);
  }

  @Post('monitoring/sync/health/:siteId')
  @Resource('integrations')
  @Action('update')
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
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Sync all sites health from monitoring provider (intelligent aggregation)' })
  syncAllSitesHealth(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Patch('monitoring/map-monitor-to-asset')
  @Resource('integrations')
  @Action('update')
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
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/monitors instead' })
  getUptimeKumaMonitors(@Request() req: AuthRequest) {
    return this.integrationsService.getMonitors(req.user.tenantId);
  }

  @Post('uptime-kuma/sync/health-all')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: '[Deprecated] Use /monitoring/sync/health-all instead' })
  syncAllSitesHealthLegacy(@Request() req: AuthRequest) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }

  @Get('sites/:siteId/health-breakdown')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Get health breakdown details for a site' })
  getSiteHealthBreakdown(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
  ) {
    return this.integrationsService.getSiteHealthBreakdown(siteId, req.user.tenantId);
  }
}
