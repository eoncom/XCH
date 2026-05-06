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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ModuleGuard } from '../../../common/guards/module.guard';
import { RequireModule } from '../../../common/decorators/require-module.decorator';
import { NetboxService } from './netbox.service';
import { NetboxSyncService } from './netbox-sync.service';
import { RequireRead, RequireManage } from '../../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../../types/request.interface';
import {
  IntegrationSyncReportResponseDto,
  NetboxHealthResponseDto,
  NetboxListResponseDto,
  NetboxStatusResponseDto,
} from '../dto/integration-passthrough.response.dto';

@RequireModule('integrations_netbox')
@ApiTags('Integrations - NetBox')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
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
  @RequireRead()
  @ApiOperation({ summary: 'Check NetBox integration health' })
  @ApiOkResponse({ type: NetboxHealthResponseDto })
  async healthCheck() {
    return this.netboxService.healthCheck();
  }

  @Get('status')
  @RequireRead()
  @ApiOperation({ summary: 'Get NetBox integration status' })
  @ApiOkResponse({ type: NetboxStatusResponseDto })
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
  @RequireRead()
  @ApiOperation({ summary: 'List NetBox sites' })
  @ApiOkResponse({ type: NetboxListResponseDto })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  async getSites(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
  ) {
    return this.netboxService.getSites({ limit, offset, name });
  }

  @Get('devices')
  @RequireRead()
  @ApiOperation({ summary: 'List NetBox devices' })
  @ApiOkResponse({ type: NetboxListResponseDto })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'site_id', required: false, type: Number })
  async getDevices(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('name') name?: string,
    @Query('site_id') site_id?: number,
  ) {
    return this.netboxService.getDevices({ limit, offset, name, site_id });
  }

  @Get('racks')
  @RequireRead()
  @ApiOperation({ summary: 'List NetBox racks' })
  @ApiOkResponse({ type: NetboxListResponseDto })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'site_id', required: false, type: Number })
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
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync sites from NetBox to XCH' })
  @ApiOkResponse({ type: IntegrationSyncReportResponseDto })
  async syncSites(@Req() req: AuthRequest) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncSitesFromNetbox(tenantId);
  }

  @Post('sync/devices')
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync devices from NetBox to XCH assets' })
  @ApiOkResponse({ type: IntegrationSyncReportResponseDto })
  async syncDevices(@Req() req: AuthRequest) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncDevicesFromNetbox(tenantId);
  }

  @Post('sync/racks')
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync racks from NetBox to XCH' })
  @ApiOkResponse({ type: IntegrationSyncReportResponseDto })
  async syncRacks(@Req() req: AuthRequest) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.syncRacksFromNetbox(tenantId);
  }

  @Post('sync/full')
  @RequireManage()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full sync from NetBox (sites, devices, racks)' })
  @ApiOkResponse({ type: IntegrationSyncReportResponseDto })
  async fullSync(@Req() req: AuthRequest) {
    const tenantId = req.user?.tenantId || 'default';
    return this.netboxSyncService.fullSync(tenantId);
  }
}
