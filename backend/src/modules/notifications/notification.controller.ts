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
import { PrismaClient } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(
    private configService: NotificationConfigService,
    private notificationService: NotificationService,
    private prisma: PrismaClient,
  ) {}

  /**
   * Get available event types and channels (for UI rendering).
   */
  @Get('meta')
  @ApiOperation({ summary: 'Get notification event types and channels metadata' })
  getMeta() {
    return {
      events: NOTIFICATION_EVENTS,
      channels: this.notificationService.getAvailableChannels(),
    };
  }

  /**
   * Get notification config for a delegation (or global if delegationId=null).
   */
  @Get('config')
  @ApiOperation({ summary: 'Get notification config for a delegation or global' })
  async getConfig(
    @Query('delegationId') delegationId: string | undefined,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const delId = delegationId || null;
    await this.checkDelegationAccess(req.user, delId);
    return this.configService.getConfig(tenantId, delId);
  }

  /**
   * Get the resolved (effective) config for a delegation, with inheritance applied.
   */
  @Get('config/resolved')
  @ApiOperation({ summary: 'Get resolved config with inheritance for a delegation' })
  async getResolvedConfig(
    @Query('delegationId') delegationId?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.configService.resolveConfig(tenantId, delegationId);
  }

  /**
   * Save notification config for a delegation (or global).
   */
  @Put('config')
  @ApiOperation({ summary: 'Save notification config' })
  async saveConfig(@Body() dto: SaveNotificationConfigDto, @Request() req: any) {
    const tenantId = req.user.tenantId;
    const delegationId = dto.delegationId ?? null;
    await this.checkDelegationAccess(req.user, delegationId);
    return this.configService.saveConfig(tenantId, delegationId, {
      channels: dto.channels,
      events: dto.events,
    });
  }

  /**
   * Delete notification config for a delegation (revert to inheritance).
   */
  @Delete('config/:delegationId')
  @ApiOperation({ summary: 'Delete config for a delegation (revert to inheritance)' })
  async deleteConfig(
    @Param('delegationId') delegationId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    await this.checkDelegationAccess(req.user, delegationId);
    return this.configService.deleteConfig(tenantId, delegationId);
  }

  /**
   * Get all notification configs for the tenant (admin overview).
   */
  @Get('configs')
  @ApiOperation({ summary: 'List all notification configs for the tenant' })
  async getAllConfigs(@Request() req: any) {
    this.requireAdmin(req.user);
    return this.configService.getAllConfigs(req.user.tenantId);
  }

  /**
   * Test a notification channel.
   */
  @Post('test')
  @ApiOperation({ summary: 'Test a notification channel' })
  async testChannel(@Body() dto: TestChannelDto, @Request() req: any) {
    this.requireAdminOrManager(req.user);
    return this.notificationService.testChannel(dto.channel, dto.config as any);
  }

  /**
   * Get notification logs.
   */
  @Get('logs')
  @ApiOperation({ summary: 'Get notification logs' })
  async getLogs(@Query() query: NotificationLogQueryDto, @Request() req: any) {
    this.requireAdminOrManager(req.user);
    return this.configService.getLogs(req.user.tenantId, query);
  }

  // ──────────────── Access control ────────────────

  private requireAdmin(user: any) {
    if (user.isSuperAdmin) return;
    // Use localRole from DelegationGuard only — no fallback to user.role
    if (user.localRole !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private requireAdminOrManager(user: any) {
    if (user.isSuperAdmin) return;
    // Use localRole from DelegationGuard only — no fallback to user.role
    if (!['ADMIN', 'MANAGER'].includes(user.localRole)) {
      throw new ForbiddenException('Admin or Manager access required');
    }
  }

  /**
   * Check access to manage notification config for a delegation.
   * - Super admin: can manage all (including global)
   * - Admin/Manager: can manage their own delegations
   * - Global config (delegationId=null): super admin only
   */
  private async checkDelegationAccess(user: any, delegationId: string | null) {
    if (user.isSuperAdmin) return;

    // Use localRole from DelegationGuard only — no fallback to user.role
    if (!['ADMIN', 'MANAGER'].includes(user.localRole)) {
      throw new ForbiddenException('Admin or Manager access required');
    }

    // Global config is super admin only
    if (delegationId === null) {
      throw new ForbiddenException('Only super admins can manage global notification config');
    }

    // Check user has a UserDelegation for this delegation
    const userDelegation = await this.prisma.userDelegation.findUnique({
      where: { userId_delegationId: { userId: user.id, delegationId } },
    });

    if (!userDelegation) {
      throw new ForbiddenException('You do not have access to this delegation');
    }
  }
}
