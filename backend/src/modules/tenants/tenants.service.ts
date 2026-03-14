import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateTenantDto } from './dto/update-tenant.dto';

/** Default module configuration — all modules enabled */
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
  qr_codes: true,
  site_access_control: true,
};

/** Human-readable descriptions for each module */
const MODULE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  sites: { label: 'Sites', description: 'Gestion des sites (adresses, contacts, connectivité)' },
  assets: { label: 'Équipements', description: 'Inventaire des équipements IT (serveurs, switches, etc.)' },
  racks: { label: 'Baies', description: 'Gestion des baies avec montage des équipements' },
  tasks: { label: 'Tâches', description: 'Suivi des tâches et interventions' },
  floor_plans: { label: 'Plans d\'étage', description: 'Plans interactifs avec repères cliquables' },
  contacts: { label: 'Contacts', description: 'Annuaire des contacts par site' },
  documents: { label: 'Documents', description: 'Gestion des documents et pièces jointes' },
  integrations_netbox: { label: 'NetBox', description: 'Synchronisation avec NetBox (DCIM)' },
  monitoring: { label: 'Monitoring', description: 'Intégration monitoring (Uptime Kuma / Gatus) + tableau de bord santé des sites' },
  alerts: { label: 'Alertes', description: 'Notifications et alertes basées sur le monitoring' },
  qr_codes: { label: 'QR Codes', description: 'Génération et scan de QR codes pour les équipements' },
  site_access_control: { label: 'Droits d\'accès site', description: 'Contrôle d\'accès granulaire par site et par utilisateur' },
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaClient) {}

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
}
