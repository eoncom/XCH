import { Controller, Get, Patch, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateModulesDto } from './dto/update-modules.dto';
import { UpdateTenantAppearanceDto } from './dto/appearance.dto';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';

@ApiTags('tenants')
@Controller('tenants')
@SkipDelegation()
@RequireManage()
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  @RequireRead()
  @ApiOperation({ summary: 'Get current tenant' })
  getCurrentTenant(@Request() req: AuthRequest) {
    return this.tenantsService.findOneSafe(req.user.tenantId);
  }

  @Get('current/config')
  @RequireRead()
  @ApiOperation({ summary: 'Get current tenant config (branding)' })
  getConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getConfig(req.user.tenantId);
  }

  @Patch('current')
  @RequireWrite()
  @ApiOperation({ summary: 'Update current tenant' })
  update(@Body() updateTenantDto: UpdateTenantDto, @Request() req: AuthRequest) {
    return this.tenantsService.update(req.user.tenantId, updateTenantDto);
  }

  // ============================================================================
  // MODULES
  // ============================================================================

  @Get('modules')
  @RequireRead()
  @ApiOperation({ summary: 'Get all modules with enabled/disabled status' })
  getModules(@Request() req: AuthRequest) {
    return this.tenantsService.getModules(req.user.tenantId);
  }

  @Patch('modules')
  @RequireWrite()
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
  @RequireRead()
  @ApiOperation({ summary: 'Get SSO configuration for current tenant' })
  getSsoConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getSsoConfig(req.user.tenantId);
  }

  @Patch('sso-config')
  @RequireWrite()
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
  @RequireRead()
  @ApiOperation({ summary: 'Get security configuration (2FA, session timeout)' })
  getSecurityConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getSecurityConfig(req.user.tenantId);
  }

  @Patch('security-config')
  @RequireWrite()
  @ApiOperation({ summary: 'Update security configuration (ADMIN only)' })
  updateSecurityConfig(
    @Body() securityConfig: Record<string, any>,
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateSecurityConfig(req.user.tenantId, securityConfig);
  }

  @Get('electricity-config')
  @RequireRead()
  @ApiOperation({ summary: 'Get electricity configuration (cost per kWh, currency)' })
  getElectricityConfig(@Request() req: AuthRequest) {
    return this.tenantsService.getElectricityConfig(req.user.tenantId);
  }

  @Patch('electricity-config')
  @RequireManage()
  @ApiOperation({ summary: 'Update electricity configuration' })
  updateElectricityConfig(
    @Body() body: { costPerKwh?: number; currency?: string },
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateElectricityConfig(req.user.tenantId, body);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010)
  // Tenant-level defaults: readable by any authenticated user (so the AppearanceProvider
  //   can resolve effective appearance), but only writable by super admins.
  // ============================================================================

  @Get('appearance')
  @RequireRead()
  @ApiOperation({ summary: 'Get tenant-level appearance defaults (authenticated users)' })
  getAppearance(@Request() req: AuthRequest) {
    return this.tenantsService.getAppearanceConfig(req.user.tenantId);
  }

  @Patch('appearance')
  @RequireManage()
  @ApiOperation({ summary: 'Update tenant-level appearance defaults (super admin only)' })
  updateAppearance(
    @Body() dto: UpdateTenantAppearanceDto,
    @Request() req: AuthRequest,
  ) {
    return this.tenantsService.updateAppearanceConfig(req.user.tenantId, req.user.userId, dto);
  }
}
