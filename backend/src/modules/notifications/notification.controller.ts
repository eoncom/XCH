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
@Controller('api/notifications')
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
   * Get notification config for a specific scope.
   */
  @Get('config/:scopeType/:scopeId')
  @ApiOperation({ summary: 'Get notification config for a scope' })
  async getConfig(
    @Param('scopeType') scopeType: string,
    @Param('scopeId') scopeId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    await this.checkScopeAccess(req.user, scopeType, scopeId);
    return this.configService.getConfig(tenantId, scopeType.toUpperCase(), scopeId);
  }

  /**
   * Get the resolved (effective) config for a scope, with inheritance applied.
   */
  @Get('config/resolved')
  @ApiOperation({ summary: 'Get resolved config with inheritance for a scope context' })
  async getResolvedConfig(
    @Query('delegationId') delegationId?: string,
    @Query('divisionId') divisionId?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.configService.resolveConfig(tenantId, { delegationId, divisionId });
  }

  /**
   * Save notification config for a scope.
   */
  @Put('config')
  @ApiOperation({ summary: 'Save notification config for a scope' })
  async saveConfig(@Body() dto: SaveNotificationConfigDto, @Request() req: any) {
    const tenantId = req.user.tenantId;
    await this.checkScopeAccess(req.user, dto.scopeType, dto.scopeId);
    return this.configService.saveConfig(tenantId, dto.scopeType, dto.scopeId, {
      channels: dto.channels,
      events: dto.events,
    });
  }

  /**
   * Delete notification config for a scope (revert to inheritance).
   */
  @Delete('config/:scopeType/:scopeId')
  @ApiOperation({ summary: 'Delete config for a scope (revert to inheritance)' })
  async deleteConfig(
    @Param('scopeType') scopeType: string,
    @Param('scopeId') scopeId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    await this.checkScopeAccess(req.user, scopeType, scopeId);
    return this.configService.deleteConfig(tenantId, scopeType.toUpperCase(), scopeId);
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
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private requireAdminOrManager(user: any) {
    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException('Admin or Manager access required');
    }
  }

  /**
   * Check if the user has access to manage notifications for a given scope.
   * - ADMIN: can manage all scopes
   * - MANAGER: can manage division/delegation they belong to
   */
  private async checkScopeAccess(user: any, scopeType: string, scopeId: string) {
    if (user.role === 'ADMIN') return; // Admin can do everything

    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException('Admin or Manager access required');
    }

    const upper = scopeType.toUpperCase();

    if (upper === 'TENANT') {
      throw new ForbiddenException('Only admins can manage tenant-level notifications');
    }

    // For divisions/delegations, check user scopes
    const scopes = await this.prisma.userScope.findMany({
      where: { userId: user.sub || user.id },
    });

    if (upper === 'DIVISION') {
      const hasDivisionScope = scopes.some(
        (s) =>
          (s.scopeType === 'TENANT') ||
          (s.scopeType === 'DIVISION' && s.scopeId === scopeId),
      );
      if (!hasDivisionScope) {
        throw new ForbiddenException('You do not have access to this division');
      }
    }

    if (upper === 'DELEGATION') {
      // Check delegation → division → scope chain
      const delegation = await this.prisma.delegation.findUnique({
        where: { id: scopeId },
      });
      if (!delegation) throw new ForbiddenException('Delegation not found');

      const hasDelegationScope = scopes.some(
        (s) =>
          (s.scopeType === 'TENANT') ||
          (s.scopeType === 'DIVISION' && s.scopeId === delegation.divisionId) ||
          (s.scopeType === 'DELEGATION' && s.scopeId === scopeId),
      );
      if (!hasDelegationScope) {
        throw new ForbiddenException('You do not have access to this delegation');
      }
    }
  }
}
