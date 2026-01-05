import {
  Controller,
  Get,
  Post,
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
import { CasbinGuard } from '../auth/guards/casbin.guard';
import { Resource } from '../../common/decorators/permissions.decorator';
import { Action } from '../../common/decorators/permissions.decorator';

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

  @Post('test/:provider')
  @Resource('integrations')
  @Action('read')
  @ApiOperation({ summary: 'Test connection to specific provider (netbox, uptime_kuma)' })
  testConnection(@Param('provider') provider: 'netbox' | 'uptime_kuma') {
    return this.integrationsService.testConnection(provider);
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
  syncNetBoxSites(@Request() req, @Body() syncDto: SyncNetBoxSitesDto) {
    return this.integrationsService.syncNetBoxSites(req.user.tenantId, syncDto);
  }

  @Post('netbox/sync/devices')
  @Resource('integrations')
  @Action('create')
  @ApiOperation({ summary: 'Sync devices from NetBox for a specific site (READ-ONLY)' })
  syncNetBoxDevices(@Request() req, @Body() syncDto: SyncNetBoxDevicesDto) {
    return this.integrationsService.syncNetBoxDevices(req.user.tenantId, syncDto);
  }

  @Post('netbox/map-asset')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Manually map XCH asset to NetBox device' })
  mapAssetToNetBox(@Request() req, @Body() mapDto: MapAssetToNetBoxDto) {
    return this.integrationsService.mapAssetToNetBox(req.user.tenantId, mapDto);
  }

  // ==================== UPTIME KUMA ====================

  @Post('uptime-kuma/sync/health/:siteId')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Update site health status from Uptime Kuma monitor' })
  updateSiteHealth(
    @Param('siteId') siteId: string,
    @Request() req,
    @Query('monitor') monitorIdentifier: string,
  ) {
    return this.integrationsService.updateSiteHealthFromMonitor(
      siteId,
      req.user.tenantId,
      monitorIdentifier,
    );
  }

  @Post('uptime-kuma/sync/health-all')
  @Resource('integrations')
  @Action('update')
  @ApiOperation({ summary: 'Sync all sites health from Uptime Kuma' })
  syncAllSitesHealth(@Request() req) {
    return this.integrationsService.syncAllSitesHealth(req.user.tenantId);
  }
}
