import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationConfigService } from './notification-config.service';
import { NotificationService } from './notification.service';
import { SaveNotificationConfigDto, TestChannelDto, NotificationLogQueryDto } from './dto/notification-config.dto';
import { NOTIFICATION_EVENTS } from './notification-events';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';

/**
 * Notification config controller.
 *
 * Authorization (AUTH_MODEL v2) :
 * - /meta is a static catalog of events/channels → any authenticated user.
 * - /config, /config/resolved, PUT /config, DELETE /config/:delegationId,
 *   POST /test, GET /logs : require MANAGE on the active delegation
 *   (resolved by DelegationGuard via X-Delegation-Id). A `delegationId=null`
 *   query (global/tenant-wide config) is super-admin only and enforced inside
 *   the handler.
 * - GET /configs (tenant-wide overview) is super-admin only.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private configService: NotificationConfigService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Get available event types and channels (for UI rendering).
   */
  @Get('meta')
  @SkipDelegation()
  @RequireRead()
  @ApiOperation({ summary: 'Get notification event types and channels metadata' })
  getMeta() {
    return {
      events: NOTIFICATION_EVENTS,
      channels: this.notificationService.getAvailableChannels(),
    };
  }

  /**
   * Get the resolved (effective) config for a delegation, with inheritance applied.
   * Declared BEFORE `config/:delegationId` so the literal `resolved` segment wins.
   */
  @Get('config/resolved')
  @RequireManage()
  @ApiOperation({ summary: 'Get resolved config with inheritance for a delegation' })
  async getResolvedConfig(
    @Query('delegationId') delegationId: string | undefined,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.configService.resolveConfig(tenantId, delegationId);
  }

  /**
   * Get notification config for a delegation (path-based). The `global` sentinel
   * in the path maps to a tenant-wide config (super-admin only); any other value
   * is treated as a delegation id and requires MANAGE on that delegation.
   */
  @Get('config/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: 'Get notification config for a delegation (use "global" for tenant-wide)' })
  async getConfigByParam(
    @Param('delegationId') delegationIdParam: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const delId = delegationIdParam === 'global' ? null : delegationIdParam;
    this.requireSuperAdminForGlobal(req.user, delId);
    return this.configService.getConfig(tenantId, delId);
  }

  /**
   * Query-based variant kept for backward compat (external API clients).
   */
  @Get('config')
  @RequireManage()
  @ApiOperation({ summary: 'Get notification config via ?delegationId=… (backward compat)' })
  async getConfig(
    @Query('delegationId') delegationId: string | undefined,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const delId = delegationId || null;
    this.requireSuperAdminForGlobal(req.user, delId);
    return this.configService.getConfig(tenantId, delId);
  }

  /**
   * Save notification config for a delegation (or global).
   * Global config is super-admin only.
   */
  @Put('config')
  @RequireManage()
  @ApiOperation({ summary: 'Save notification config' })
  async saveConfig(@Body() dto: SaveNotificationConfigDto, @Request() req: any) {
    const tenantId = req.user.tenantId;
    const delegationId = dto.delegationId ?? null;
    this.requireSuperAdminForGlobal(req.user, delegationId);
    return this.configService.saveConfig(tenantId, delegationId, {
      channels: dto.channels,
      events: dto.events,
    });
  }

  /**
   * Delete notification config for a delegation (revert to inheritance).
   * `global` sentinel deletes the tenant-wide config (super-admin only).
   */
  @Delete('config/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: 'Delete config for a delegation — or the tenant-wide config with "global"' })
  async deleteConfig(
    @Param('delegationId') delegationIdParam: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const delId = delegationIdParam === 'global' ? null : delegationIdParam;
    this.requireSuperAdminForGlobal(req.user, delId);
    return this.configService.deleteConfig(tenantId, delId);
  }

  /**
   * Get all notification configs for the tenant (admin overview).
   * Super-admin only: SkipDelegation + RequireManage resolves to isSuperAdmin in PermissionGuard.
   */
  @Get('configs')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'List all notification configs for the tenant (super admin only)' })
  async getAllConfigs(@Request() req: any) {
    return this.configService.getAllConfigs(req.user.tenantId);
  }

  /**
   * Test a notification channel.
   */
  @Post('test')
  @RequireManage()
  @ApiOperation({ summary: 'Test a notification channel' })
  async testChannel(@Body() dto: TestChannelDto) {
    return this.notificationService.testChannel(dto.channel, dto.config as any);
  }

  /**
   * Get notification logs.
   */
  @Get('logs')
  @RequireManage()
  @ApiOperation({ summary: 'Get notification logs' })
  async getLogs(@Query() query: NotificationLogQueryDto, @Request() req: any) {
    return this.configService.getLogs(req.user.tenantId, query);
  }

  /**
   * Global (tenant-wide) notification config is super-admin only.
   * Delegation-scoped access is already validated by DelegationGuard + PermissionGuard.
   */
  private requireSuperAdminForGlobal(user: any, delegationId: string | null) {
    if (delegationId === null && !user.isSuperAdmin) {
      throw new ForbiddenException('Only super admins can manage global notification config');
    }
  }
}
