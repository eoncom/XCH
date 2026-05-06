import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  RequireManage,
  RequireRead,
  RequireWrite,
} from '../../common/decorators/require-right.decorator';
import { CallerCtxParam } from '../../common/decorators/caller-ctx.decorator';
import { CallerCtx } from '../../common/types/caller-ctx.interface';
import { AuthRequest } from '../../types/request.interface';
import { SdwanService } from './sdwan.service';
import { AttachFirewallDto, UpsertSdwanConfigDto } from './dto/sdwan.dto';
import {
  SdwanConfigResponseDto,
  SdwanDeletedResultResponseDto,
} from './dto/sdwan-config.response.dto';
import { toResponse } from '../../common/utils/to-response.util';

@ApiTags('sdwan')
@Controller('sdwan')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SdwanController {
  constructor(private readonly service: SdwanService) {}

  @Get(':siteId')
  @RequireRead()
  @ApiOperation({ summary: 'Get SD-WAN config for a site (null if unconfigured)' })
  @ApiOkResponse({ type: SdwanConfigResponseDto, description: 'SD-WAN config + firewalls. Body is `null` if no config exists yet.' })
  async getBySite(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SdwanConfigResponseDto | null> {
    const row = await this.service.getBySite(req.user.tenantId, siteId, ctx);
    return row ? toResponse(SdwanConfigResponseDto, row) : null;
  }

  @Put(':siteId')
  @RequireWrite()
  @ApiOperation({ summary: 'Upsert SD-WAN config for a site' })
  @ApiOkResponse({ type: SdwanConfigResponseDto })
  async upsert(
    @Param('siteId') siteId: string,
    @Body() dto: UpsertSdwanConfigDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SdwanConfigResponseDto> {
    const row = await this.service.upsert(req.user.tenantId, siteId, dto, ctx);
    return toResponse(SdwanConfigResponseDto, row);
  }

  @Delete(':siteId')
  @RequireManage()
  @ApiOperation({ summary: 'Delete SD-WAN config for a site (removes all firewall links)' })
  @ApiOkResponse({ type: SdwanDeletedResultResponseDto })
  async remove(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SdwanDeletedResultResponseDto> {
    const result = await this.service.remove(req.user.tenantId, siteId, ctx);
    return toResponse(SdwanDeletedResultResponseDto, result);
  }

  @Post(':siteId/firewalls')
  @RequireWrite()
  @ApiOperation({ summary: 'Attach a firewall asset to this site SD-WAN config' })
  @ApiOkResponse({ type: SdwanConfigResponseDto, description: 'Returns the refreshed SD-WAN config (with the new firewall in firewalls[])' })
  async attachFirewall(
    @Param('siteId') siteId: string,
    @Body() dto: AttachFirewallDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SdwanConfigResponseDto | null> {
    const row = await this.service.attachFirewall(req.user.tenantId, siteId, dto, ctx);
    return row ? toResponse(SdwanConfigResponseDto, row) : null;
  }

  @Delete(':siteId/firewalls/:assetId')
  @RequireWrite()
  @ApiOperation({ summary: 'Detach a firewall asset from this site SD-WAN config' })
  @ApiOkResponse({ type: SdwanConfigResponseDto, description: 'Returns the refreshed SD-WAN config (firewall removed from firewalls[])' })
  async detachFirewall(
    @Param('siteId') siteId: string,
    @Param('assetId') assetId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ): Promise<SdwanConfigResponseDto | null> {
    const row = await this.service.detachFirewall(req.user.tenantId, siteId, assetId, ctx);
    return row ? toResponse(SdwanConfigResponseDto, row) : null;
  }
}
