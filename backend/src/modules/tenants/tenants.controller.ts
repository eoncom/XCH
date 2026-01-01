import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get current tenant' })
  getCurrentTenant(@Request() req) {
    return this.tenantsService.findOne(req.user.tenantId);
  }

  @Get('current/config')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get current tenant config (branding)' })
  getConfig(@Request() req) {
    return this.tenantsService.getConfig(req.user.tenantId);
  }

  @Patch('current')
  @Resource('tenants') @Action('update')
  @ApiOperation({ summary: 'Update current tenant' })
  update(@Body() updateTenantDto: UpdateTenantDto, @Request() req) {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto);
  }
}
