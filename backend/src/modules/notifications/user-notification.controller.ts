import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { UserNotificationService } from './user-notification.service';
import { AuthRequest } from '../../types/request.interface';
import { toResponse, toResponseArray } from '../../common/utils/to-response.util';
import {
  UserNotificationResponseDto,
  UserNotificationMarkAllReadResponseDto,
  UserNotificationRemoveResponseDto,
} from './dto/user-notification.response.dto';
import { CountResponseDto } from '../../common/dto/response';

@ApiTags('User Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipDelegation()
@Controller('notifications/inbox')
export class UserNotificationController {
  constructor(private service: UserNotificationService) {}

  @Get('me')
  @ApiOperation({ summary: 'List current user notifications' })
  @ApiOkResponse({ type: UserNotificationResponseDto, isArray: true })
  async listMine(
    @Request() req: AuthRequest,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ): Promise<UserNotificationResponseDto[]> {
    const list = await this.service.listForUser(
      req.user.id,
      req.user.tenantId,
      unreadOnly === 'true' || unreadOnly === '1',
      parseInt(limit || '50', 10) || 50,
    );
    return toResponseArray(UserNotificationResponseDto, list);
  }

  @Get('count-unread')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  @ApiOkResponse({ type: CountResponseDto })
  async countUnread(@Request() req: AuthRequest): Promise<CountResponseDto> {
    return this.service.countUnread(req.user.id, req.user.tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ type: UserNotificationResponseDto })
  async markRead(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<UserNotificationResponseDto | { ok: false }> {
    const n = await this.service.markRead(id, req.user.id, req.user.tenantId);
    if (!n) return { ok: false };
    return toResponse(UserNotificationResponseDto, n);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  @ApiOkResponse({ type: UserNotificationMarkAllReadResponseDto })
  async markAllRead(
    @Request() req: AuthRequest,
  ): Promise<UserNotificationMarkAllReadResponseDto> {
    return this.service.markAllRead(req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiOkResponse({ type: UserNotificationRemoveResponseDto })
  async remove(
    @Param('id') id: string,
    @Request() req: AuthRequest,
  ): Promise<UserNotificationRemoveResponseDto> {
    return this.service.remove(id, req.user.id, req.user.tenantId);
  }
}
