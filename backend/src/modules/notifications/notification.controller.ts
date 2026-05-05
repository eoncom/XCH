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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationService } from './notification.service';
import {
  SaveNotificationSettingsDto,
  TestChannelDto,
  NotificationLogQueryDto,
} from './dto/notification-config.dto';
import { NOTIFICATION_EVENTS_META } from './notification-events';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireRead, RequireManage } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';
import { toResponse } from '../../common/utils/to-response.util';
import { NotificationSettingsResponseDto, NotificationAllSettingsResponseDto } from './dto/notification-settings.response.dto';
import { NotificationResolvedSettingsResponseDto } from './dto/notification-resolved-settings.response.dto';
import {
  NotificationMetaResponseDto,
  toNotificationMetaResponseDto,
} from './dto/notification-meta.response.dto';
import { NotificationLogPageResponseDto } from './dto/notification-log.response.dto';
import {
  NotificationDeleteSettingsResponseDto,
  NotificationTestResultResponseDto,
} from './dto/notification-action.response.dto';

interface AuthUserLike {
  tenantId: string;
  isSuperAdmin?: boolean;
}

/**
 * Notification settings controller (ADR-020).
 *
 * Authorization (AUTH_MODEL v2) :
 * - /meta is a static catalog of events/channels → any authenticated user.
 * - /config(.../resolved/.../configs) routes : MANAGE on the active
 *   delegation (DelegationGuard via X-Delegation-Id).
 * - delegationId=null (tenant-global) → super-admin only, enforced inline.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private settingsService: NotificationSettingsService,
    private notificationService: NotificationService,
  ) {}

  /** Static event/channel metadata for UI rendering. */
  @Get('meta')
  @SkipDelegation()
  @RequireRead()
  @ApiOperation({ summary: 'Get notification event types and channels metadata' })
  @ApiOkResponse({ type: NotificationMetaResponseDto })
  getMeta(): NotificationMetaResponseDto {
    return toNotificationMetaResponseDto({
      events: NOTIFICATION_EVENTS_META,
      channels: this.notificationService.getAvailableChannels(),
    });
  }

  /** Resolved (post-inheritance) view — used by the UI debug pane. */
  @Get('config/resolved')
  @RequireManage()
  @ApiOperation({ summary: 'Get resolved settings with inheritance for a delegation' })
  @ApiOkResponse({ type: NotificationResolvedSettingsResponseDto })
  async getResolvedSettings(
    @Query('delegationId') delegationId: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<NotificationResolvedSettingsResponseDto> {
    const tenantId = req.user.tenantId;
    const delId = delegationId ?? null;
    this.enforceDelegationConsistency(req, delId);
    const resolved = await this.settingsService.resolveSettings(tenantId, delId);
    return toResponse(NotificationResolvedSettingsResponseDto, resolved);
  }

  /**
   * Path-based getter — the `global` sentinel maps to delegationId=null
   * (super-admin only).
   */
  @Get('config/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: 'Get settings for a delegation (use "global" for tenant-wide)' })
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  async getSettingsByParam(
    @Param('delegationId') delegationIdParam: string,
    @Request() req: AuthRequest,
  ): Promise<NotificationSettingsResponseDto> {
    const tenantId = req.user.tenantId;
    const delId = delegationIdParam === 'global' ? null : delegationIdParam;
    this.requireSuperAdminForGlobal(req.user, delId);
    this.enforceDelegationConsistency(req, delId);
    const settings = await this.settingsService.getSettings(tenantId, delId);
    return toResponse(NotificationSettingsResponseDto, settings);
  }

  /** Query-based variant kept for backward compat. */
  @Get('config')
  @RequireManage()
  @ApiOperation({ summary: 'Get settings via ?delegationId=…' })
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  async getSettings(
    @Query('delegationId') delegationId: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<NotificationSettingsResponseDto> {
    const tenantId = req.user.tenantId;
    const delId = delegationId || null;
    this.requireSuperAdminForGlobal(req.user, delId);
    this.enforceDelegationConsistency(req, delId);
    const settings = await this.settingsService.getSettings(tenantId, delId);
    return toResponse(NotificationSettingsResponseDto, settings);
  }

  /**
   * Save settings. Atomic — channels and rules upserted in a single
   * transaction. Channels and rules absent from the payload are deleted
   * at this scope.
   */
  @Put('config')
  @RequireManage()
  @ApiOperation({ summary: 'Save notification settings (channels + rules)' })
  @ApiOkResponse({ type: NotificationSettingsResponseDto })
  async saveSettings(
    @Body() dto: SaveNotificationSettingsDto,
    @Request() req: AuthRequest,
  ): Promise<NotificationSettingsResponseDto> {
    const tenantId = req.user.tenantId;
    const delegationId = dto.delegationId ?? null;
    this.requireSuperAdminForGlobal(req.user, delegationId);
    this.enforceDelegationConsistency(req, delegationId);
    const settings = await this.settingsService.saveSettings(tenantId, delegationId, {
      channels: dto.channels,
      rules: dto.rules,
    });
    return toResponse(NotificationSettingsResponseDto, settings);
  }

  /** Delete every channel + rule at this scope (revert to inheritance). */
  @Delete('config/:delegationId')
  @RequireManage()
  @ApiOperation({ summary: 'Delete settings at this scope — "global" = tenant-wide' })
  @ApiOkResponse({ type: NotificationDeleteSettingsResponseDto })
  async deleteSettings(
    @Param('delegationId') delegationIdParam: string,
    @Request() req: AuthRequest,
  ): Promise<NotificationDeleteSettingsResponseDto> {
    const tenantId = req.user.tenantId;
    const delId = delegationIdParam === 'global' ? null : delegationIdParam;
    this.requireSuperAdminForGlobal(req.user, delId);
    this.enforceDelegationConsistency(req, delId);
    return this.settingsService.deleteSettings(tenantId, delId);
  }

  /** Tenant-wide overview (super-admin). */
  @Get('configs')
  @SkipDelegation()
  @RequireManage()
  @ApiOperation({ summary: 'List all notification settings rows for the tenant (super admin)' })
  @ApiOkResponse({ type: NotificationAllSettingsResponseDto })
  async getAllSettings(@Request() req: AuthRequest): Promise<NotificationAllSettingsResponseDto> {
    const all = await this.settingsService.getAllSettings(req.user.tenantId);
    return toResponse(NotificationAllSettingsResponseDto, all);
  }

  /** Synchronous channel test — UI affordance. */
  @Post('test')
  @RequireManage()
  @ApiOperation({ summary: 'Test a notification channel' })
  @ApiOkResponse({ type: NotificationTestResultResponseDto })
  async testChannel(
    @Body() dto: TestChannelDto,
  ): Promise<NotificationTestResultResponseDto> {
    return this.notificationService.testChannel(dto.kind, {
      recipients: dto.recipients,
      webhookUrl: dto.webhookUrl,
    });
  }

  /** NotificationLog tail. */
  @Get('logs')
  @RequireManage()
  @ApiOperation({ summary: 'Get notification logs' })
  @ApiOkResponse({ type: NotificationLogPageResponseDto })
  async getLogs(
    @Query() query: NotificationLogQueryDto,
    @Request() req: AuthRequest,
  ): Promise<NotificationLogPageResponseDto> {
    const page = await this.settingsService.getLogs(req.user.tenantId, query);
    return toResponse(NotificationLogPageResponseDto, page);
  }

  private requireSuperAdminForGlobal(user: AuthUserLike, delegationId: string | null) {
    if (delegationId === null && !user.isSuperAdmin) {
      throw new ForbiddenException('Only super admins can manage global notification settings');
    }
  }

  /**
   * ADR-021 §C — refuse cross-skew between the active delegation
   * (X-Delegation-Id header validated by DelegationGuard) and the
   * delegationId carried in the URL param / query / body. Without
   * this check, a MANAGE-on-A user could write the config of B simply
   * by passing `delegationId: B` in the body — bug captured in
   * audit Phase 1.
   *
   * Skips when the param is null (handled by requireSuperAdminForGlobal)
   * or when the user is super admin (bypass).
   */
  private enforceDelegationConsistency(req: AuthRequest, paramOrDtoDelegationId: string | null) {
    if (paramOrDtoDelegationId === null) return;
    if (req.user?.isSuperAdmin) return;
    const headerDelegationId = (req as unknown as { delegationId?: string | null }).delegationId ?? null;
    if (headerDelegationId !== paramOrDtoDelegationId) {
      throw new ForbiddenException(
        `Delegation mismatch : header X-Delegation-Id=${headerDelegationId ?? 'null'} ` +
          `does not match payload delegationId=${paramOrDtoDelegationId}`,
      );
    }
  }
}
