import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateModulesDto } from './dto/update-modules.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../../common/guards/casbin.guard';
import { Resource, Action } from '../../common/decorators/permissions.decorator';
import { AuthRequest } from '../../types/request.interface';

@ApiTags('tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, CasbinGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get current tenant' })
  getCurrentTenant(@Request() req: AuthRequest) {
    return this.tenantsService.findOneSafe(req.user.tenantId);
  }

  @Get('current/config')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get current tenant config (branding)' })
  getConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getConfig(req.user.tenantId);
  }

  @Patch('current')
  @Resource('tenants') @Action('update')
  @ApiOperation({ summary: 'Update current tenant' })
  update(@Body() updateTenantDto: UpdateTenantDto, @Request() req: AuthRequest) {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto);
  }

  // ============================================================================
  // MODULES
  // ============================================================================

  @Get('modules')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get all modules with enabled/disabled status' })
  getModules(@Request() req: AuthRequest) {
    return this.tenantsService.getModules(req.user.tenantId);
  }

  @Patch('modules')
  @Resource('tenants') @Action('update')
  @ApiOperation({ summary: 'Update module enabled/disabled states (ADMIN only)' })
  updateModules(
    @Body() updateModulesDto: UpdateModulesDto,
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateModules(req.user.tenantId, updateModulesDto.modules);
  }

  // ============================================================================
  // SSO CONFIGURATION
  // ============================================================================

  @Get('sso-config')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get SSO configuration for current tenant' })
  getSsoConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getSsoConfig(req.user.tenantId);
  }

  @Patch('sso-config')
  @Resource('tenants') @Action('update')
  @ApiOperation({ summary: 'Update SSO configuration (ADMIN only)' })
  updateSsoConfig(
    @Body() ssoConfig: Record<string, any>,
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateSsoConfig(req.user.tenantId, ssoConfig);
  }

  // ============================================================================
  // SECURITY CONFIGURATION
  // ============================================================================

  @Get('security-config')
  @Resource('tenants') @Action('read')
  @ApiOperation({ summary: 'Get security configuration (2FA, session timeout)' })
  getSecurityConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getSecurityConfig(req.user.tenantId);
  }

  @Patch('security-config')
  @Resource('tenants') @Action('update')
  @ApiOperation({ summary: 'Update security configuration (ADMIN only)' })
  updateSecurityConfig(
    @Body() securityConfig: Record<string, any>,
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateSecurityConfig(req.user.tenantId, securityConfig);
  }
}
