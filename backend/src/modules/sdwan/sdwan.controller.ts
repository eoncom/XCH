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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('sdwan')
@Controller('sdwan')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SdwanController {
  constructor(private readonly service: SdwanService) {}

  @Get(':siteId')
  @RequireRead()
  @ApiOperation({ summary: 'Get SD-WAN config for a site (null if unconfigured)' })
  getBySite(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.getBySite(req.user.tenantId, siteId, ctx);
  }

  @Put(':siteId')
  @RequireWrite()
  @ApiOperation({ summary: 'Upsert SD-WAN config for a site' })
  upsert(
    @Param('siteId') siteId: string,
    @Body() dto: UpsertSdwanConfigDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.upsert(req.user.tenantId, siteId, dto, ctx);
  }

  @Delete(':siteId')
  @RequireManage()
  @ApiOperation({ summary: 'Delete SD-WAN config for a site (removes all firewall links)' })
  remove(
    @Param('siteId') siteId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.remove(req.user.tenantId, siteId, ctx);
  }

  @Post(':siteId/firewalls')
  @RequireWrite()
  @ApiOperation({ summary: 'Attach a firewall asset to this site SD-WAN config' })
  attachFirewall(
    @Param('siteId') siteId: string,
    @Body() dto: AttachFirewallDto,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.attachFirewall(req.user.tenantId, siteId, dto, ctx);
  }

  @Delete(':siteId/firewalls/:assetId')
  @RequireWrite()
  @ApiOperation({ summary: 'Detach a firewall asset from this site SD-WAN config' })
  detachFirewall(
    @Param('siteId') siteId: string,
    @Param('assetId') assetId: string,
    @Request() req: AuthRequest,
    @CallerCtxParam() ctx: CallerCtx,
  ) {
    return this.service.detachFirewall(req.user.tenantId, siteId, assetId, ctx);
  }
}
