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
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';

/**
 * Integrations controller — NetBox today.
 * All `monitoring/*` and `uptime-kuma/*` routes were removed in ADR-016.
 * Native monitoring lives under `/api/monitors` (MonitorsController).
 */
@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

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
  @ApiOperation({ summary: 'Test connection to a specific provider (netbox)' })
  testConnection(@Param('provider') provider: 'netbox', @Request() req: AuthRequest) {
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
}
