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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserNotificationService } from './user-notification.service';

@ApiTags('User Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/inbox')
export class UserNotificationController {
  constructor(private service: UserNotificationService) {}

  @Get('me')
  @ApiOperation({ summary: 'List current user notifications' })
  async listMine(
    @Request() req: any,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForUser(
      req.user.id,
      req.user.tenantId,
      unreadOnly === 'true' || unreadOnly === '1',
      parseInt(limit || '50', 10) || 50,
    );
  }

  @Get('count-unread')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  async countUnread(@Request() req: any) {
    return this.service.countUnread(req.user.id, req.user.tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Param('id') id: string, @Request() req: any) {
    const n = await this.service.markRead(id, req.user.id, req.user.tenantId);
    if (!n) return { ok: false };
    return n;
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  async markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.id, req.user.tenantId);
  }
}
