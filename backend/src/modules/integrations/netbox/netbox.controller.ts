import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../../../common/guards/module.guard';
import { CasbinGuard } from '../../../common/guards/casbin.guard';
import { RequireModule } from '../../../common/decorators/require-module.decorator';
import { Resource } from '../../../common/decorators/permissions.decorator';
import { Action } from '../../../common/decorators/permissions.decorator';
import { NetboxService } from './netbox.service';
import { NetboxSyncService } from './netbox-sync.service';

@RequireModule('integrations_netbox')
@ApiTags('Integrations - NetBox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ModuleGuard, CasbinGuard)
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
  @Resource('netbox')
  @Action('read')
  @ApiOperation({ summary: 'Check NetBox integration health' })
  @ApiResponse({ status: 200, description: 'Health check result' })
  async healthCheck() {
    return this.netboxService.healthCheck();
  }

  @Get('status')
  @Resource('netbox')
  @Action('read')
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
  @Resource('netbox')
  @Action('read')
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
  @Resource('netbox')
  @Action('read')
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
  @Resource('netbox')
  @Action('read')
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
  @Resource('netbox')
  @Action('manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncSites(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncSitesFromNetbox(tenantId);
  }

  @Post('sync/devices')
  @Resource('netbox')
  @Action('manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync devices from NetBox to XCH assets' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncDevices(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncDevicesFromNetbox(tenantId);
  }

  @Post('sync/racks')
  @Resource('netbox')
  @Action('manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync racks from NetBox to XCH' })
  @ApiResponse({ status: 200, description: 'Sync result' })
  async syncRacks(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncRacksFromNetbox(tenantId);
  }

  @Post('sync/full')
  @Resource('netbox')
  @Action('manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full sync from NetBox (sites, devices, racks)' })
  @ApiResponse({ status: 200, description: 'Full sync report' })
  async fullSync(@Req() req: any) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.fullSync(tenantId);
  }
}
