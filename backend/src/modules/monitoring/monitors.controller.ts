import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWrite, RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { PermissionService } from '../../common/services/permission.service';
import { MonitorsService } from './monitors.service';
import { MonitorReactionsService } from './monitor-reactions.service';
import {
  CreateMonitorCheckDto,
  UpdateMonitorCheckDto,
  FilterMonitorCheckDto,
  HistoryQueryDto,
} from './dto/create-monitor-check.dto';

@ApiTags('monitors')
@Controller('monitors')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MonitorsController {
  constructor(
    private readonly service: MonitorsService,
    private readonly permissionService: PermissionService,
    private readonly reactions: MonitorReactionsService,
  ) {}

  @Post()
  @RequireWrite()
  @ApiOperation({ summary: 'Create a monitor check (ICMP / HTTP / TCP)' })
  create(@Body() dto: CreateMonitorCheckDto, @Request() req: AuthRequest) {
    return this.service.create(req.user.tenantId, req.user.userId, dto);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List monitor checks (filter by siteId/assetId/linkId/kind/enabled)' })
  async findAll(@Query() filters: FilterMonitorCheckDto, @Request() req: AuthRequest) {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    return this.service.findAll(req.user.tenantId, filters, accessibleSiteIds);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a monitor check' })
  findOne(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    return this.service.findOne(req.user.tenantId, id, ctx);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a monitor check (cannot re-target — delete + recreate)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMonitorCheckDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.update(req.user.tenantId, id, dto, ctx);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a monitor check (cascades httpConfig + results)' })
  remove(@Param('id') id: string, @Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    return this.service.remove(req.user.tenantId, id, ctx);
  }

  @Get(':id/history')
  @RequireRead()
  @ApiOperation({ summary: 'List recent results for a monitor (paginated, desc by checkedAt)' })
  history(
    @Param('id') id: string,
    @Query() query: HistoryQueryDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.history(req.user.tenantId, id, query);
  }

  @Get(':id/summary')
  @RequireRead()
  @ApiOperation({ summary: 'Uptime % over 24h / 7d / 30d for a monitor' })
  summary(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.summary(req.user.tenantId, id);
  }

  @Post(':id/run-now')
  @RequireWrite()
  @ApiOperation({ summary: 'Enqueue an immediate probe (no retry, raw result)' })
  runNow(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.service.runNow(req.user.tenantId, id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Auto-disable banner endpoints (ADR-016 §E)
  // ─────────────────────────────────────────────────────────────────────

  @Get('auto-disabled/status')
  @RequireRead()
  @ApiOperation({ summary: 'Banner state for an asset/site (count of auto-disabled monitors + ack flag)' })
  getAutoDisabledStatus(
    @Query('entityType') entityType: 'asset' | 'site',
    @Query('entityId') entityId: string,
    @Request() req: AuthRequest,
  ) {
    return this.reactions.getAutoDisabledStatus(req.user.tenantId, entityType, entityId);
  }

  @Post('auto-disabled/bulk-enable')
  @RequireWrite()
  @ApiOperation({ summary: 'Re-enable all auto-disabled monitors of an entity (asset|site)' })
  bulkEnable(
    @Body() body: { entityType: 'asset' | 'site'; entityId: string },
    @Request() req: AuthRequest,
  ) {
    return this.reactions.bulkEnable(req.user.tenantId, body.entityType, body.entityId, req.user.userId);
  }

  @Post('auto-disabled/ack')
  @RequireWrite()
  @ApiOperation({ summary: 'Dismiss the auto-disable banner without re-enabling' })
  ackBanner(
    @Body() body: { entityType: 'asset' | 'site'; entityId: string },
    @Request() req: AuthRequest,
  ) {
    return this.reactions
      .ackBanner(req.user.tenantId, body.entityType, body.entityId, req.user.userId)
      .then(() => ({ acknowledged: true }));
  }
}
