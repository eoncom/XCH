import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiExtraModels } from '@nestjs/swagger';
import { ConsumptionService } from './consumption.service';
import {
  ConsumptionByTypeEntryResponseDto,
  ConsumptionRackResponseDto,
  ConsumptionSiteResponseDto,
  ConsumptionSummaryResponseDto,
  toConsumptionRackResponseDto,
  toConsumptionSiteResponseDto,
  toConsumptionSummaryResponseDto,
} from './dto/consumption.response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireRead } from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';

// Register the by-type entry as an extra model so Swagger generates it
// even though no field references it directly (it's only inside a Record).
@ApiExtraModels(ConsumptionByTypeEntryResponseDto)
@ApiTags('consumption')
@Controller('consumption')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConsumptionController {
  constructor(private readonly service: ConsumptionService) {}

  @Get('summary')
  @RequireRead()
  @ApiOperation({ summary: 'Tenant-wide electrical consumption summary (per site)' })
  @ApiOkResponse({ type: ConsumptionSummaryResponseDto })
  async summary(@Request() req: AuthRequest, @CallerCtxParam() ctx: CallerCtx): Promise<ConsumptionSummaryResponseDto> {
    const result = await this.service.summary(req.user.tenantId, {}, ctx);
    return toConsumptionSummaryResponseDto(result);
  }

  @Get()
  @RequireRead()
  @ApiOperation({ summary: 'Compute consumption for a site or rack (via query params)' })
  @ApiOkResponse({
    description:
      'Returns ConsumptionSiteResponseDto when ?siteId is provided, ConsumptionRackResponseDto when ?rackId is provided, ConsumptionSummaryResponseDto otherwise. Wire shapes are documented on the dedicated endpoints below.',
    type: ConsumptionSummaryResponseDto,
  })
  async compute(
    @Query('siteId') siteId: string | undefined,
    @Query('rackId') rackId: string | undefined,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConsumptionSiteResponseDto | ConsumptionRackResponseDto | ConsumptionSummaryResponseDto> {
    if (siteId) {
      const result = await this.service.computeSite(req.user.tenantId, siteId, ctx);
      return toConsumptionSiteResponseDto(result);
    }
    if (rackId) {
      const result = await this.service.computeRack(req.user.tenantId, rackId, ctx);
      return toConsumptionRackResponseDto(result);
    }
    const result = await this.service.summary(req.user.tenantId, {}, ctx);
    return toConsumptionSummaryResponseDto(result);
  }

  @Get('site/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Consumption for a specific site' })
  @ApiOkResponse({ type: ConsumptionSiteResponseDto })
  async computeSite(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConsumptionSiteResponseDto> {
    const result = await this.service.computeSite(req.user.tenantId, id, ctx);
    return toConsumptionSiteResponseDto(result);
  }

  @Get('rack/:id')
  @RequireRead()
  @ApiOperation({ summary: 'Consumption for a specific rack' })
  @ApiOkResponse({ type: ConsumptionRackResponseDto })
  async computeRack(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<ConsumptionRackResponseDto> {
    const result = await this.service.computeRack(req.user.tenantId, id, ctx);
    return toConsumptionRackResponseDto(result);
  }
}
