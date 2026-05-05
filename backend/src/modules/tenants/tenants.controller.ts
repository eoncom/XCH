import { Controller, Get, Patch, Body, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateModulesDto } from './dto/update-modules.dto';
import { UpdateTenantAppearanceDto } from './dto/appearance.dto';
import { AuthRequest } from '../../types/request.interface';
import { SkipDelegation } from '../../common/decorators/skip-delegation.decorator';
import { RequireRead, RequireWrite, RequireManage } from '../../common/decorators/require-right.decorator';
import { toResponse } from '../../common/utils/to-response.util';
import { TenantResponseDto } from './dto/tenant.response.dto';
import { TenantCurrentConfigResponseDto } from './dto/tenant-current-config.response.dto';
import { TenantModulesResponseDto } from './dto/tenant-modules.response.dto';
import { TenantSsoConfigResponseDto } from './dto/tenant-sso-config.response.dto';
import { TenantSecurityConfigResponseDto } from './dto/tenant-security-config.response.dto';
import { TenantElectricityConfigResponseDto } from './dto/tenant-electricity-config.response.dto';
import { TenantAppearanceResponseDto } from './dto/tenant-appearance.response.dto';

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
  @ApiOkResponse({ type: TenantResponseDto })
  async getCurrentTenant(@Request() req: AuthRequest): Promise<TenantResponseDto> {
    const tenant = await this.tenantsService.findOneSafe(req.user.tenantId);
    return toResponse(TenantResponseDto, tenant);
  }

  @Get('current/config')
  @RequireRead()
  @ApiOperation({ summary: 'Get current tenant config (branding)' })
  @ApiOkResponse({ type: TenantCurrentConfigResponseDto })
  async getConfig(@Request() req: AuthRequest): Promise<TenantCurrentConfigResponseDto> {
    const cfg = await this.tenantsService.getConfig(req.user.tenantId);
    return toResponse(TenantCurrentConfigResponseDto, cfg);
  }

  @Patch('current')
  @RequireWrite()
  @ApiOperation({ summary: 'Update current tenant' })
  @ApiOkResponse({ type: TenantResponseDto })
  async update(
    @Body() updateTenantDto: UpdateTenantDto,
    @Request() req: AuthRequest,
  ): Promise<TenantResponseDto> {
    const tenant = await this.tenantsService.update(req.user.tenantId, updateTenantDto);
    return toResponse(TenantResponseDto, tenant);
  }

  // ============================================================================
  // MODULES
  // ============================================================================

  @Get('modules')
  @RequireRead()
  @ApiOperation({ summary: 'Get all modules with enabled/disabled status' })
  @ApiOkResponse({ type: TenantModulesResponseDto })
  async getModules(@Request() req: AuthRequest): Promise<TenantModulesResponseDto> {
    const modules = await this.tenantsService.getModules(req.user.tenantId);
    return toResponse(TenantModulesResponseDto, modules);
  }

  @Patch('modules')
  @RequireWrite()
  @ApiOperation({ summary: 'Update module enabled/disabled states (ADMIN only)' })
  @ApiOkResponse({ type: TenantModulesResponseDto })
  async updateModules(
    @Body() updateModulesDto: UpdateModulesDto,
    @Request() req: AuthRequest,
  ): Promise<TenantModulesResponseDto> {
    const modules = await this.tenantsService.updateModules(req.user.tenantId, updateModulesDto.modules);
    return toResponse(TenantModulesResponseDto, modules);
  }

  // ============================================================================
  // SSO CONFIGURATION
  // ============================================================================

  @Get('sso-config')
  @RequireRead()
  @ApiOperation({ summary: 'Get SSO configuration for current tenant' })
  @ApiOkResponse({ type: TenantSsoConfigResponseDto })
  async getSsoConfig(@Request() req: AuthRequest): Promise<TenantSsoConfigResponseDto> {
    const sso = await this.tenantsService.getSsoConfig(req.user.tenantId);
    return toResponse(TenantSsoConfigResponseDto, sso);
  }

  @Patch('sso-config')
  @RequireWrite()
  @ApiOperation({ summary: 'Update SSO configuration (ADMIN only)' })
  @ApiOkResponse({ type: TenantSsoConfigResponseDto })
  async updateSsoConfig(
    @Body() ssoConfig: Record<string, unknown>,
    @Request() req: AuthRequest,
  ): Promise<TenantSsoConfigResponseDto> {
    const sso = await this.tenantsService.updateSsoConfig(req.user.tenantId, ssoConfig);
    return toResponse(TenantSsoConfigResponseDto, sso);
  }

  // ============================================================================
  // SECURITY CONFIGURATION
  // ============================================================================

  @Get('security-config')
  @RequireRead()
  @ApiOperation({ summary: 'Get security configuration (2FA, session timeout)' })
  @ApiOkResponse({ type: TenantSecurityConfigResponseDto })
  async getSecurityConfig(@Request() req: AuthRequest): Promise<TenantSecurityConfigResponseDto> {
    return this.tenantsService.getSecurityConfig(req.user.tenantId);
  }

  @Patch('security-config')
  @RequireWrite()
  @ApiOperation({ summary: 'Update security configuration (ADMIN only)' })
  @ApiOkResponse({ type: TenantSecurityConfigResponseDto })
  async updateSecurityConfig(
    @Body() securityConfig: Record<string, unknown>,
    @Request() req: AuthRequest,
  ): Promise<TenantSecurityConfigResponseDto> {
    return this.tenantsService.updateSecurityConfig(req.user.tenantId, securityConfig);
  }

  @Get('electricity-config')
  @RequireRead()
  @ApiOperation({ summary: 'Get electricity configuration (cost per kWh, currency)' })
  @ApiOkResponse({ type: TenantElectricityConfigResponseDto })
  async getElectricityConfig(@Request() req: AuthRequest): Promise<TenantElectricityConfigResponseDto> {
    return this.tenantsService.getElectricityConfig(req.user.tenantId);
  }

  @Patch('electricity-config')
  @RequireManage()
  @ApiOperation({ summary: 'Update electricity configuration' })
  @ApiOkResponse({ type: TenantElectricityConfigResponseDto })
  async updateElectricityConfig(
    @Body() body: { costPerKwh?: number; currency?: string },
    @Request() req: AuthRequest,
  ): Promise<TenantElectricityConfigResponseDto> {
    return this.tenantsService.updateElectricityConfig(req.user.tenantId, body);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010)
  // ============================================================================

  @Get('appearance')
  @RequireRead()
  @ApiOperation({ summary: 'Get tenant-level appearance defaults (authenticated users)' })
  @ApiOkResponse({ type: TenantAppearanceResponseDto })
  async getAppearance(@Request() req: AuthRequest): Promise<TenantAppearanceResponseDto> {
    return this.tenantsService.getAppearanceConfig(req.user.tenantId);
  }

  @Patch('appearance')
  @RequireManage()
  @ApiOperation({ summary: 'Update tenant-level appearance defaults (super admin only)' })
  @ApiOkResponse({ type: TenantAppearanceResponseDto })
  async updateAppearance(
    @Body() dto: UpdateTenantAppearanceDto,
    @Request() req: AuthRequest,
  ): Promise<TenantAppearanceResponseDto> {
    return this.tenantsService.updateAppearanceConfig(req.user.tenantId, req.user.userId, dto);
  }
}
