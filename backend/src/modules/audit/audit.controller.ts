import { Controller, ForbiddenException, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditService } from './audit.service';
import { AuditLogListResponseDto } from './dto/audit-log-list.response.dto';
import { toResponse } from '../../common/utils/to-response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireManage, RequireRead } from '../../common/decorators/require-right.decorator';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly service: AuditService) {}

  // Global tenant-wide audit log is a SUPER-ADMIN ONLY view.
  // - `@SkipDelegation + @RequireManage` is the documented pattern for tenant-wide
  //   super-admin endpoints (see AUTH_MODEL.md §7).
  // - MANAGE users should consult the per-entity audit stream (see `entity/:type/:id`)
  //   for the resources they have visibility on.
  @Get()
  /**
   * @SkipDelegation — Catégorie 1 (tenant-wide super-admin) :
   * vue audit globale du tenant, super-admin only. Cf. ADR-028.
   */
  @SkipDelegation()
  @RequireManage()
  // Vue super-admin lourde (pagination + 7 sub-fetches enrichLabels). 60/min
  // suffit pour navigation interactive, bloque le scrape automatisé.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Query tenant-wide audit log (super admin only)' })
  @ApiOkResponse({ type: AuditLogListResponseDto, description: 'Paginated audit log + enrichWithEntityLabels' })
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
  ): Promise<AuditLogListResponseDto> {
    if (!req.user.isSuperAdmin) {
      throw new ForbiddenException('Réservé aux super administrateurs');
    }
    const result = await this.service.query(req.user.tenantId, {
      entity,
      entityId,
      userId,
      action,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
    return toResponse(AuditLogListResponseDto, result);
  }

  @Get('entity/:type/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Get audit log entries for a specific entity' })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  async forEntity(
    @Param('type') type: string,
    @Param('id') id: string,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthRequest,
  ): Promise<AuditLogListResponseDto> {
    const result = await this.service.query(req.user.tenantId, {
      entity: type,
      entityId: id,
      pageSize: limit ? parseInt(limit, 10) : 50,
    });
    return toResponse(AuditLogListResponseDto, result);
  }
}
