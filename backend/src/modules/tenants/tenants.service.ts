import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import {
  DEFAULT_TENANT_APPEARANCE,
  ResolvedAppearance,
  UpdateTenantAppearanceDto,
} from './dto/appearance.dto';
import { AuditLogService } from '../../common/services/audit-log.service';

/** Default module configuration — all modules enabled */
/**
 * Application modules exposed to the sidebar & Settings > Modules tab.
 * Keys MUST match the `moduleKey` values referenced by the sidebar (see
 * frontend/src/app/dashboard/layout.tsx::navigation). Keeping these in sync
 * is what lets super admins toggle modules on/off tenant-wide.
 */
const DEFAULT_MODULES: Record<string, boolean> = {
  sites: true,
  assets: true,
  racks: true,
  tasks: true,
  floor_plans: true,
  contacts: true,
  documents: true,
  integrations_netbox: true,
  monitoring: true,
  alerts: true,
  costs: true,
  consumption: true,
  qr_codes: true,
  site_access_control: true,
  notifications: true,
};

/** Human-readable descriptions for each module */
const MODULE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  sites: { label: 'Sites', description: 'Gestion des sites (adresses, contacts, connectivité)' },
  assets: { label: 'Équipements', description: 'Inventaire des équipements IT (serveurs, switches, points d\'accès, imprimantes, etc.)' },
  racks: { label: 'Baies', description: 'Gestion des baies et montage des équipements' },
  tasks: { label: 'Tâches', description: 'Suivi des tâches, interventions et échéances (Kanban + liste)' },
  floor_plans: { label: "Plans d'étage", description: 'Plans interactifs avec repères (pins) cliquables et heatmap WiFi' },
  contacts: { label: 'Contacts', description: 'Annuaire des contacts internes et des fournisseurs' },
  documents: { label: 'Documents', description: 'Pièces jointes et documents liés aux sites / assets / tâches' },
  integrations_netbox: { label: 'NetBox', description: 'Synchronisation lecture seule avec NetBox (DCIM / IPAM)' },
  monitoring: { label: 'Monitoring', description: 'Intégration Uptime Kuma / Gatus + tableau de bord santé des sites' },
  alerts: { label: 'Alertes', description: 'Agrégation des alertes (tâches, santé sites, monitoring, garanties, équipements HS)' },
  costs: { label: 'Coûts', description: 'Gestion des dépenses, centres de coûts, budgets et projections mensuelles' },
  consumption: { label: 'Consommation', description: 'Estimation de la consommation électrique et du coût mensuel par site' },
  qr_codes: { label: 'QR Codes', description: 'Génération et scan de QR codes pour les équipements' },
  site_access_control: { label: "Droits d'accès sites", description: "Surcharges d'accès (AccessOverride) ALLOW/DENY par site et par ressource" },
  notifications: { label: 'Notifications', description: 'Alertes email / MS Teams sur événements (tâches assignées, santé sites, garanties, etc.)' },
};

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaClient,
    private auditLogService: AuditLogService,
  ) {}

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Returns tenant without sensitive integration secrets (tokens, passwords).
   * Use this for all API responses exposed to the frontend.
   * Internal services that need credentials should use findOne() directly.
   */
  async findOneSafe(id: string) {
    const tenant = await this.findOne(id);

    if (tenant.config && typeof tenant.config === 'object') {
      const { integrations, ...safeConfig } = tenant.config as Record<string, any>;
      return { ...tenant, config: safeConfig };
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async getConfig(id: string) {
    const tenant = await this.findOneSafe(id);
    return {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      config: tenant.config,
    };
  }

  // ============================================================================
  // MODULE MANAGEMENT
  // ============================================================================

  /**
   * Get the list of all modules with their enabled/disabled status for a tenant.
   * If tenant has no config or no modules key, returns all modules enabled (default).
   */
  async getModules(tenantId: string) {
    const tenant = await this.findOne(tenantId);
    const config = tenant.config as Record<string, any> | null;
    const savedModules = (config?.modules || {}) as Record<string, boolean>;

    // Merge defaults with saved values
    const modules = Object.entries(DEFAULT_MODULES).map(([key, defaultEnabled]) => ({
      key,
      label: MODULE_DESCRIPTIONS[key]?.label || key,
      description: MODULE_DESCRIPTIONS[key]?.description || '',
      enabled: savedModules[key] !== undefined ? savedModules[key] : defaultEnabled,
    }));

    return { modules };
  }

  /**
   * Update module enabled/disabled states for a tenant.
   * Merges the provided modules map into the existing config.modules.
   */
  async updateModules(tenantId: string, modules: Record<string, boolean>) {
    const tenant = await this.findOne(tenantId);
    const config = (tenant.config as Record<string, any>) || {};

    // Merge provided modules with existing config
    const existingModules = (config.modules || {}) as Record<string, boolean>;
    const updatedModules = { ...existingModules };

    // Only accept known module keys
    for (const [key, enabled] of Object.entries(modules)) {
      if (key in DEFAULT_MODULES) {
        updatedModules[key] = enabled;
      }
    }

    const updatedConfig = {
      ...config,
      modules: updatedModules,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: updatedConfig },
    });

    return this.getModules(tenantId);
  }

  // ============================================================================
  // SSO CONFIGURATION
  // ============================================================================

  /**
   * Get SSO configuration for a tenant.
   * Masks the client secret for display (returns only last 4 chars).
   */
  async getSsoConfig(tenantId: string) {
    const tenant = await this.findOne(tenantId);
    const config = tenant.config as Record<string, any> | null;
    const sso = config?.sso || {};

    return {
      enabled: sso.enabled || false,
      provider: sso.provider || 'oidc',
      issuer: sso.issuer || '',
      clientId: sso.clientId || '',
      clientSecretSet: !!sso.clientSecret,
      clientSecretHint: sso.clientSecret
        ? `****${sso.clientSecret.slice(-4)}`
        : '',
      callbackUrl: sso.callbackUrl || '',
      roleMapping: sso.roleMapping || {
        admin: 'ADMIN',
        manager: 'MANAGER',
        technician: 'TECHNICIEN',
        default: 'VIEWER',
      },
    };
  }

  /**
   * Update SSO configuration for a tenant.
   * Stores the full config in Tenant.config.sso.
   * If clientSecret is empty/undefined, keeps the existing one.
   */
  async updateSsoConfig(tenantId: string, ssoConfig: Record<string, any>) {
    const tenant = await this.findOne(tenantId);
    const config = (tenant.config as Record<string, any>) || {};
    const existingSso = config.sso || {};

    const updatedSso = {
      enabled: ssoConfig.enabled ?? existingSso.enabled ?? false,
      provider: ssoConfig.provider || existingSso.provider || 'oidc',
      issuer: ssoConfig.issuer ?? existingSso.issuer ?? '',
      clientId: ssoConfig.clientId ?? existingSso.clientId ?? '',
      // Only update secret if a non-empty value is provided
      clientSecret: ssoConfig.clientSecret || existingSso.clientSecret || '',
      callbackUrl: ssoConfig.callbackUrl ?? existingSso.callbackUrl ?? '',
      roleMapping: ssoConfig.roleMapping ?? existingSso.roleMapping ?? {
        admin: 'ADMIN',
        manager: 'MANAGER',
        technician: 'TECHNICIEN',
        default: 'VIEWER',
      },
    };

    const updatedConfig = {
      ...config,
      sso: updatedSso,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: updatedConfig },
    });

    return this.getSsoConfig(tenantId);
  }

  // ============================================================================
  // SECURITY CONFIGURATION
  // ============================================================================

  /**
   * Get security configuration for a tenant.
   * Includes 2FA enforcement and session timeout settings.
   */
  async getSecurityConfig(tenantId: string) {
    const tenant = await this.findOne(tenantId);
    const config = tenant.config as Record<string, any> | null;
    const security = config?.security || {};

    return {
      require2FA: security.require2FA ?? false,
      sessionTimeout: security.sessionTimeout ?? '15m',
      refreshTokenLifetime: security.refreshTokenLifetime ?? '7d',
    };
  }

  /**
   * Update security configuration for a tenant.
   */
  async updateSecurityConfig(tenantId: string, securityConfig: Record<string, any>) {
    const tenant = await this.findOne(tenantId);
    const config = (tenant.config as Record<string, any>) || {};
    const existingSecurity = config.security || {};

    const updatedSecurity = {
      require2FA: securityConfig.require2FA ?? existingSecurity.require2FA ?? false,
      sessionTimeout: securityConfig.sessionTimeout ?? existingSecurity.sessionTimeout ?? '15m',
      refreshTokenLifetime: securityConfig.refreshTokenLifetime ?? existingSecurity.refreshTokenLifetime ?? '7d',
    };

    const updatedConfig = {
      ...config,
      security: updatedSecurity,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: updatedConfig },
    });

    return this.getSecurityConfig(tenantId);
  }

  /**
   * Get electricity configuration (cost per kWh, currency).
   */
  async getElectricityConfig(tenantId: string) {
    const tenant = await this.findOne(tenantId);
    const config = tenant.config as Record<string, any> | null;
    const electricity = config?.electricity || {};
    return {
      costPerKwh: Number(electricity.costPerKwh) || 0.20,
      currency: electricity.currency || 'EUR',
    };
  }

  /**
   * Update electricity configuration.
   */
  async updateElectricityConfig(tenantId: string, body: { costPerKwh?: number; currency?: string }) {
    const tenant = await this.findOne(tenantId);
    const config = (tenant.config as Record<string, any>) || {};
    const existing = config.electricity || {};

    const updated = {
      costPerKwh: body.costPerKwh !== undefined ? Number(body.costPerKwh) : existing.costPerKwh ?? 0.20,
      currency: body.currency ?? existing.currency ?? 'EUR',
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: { ...config, electricity: updated } },
    });

    return this.getElectricityConfig(tenantId);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010)
  // ============================================================================

  /**
   * Get the tenant-level appearance defaults.
   * When `Tenant.primaryColor` is set but `config.appearance.primaryColor` is not,
   * we fall back to the tenant branding color for backward compatibility.
   */
  async getAppearanceConfig(tenantId: string): Promise<ResolvedAppearance> {
    const tenant = await this.findOne(tenantId);
    const config = tenant.config as Record<string, any> | null;
    const appearance = (config?.appearance || {}) as Partial<ResolvedAppearance>;

    return {
      theme: appearance.theme ?? DEFAULT_TENANT_APPEARANCE.theme,
      primaryColor:
        appearance.primaryColor ?? tenant.primaryColor ?? DEFAULT_TENANT_APPEARANCE.primaryColor,
      density: appearance.density ?? DEFAULT_TENANT_APPEARANCE.density,
      allowUserOverride:
        appearance.allowUserOverride ?? DEFAULT_TENANT_APPEARANCE.allowUserOverride,
    };
  }

  /**
   * Update the tenant-level appearance defaults (super admin only — enforced at controller).
   * Logs a tenant-scoped audit entry because this impacts all users who inherit the config.
   */
  async updateAppearanceConfig(
    tenantId: string,
    userId: string | undefined,
    dto: UpdateTenantAppearanceDto,
  ): Promise<ResolvedAppearance> {
    const tenant = await this.findOne(tenantId);
    const config = (tenant.config as Record<string, any>) || {};
    const before = await this.getAppearanceConfig(tenantId);

    const updated: ResolvedAppearance = {
      theme: dto.theme ?? before.theme,
      primaryColor: dto.primaryColor ?? before.primaryColor,
      density: dto.density ?? before.density,
      allowUserOverride: dto.allowUserOverride ?? before.allowUserOverride,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: { ...config, appearance: updated } as any },
    });

    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityType: 'tenant',
      entityId: tenantId,
      changes: { before: { appearance: before }, after: { appearance: updated } },
    });

    return updated;
  }
}
