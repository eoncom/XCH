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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
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
import { MonitorCheckResponseDto } from './dto/monitor-check.response.dto';
import { MonitorHistoryResponseDto } from './dto/monitor-history-item.response.dto';
import {
  MonitorSummaryResponseDto,
  toMonitorSummaryResponseDto,
} from './dto/monitor-summary.response.dto';
import { AutoDisabledStatusResponseDto } from './dto/auto-disabled-status.response.dto';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import {
  AcknowledgedResponseDto,
  CountResponseDto,
  DeletedResponseDto,
  EnqueuedResponseDto,
} from '../../common/dto/response';

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
  @ApiCreatedResponse({ type: MonitorCheckResponseDto })
  async create(
    @Body() dto: CreateMonitorCheckDto,
    @Request() req: AuthRequest,
  ): Promise<MonitorCheckResponseDto> {
    const check = await this.service.create(req.user.tenantId, req.user.userId, dto);
    return toResponse(MonitorCheckResponseDto, check);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'List monitor checks (filter by siteId/assetId/linkId/kind/enabled)' })
  @ApiOkResponse({ type: MonitorCheckResponseDto, isArray: true })
  async findAll(
    @Query() filters: FilterMonitorCheckDto,
    @Request() req: AuthRequest,
  ): Promise<MonitorCheckResponseDto[]> {
    const accessibleSiteIds = await this.permissionService.getAccessibleSiteIds(
      req.user.tenantId,
      req.user.userId,
    );
    const checks = await this.service.findAll(req.user.tenantId, filters, accessibleSiteIds);
    return toResponseArray(MonitorCheckResponseDto, checks);
  }

  @Get(':id')
  @RequireRead()
  @ApiOperation({ summary: 'Get a monitor check' })
  @ApiOkResponse({ type: MonitorCheckResponseDto })
  async findOne(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<MonitorCheckResponseDto> {
    const check = await this.service.findOne(req.user.tenantId, id, ctx);
    return toResponse(MonitorCheckResponseDto, check);
  }

  @Patch(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Update a monitor check (cannot re-target — delete + recreate)' })
  @ApiOkResponse({ type: MonitorCheckResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMonitorCheckDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<MonitorCheckResponseDto> {
    const check = await this.service.update(req.user.tenantId, id, dto, ctx);
    return toResponse(MonitorCheckResponseDto, check);
  }

  @Delete(':id')
  @RequireWrite()
  @ApiOperation({ summary: 'Delete a monitor check (cascades httpConfig + results)' })
  @ApiOkResponse({ type: DeletedResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<DeletedResponseDto> {
    return this.service.remove(req.user.tenantId, id, ctx);
  }

  @Get(':id/history')
  @RequireRead()
  @ApiOperation({ summary: 'List recent results for a monitor (paginated, desc by checkedAt)' })
  @ApiOkResponse({ type: MonitorHistoryResponseDto })
  async history(
    @Param('id') id: string,
    @Query() query: HistoryQueryDto,
    @Request() req: AuthRequest,
  ): Promise<MonitorHistoryResponseDto> {
    const page = await this.service.history(req.user.tenantId, id, query);
    return toResponse(MonitorHistoryResponseDto, page);
  }

  @Get(':id/summary')
  @RequireRead()
  @ApiOperation({ summary: 'Uptime % over 24h / 7d / 30d for a monitor' })
  @ApiOkResponse({ type: MonitorSummaryResponseDto })
  async summary(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<MonitorSummaryResponseDto> {
    const rows = await this.service.summary(req.user.tenantId, id);
    return toMonitorSummaryResponseDto(rows);
  }

  @Post(':id/run-now')
  @RequireWrite()
  @ApiOperation({ summary: 'Enqueue an immediate probe (no retry, raw result)' })
  @ApiOkResponse({ type: EnqueuedResponseDto })
  async runNow(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<EnqueuedResponseDto> {
    return this.service.runNow(req.user.tenantId, id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Auto-disable banner endpoints (ADR-016 §E)
  // ─────────────────────────────────────────────────────────────────────

  @Get('auto-disabled/status')
  @RequireRead()
  @ApiOperation({ summary: 'Banner state for an asset/site (count of auto-disabled monitors + ack flag)' })
  @ApiOkResponse({ type: AutoDisabledStatusResponseDto })
  async getAutoDisabledStatus(
    @Query('entityType') entityType: 'asset' | 'site',
    @Query('entityId') entityId: string,
    @Request() req: AuthRequest,
  ): Promise<AutoDisabledStatusResponseDto> {
    const status = await this.reactions.getAutoDisabledStatus(
      req.user.tenantId,
      entityType,
      entityId,
    );
    return toResponse(AutoDisabledStatusResponseDto, status);
  }

  @Post('auto-disabled/bulk-enable')
  @RequireWrite()
  @ApiOperation({ summary: 'Re-enable all auto-disabled monitors of an entity (asset|site)' })
  @ApiOkResponse({ type: CountResponseDto })
  async bulkEnable(
    @Body() body: { entityType: 'asset' | 'site'; entityId: string },
    @Request() req: AuthRequest,
  ): Promise<CountResponseDto> {
    return this.reactions.bulkEnable(req.user.tenantId, body.entityType, body.entityId, req.user.userId);
  }

  @Post('auto-disabled/ack')
  @RequireWrite()
  @ApiOperation({ summary: 'Dismiss the auto-disable banner without re-enabling' })
  @ApiOkResponse({ type: AcknowledgedResponseDto })
  async ackBanner(
    @Body() body: { entityType: 'asset' | 'site'; entityId: string },
    @Request() req: AuthRequest,
  ): Promise<AcknowledgedResponseDto> {
    await this.reactions.ackBanner(req.user.tenantId, body.entityType, body.entityId, req.user.userId);
    return { acknowledged: true };
  }
}
