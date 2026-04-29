import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConsumptionService } from './consumption.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('consumption')
@Controller('consumption')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConsumptionController {
  constructor(private readonly service: ConsumptionService) {}

  @Get('summary')
  @RequireRead()
  @ApiOperation({ summary: 'Tenant-wide electrical consumption summary (per site)' })
  summary(@Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx) {
    return this.service.summary(req.user.tenantId, {}, ctx);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Compute consumption for a site or rack (via query params)' })
  compute(
    @Query('siteId') siteId: string | undefined,
    @Query('rackId') rackId: string | undefined,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    if (siteId) {
      return this.service.computeSite(req.user.tenantId, siteId, ctx);
    }
    if (rackId) {
      return this.service.computeRack(req.user.tenantId, rackId, ctx);
    }
    return this.service.summary(req.user.tenantId, {}, ctx);
  }

  @Get('site/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Consumption for a specific site' })
  computeSite(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.computeSite(req.user.tenantId, id, ctx);
  }

  @Get('rack/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Consumption for a specific rack' })
  computeRack(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.computeRack(req.user.tenantId, id, ctx);
  }
}
