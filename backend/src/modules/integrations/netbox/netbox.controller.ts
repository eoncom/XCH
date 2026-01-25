import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RbacGuard, RbacAction } from '../../auth/guards/rbac.guard';
import { CurrentUser, CurrentTenant } from '../../auth/decorators';
import { NetboxService } from './netbox.service';
import { NetboxSyncService } from './netbox-sync.service';

@ApiTags('Integrations - NetBox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('integrations/netbox')
export class NetboxController {
  constructor(
    private readonly netboxService: NetboxService,
    private readonly netboxSyncService: NetboxSyncService,
  ) {}

  // ============================================================
  // HEALTH & STATUS
  // ============================================================

  @Get('health')
  @RbacAction('read', 'integrations')
  @ApiOperation({ summary: 'Check NetBox integration health' })
  @ApiResponse({ status: 200, description: 'Health check result' })
  async healthCheck() {
    return this.netboxService.healthCheck();
  }

  @Get('status')
  @RbacAction('read', 'integrations')
  @ApiOperation({ summary: 'Get NetBox integration status' })
  @ApiResponse({ status: 200, description: 'Integration status' })
  async getStatus() {
    return {
      enabled: this.netboxService.isEnabled(),
      health: await this.netboxService.healthCheck(),
    };
  }

  // ============================================================
  // NETBOX DATA (READ-ONLY)
  // ============================================================

  @Get('sites')
  @RbacAction('read', 'integrations')
  @ApiOperation({ summary: 'List NetBox sites' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of NetBox sites' })
  async getSites(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
  ) {
    return this.netboxService.getSites({ limit, offset, name });
  }

  @Get('devices')
  @RbacAction('read', 'integrations')
  @ApiOperation({ summary: 'List NetBox devices' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'site_id', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of NetBox devices' })
  async getDevices(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
    @Query('site_id') site_id?: number,
  ) {
    return this.netboxService.getDevices({ limit, offset, name, site_id });
  }

  @Get('racks')
  @RbacAction('read', 'integrations')
  @ApiOperation({ summary: 'List NetBox racks' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'site_id', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of NetBox racks' })
  async getRacks(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
    @Query('site_id') site_id?: number,
  ) {
    return this.netboxService.getRacks({ limit, offset, name, site_id });
  }

  // ============================================================
  // SYNC OPERATIONS
  // ============================================================

  @Post('sync/sites')
  @RbacAction('manage', 'integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncSites(@CurrentTenant() tenantId: string) {
    return this.netboxSyncService.syncSitesFromNetbox(tenantId);
  }

  @Post('sync/devices')
  @RbacAction('manage', 'integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync devices from NetBox to XCH assets' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncDevices(@CurrentTenant() tenantId: string) {
    return this.netboxSyncService.syncDevicesFromNetbox(tenantId);
  }

  @Post('sync/racks')
  @RbacAction('manage', 'integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync racks from NetBox to XCH' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncRacks(@CurrentTenant() tenantId: string) {
    return this.netboxSyncService.syncRacksFromNetbox(tenantId);
  }

  @Post('sync/full')
  @RbacAction('manage', 'integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full sync from NetBox (sites, devices, racks)' })
  @ApiResponse({ status: 200, description: 'Full sync report' })
  async fullSync(@CurrentTenant() tenantId: string) {
    return this.netboxSyncService.fullSync(tenantId);
  }
}
