import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage, RequireRead } from '../../common/decorators/require-right.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequireManage()
  @ApiOperation({ summary: 'Query audit log entries (admin only)' })
  async query(
    @Query('entity') entity: string | undefined,
    @Query('entityId') entityId: string | undefined,
    @Query('userId') userId: string | undefined,
    @Query('action') action: 'CREATE' | 'UPDATE' | 'DELETE' | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Request() req: AuthRequest,
  ) {
    return this.service.query(req.user.tenantId, {
      entity,
      entityId,
      userId,
      action,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('entity/:type/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Get audit log entries for a specific entity' })
  async forEntity(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthRequest,
  ) {
    return this.service.query(req.user.tenantId, {
      entity: type,
      entityId: id,
      pageSize: limit ? parseInt(limit, 10) : 50,
    });
  }
}
