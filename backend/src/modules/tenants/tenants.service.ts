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
  integrations_netbox: true,
  integrations_monitoring: true,
  qr_codes: true,
};

/** Human-readable descriptions for each module */
const MODULE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  sites: { label: 'Sites', description: 'Gestion des sites (adresses, contacts, connectivité)' },
  assets: { label: 'Équipements', description: 'Inventaire des équipements IT (serveurs, switches, etc.)' },
  racks: { label: 'Baies', description: 'Gestion des baies avec montage des équipements' },
  tasks: { label: 'Tâches', description: 'Suivi des tâches et interventions' },
  floor_plans: { label: 'Plans d\'étage', description: 'Plans interactifs avec repères cliquables' },
  contacts: { label: 'Contacts', description: 'Annuaire des contacts par site' },
  integrations_netbox: { label: 'NetBox', description: 'Synchronisation avec NetBox (DCIM)' },
  integrations_monitoring: { label: 'Monitoring', description: 'Intégration Uptime Kuma / monitoring' },
  qr_codes: { label: 'QR Codes', description: 'Génération et scan de QR codes pour les équipements' },
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

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    await this.findOne(id);

    return this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });
  }

  async getConfig(id: string) {
    const tenant = await this.findOne(id);
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
}
