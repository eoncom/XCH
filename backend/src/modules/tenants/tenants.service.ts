import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import {
  DEFAULT_TENANT_APPEARANCE,
  ResolvedAppearance,
  UpdateTenantAppearanceDto,
} from './dto/appearance.dto';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CryptoService } from '../../common/crypto/crypto.service';

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
  monitoring: { label: 'Monitoring', description: 'Probes natives ICMP/HTTP/TCP + tableau de bord santé des sites' },
  alerts: { label: 'Alertes', description: 'Agrégation des alertes (tâches, santé sites, monitoring, garanties, équipements HS)' },
  costs: { label: 'Coûts', description: 'Gestion des dépenses, centres de coûts, budgets et projections mensuelles' },
  consumption: { label: 'Consommation', description: 'Estimation de la consommation électrique et du coût mensuel par site' },
  qr_codes: { label: 'QR Codes', description: 'Génération et scan de QR codes pour les équipements' },
  site_access_control: { label: "Droits d'accès sites", description: "Surcharges d'accès (AccessOverride) ALLOW/DENY par site et par ressource" },
  notifications: { label: 'Notifications', description: 'Alertes email / MS Teams sur événements (tâches assignées, santé sites, garanties, etc.)' },
};

const DEFAULT_ROLE_MAPPING = {
  admin: 'MANAGE',
  manager: 'WRITE',
  technician: 'READ',
  default: 'READ',
};

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaClient,
    private auditLogService: AuditLogService,
    private crypto: CryptoService,
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
   * Returns tenant + a config-shaped object for the frontend, without sensitive
   * integration / SSO secrets. Use this for all API responses exposed to the
   * frontend; internal services that need credentials should use the typed
   * accessors (getSsoConfig with masked output, or query the relations directly).
   */
  async findOneSafe(id: string) {
    const tenant = await this.findOne(id);
    const config = await this.assembleSafeConfigShape(id);
    return { ...tenant, config };
  }

  async update(id: string, updateTenantDto: UpdateTenantDto) {
    await this.findOne(id);

    const { config, ...tenantFields } = updateTenantDto;

    // ADR-018 — `config` is a backwards-compat envelope. Route the known
    // sub-keys (`theme` → TenantBranding.theme, `securityReminders` →
    // TenantSecurityReminder upsert/delete) to their typed tables; ignore
    // unknown keys.
    if (config?.theme !== undefined) {
      await this.prisma.tenantBranding.upsert({
        where: { tenantId: id },
        create: { tenantId: id, theme: config.theme || null },
        update: { theme: config.theme || null },
      });
    }
    if (Array.isArray(config?.securityReminders)) {
      // Compat pré-ADR-018 : l'ancien format frontend est `{ id, text }` —
      // mappé vers title/body. Un item sans contenu exploitable est ignoré :
      // un `title` undefined faisait échouer TOUT le PATCH en
      // PrismaClientValidationError → 400 "Invalid data provided" (le rename
      // d'organisation embarquant les reminders dans le même payload).
      const normalizedReminders = config.securityReminders
        .map((r) => {
          const maybeText = (r as unknown as { text?: unknown })?.text;
          const legacyText = typeof maybeText === 'string' ? maybeText.trim() : '';
          const title =
            typeof r?.title === 'string' && r.title.trim() ? r.title.trim() : legacyText;
          const body = typeof r?.body === 'string' && r.body.trim() ? r.body.trim() : title;
          return { ...r, title, body };
        })
        .filter((r) => r.title.length > 0);

      // Replace the global (siteId IS NULL) reminders atomically. Per-site
      // reminders are managed via a dedicated endpoint (out of scope here).
      await this.prisma.$transaction([
        this.prisma.tenantSecurityReminder.deleteMany({
          where: { tenantId: id, siteId: null },
        }),
        ...normalizedReminders.map((r, idx) =>
          this.prisma.tenantSecurityReminder.create({
            data: {
              tenantId: id,
              title: r.title,
              body: r.body,
              severity: (r.severity as any) ?? 'INFO',
              category: r.category ?? null,
              enabled: r.enabled ?? true,
              order: idx,
            },
          }),
        ),
      ]);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: tenantFields,
    });
  }

  /**
   * Backwards-compat shape returned by GET /api/tenants/:id/config — the
   * frontend still expects a single nested object. We assemble it from the
   * typed tables, masking secrets.
   */
  async getConfig(id: string) {
    const tenant = await this.findOne(id);
    return {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: tenant.primaryColor,
      config: await this.assembleSafeConfigShape(id),
    };
  }

  private async assembleSafeConfigShape(tenantId: string) {
    const [appearance, branding, electricity, sso, security, integration, flags, reminders] =
      await Promise.all([
        this.prisma.tenantAppearance.findUnique({ where: { tenantId } }),
        this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
        this.prisma.tenantElectricityConfig.findUnique({ where: { tenantId } }),
        this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } }),
        this.prisma.tenantSecurityConfig.findUnique({ where: { tenantId } }),
        this.prisma.tenantIntegrationConfig.findUnique({ where: { tenantId } }),
        this.prisma.tenantFeatureFlag.findMany({ where: { tenantId } }),
        this.prisma.tenantSecurityReminder.findMany({
          where: { tenantId },
          orderBy: [{ siteId: 'asc' }, { order: 'asc' }],
        }),
      ]);

    const modules: Record<string, boolean> = {};
    for (const f of flags) modules[f.name] = f.enabled;

    return {
      appearance: appearance ?? null,
      branding: branding
        ? { ...branding, securityReminders: reminders.filter((r) => r.siteId === null) }
        : { securityReminders: reminders.filter((r) => r.siteId === null) },
      electricity: electricity ?? null,
      // SSO with masked secret
      sso: sso
        ? {
            enabled: sso.enabled,
            provider: sso.provider,
            issuerUrl: sso.issuerUrl,
            clientId: sso.clientId,
            clientSecretSet: !!sso.clientSecret,
            callbackUrl: sso.callbackUrl,
            scopes: sso.scopes,
            groupClaim: sso.groupClaim,
            roleMapping: sso.roleMapping ?? DEFAULT_ROLE_MAPPING,
          }
        : null,
      security: security ?? null,
      // Integrations: only expose presence of token, never the value.
      integrations: integration
        ? { netbox: { url: integration.netboxUrl ?? '', tokenSet: !!integration.netboxToken } }
        : { netbox: { url: '', tokenSet: false } },
      modules,
    };
  }

  // ============================================================================
  // MODULE MANAGEMENT
  // ============================================================================

  /**
   * Get the list of all modules with their enabled/disabled status for a tenant.
   * Modules absent from `tenant_feature_flags` fall back to DEFAULT_MODULES.
   */
  async getModules(tenantId: string) {
    await this.findOne(tenantId); // ensure exists / 404
    const flags = await this.prisma.tenantFeatureFlag.findMany({ where: { tenantId } });
    const saved: Record<string, boolean> = {};
    for (const f of flags) saved[f.name] = f.enabled;

    const modules = Object.entries(DEFAULT_MODULES).map(([key, defaultEnabled]) => ({
      key,
      label: MODULE_DESCRIPTIONS[key]?.label || key,
      description: MODULE_DESCRIPTIONS[key]?.description || '',
      enabled: saved[key] !== undefined ? saved[key] : defaultEnabled,
    }));

    return { modules };
  }

  /**
   * Update module enabled/disabled states for a tenant. Upserts one row per
   * known module key — unknown keys are ignored (defense in depth).
   */
  async updateModules(tenantId: string, modules: Record<string, boolean>) {
    await this.findOne(tenantId);

    await this.prisma.$transaction(
      Object.entries(modules)
        .filter(([key]) => key in DEFAULT_MODULES)
        .map(([name, enabled]) =>
          this.prisma.tenantFeatureFlag.upsert({
            where: { tenantId_name: { tenantId, name } },
            create: { tenantId, name, enabled },
            update: { enabled },
          }),
        ),
    );

    return this.getModules(tenantId);
  }

  // ============================================================================
  // SSO CONFIGURATION
  // ============================================================================

  /**
   * Get SSO configuration for a tenant. Returns a hint of the secret (last 4
   * chars) so the UI can show "****abcd" rather than reveal the value.
   */
  async getSsoConfig(tenantId: string) {
    await this.findOne(tenantId);
    const sso = await this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } });

    // ADR-019 — clientSecret is encrypted-at-rest. Decrypt before deriving
    // the UI hint (last 4 chars of plaintext, not of ciphertext).
    const plainSecret = this.crypto.decryptOrLegacy(sso?.clientSecret);

    return {
      enabled: sso?.enabled ?? false,
      provider: sso?.provider ?? 'oidc',
      issuer: sso?.issuerUrl ?? '',
      clientId: sso?.clientId ?? '',
      clientSecretSet: !!plainSecret,
      clientSecretHint: plainSecret ? `****${plainSecret.slice(-4)}` : '',
      callbackUrl: sso?.callbackUrl ?? '',
      roleMapping: (sso?.roleMapping as Record<string, string> | null) ?? DEFAULT_ROLE_MAPPING,
    };
  }

  /**
   * Update SSO configuration for a tenant. If clientSecret is empty/undefined,
   * keeps the existing one.
   */
  async updateSsoConfig(tenantId: string, ssoConfig: Record<string, any>) {
    await this.findOne(tenantId);
    const existing = await this.prisma.tenantSsoConfig.findUnique({ where: { tenantId } });

    // ADR-019 — encrypt-at-rest. The user-provided value (if any) is
    // plaintext and gets enveloped; the existing value already is in v1:…
    // form so encryptIfPlain is a no-op.
    const newSecretPlain =
      ssoConfig.clientSecret && ssoConfig.clientSecret !== ''
        ? ssoConfig.clientSecret
        : null;
    const persistedSecret = newSecretPlain
      ? this.crypto.encryptIfPlain(newSecretPlain)
      : existing?.clientSecret ?? '';

    const data = {
      provider: ssoConfig.provider ?? existing?.provider ?? 'oidc',
      clientId: ssoConfig.clientId ?? existing?.clientId ?? '',
      clientSecret: persistedSecret ?? '',
      issuerUrl: ssoConfig.issuer ?? existing?.issuerUrl ?? null,
      callbackUrl: ssoConfig.callbackUrl ?? existing?.callbackUrl ?? null,
      scopes: ssoConfig.scopes ?? existing?.scopes ?? null,
      groupClaim: ssoConfig.groupClaim ?? existing?.groupClaim ?? null,
      roleMapping:
        ssoConfig.roleMapping ?? (existing?.roleMapping as any) ?? DEFAULT_ROLE_MAPPING,
      enabled: ssoConfig.enabled ?? existing?.enabled ?? false,
    };

    await this.prisma.tenantSsoConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    return this.getSsoConfig(tenantId);
  }

  // ============================================================================
  // SECURITY CONFIGURATION
  // ============================================================================

  async getSecurityConfig(tenantId: string) {
    await this.findOne(tenantId);
    const cfg = await this.prisma.tenantSecurityConfig.findUnique({ where: { tenantId } });
    return {
      require2FA: cfg?.require2FA ?? false,
      sessionTimeout: cfg?.sessionTimeout ?? '15m',
      refreshTokenLifetime: cfg?.refreshTokenLifetime ?? '7d',
    };
  }

  async updateSecurityConfig(tenantId: string, body: Record<string, any>) {
    await this.findOne(tenantId);
    const existing = await this.prisma.tenantSecurityConfig.findUnique({ where: { tenantId } });

    const data = {
      require2FA: body.require2FA ?? existing?.require2FA ?? false,
      sessionTimeout: body.sessionTimeout ?? existing?.sessionTimeout ?? '15m',
      refreshTokenLifetime: body.refreshTokenLifetime ?? existing?.refreshTokenLifetime ?? '7d',
    };

    await this.prisma.tenantSecurityConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    return this.getSecurityConfig(tenantId);
  }

  // ============================================================================
  // ELECTRICITY
  // ============================================================================

  async getElectricityConfig(tenantId: string) {
    await this.findOne(tenantId);
    const cfg = await this.prisma.tenantElectricityConfig.findUnique({ where: { tenantId } });
    return {
      costPerKwh: cfg ? Number(cfg.costPerKwh) : 0.20,
      currency: cfg?.currency ?? 'EUR',
    };
  }

  async updateElectricityConfig(tenantId: string, body: { costPerKwh?: number; currency?: string }) {
    await this.findOne(tenantId);
    const existing = await this.prisma.tenantElectricityConfig.findUnique({ where: { tenantId } });

    const data = {
      costPerKwh:
        body.costPerKwh !== undefined ? Number(body.costPerKwh) : Number(existing?.costPerKwh ?? 0.20),
      currency: body.currency ?? existing?.currency ?? 'EUR',
    };

    await this.prisma.tenantElectricityConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    return this.getElectricityConfig(tenantId);
  }

  // ============================================================================
  // APPEARANCE (v1.4 — ADR-010, typed in S6 — ADR-018)
  // ============================================================================

  async getAppearanceConfig(tenantId: string): Promise<ResolvedAppearance> {
    const tenant = await this.findOne(tenantId);
    const cfg = await this.prisma.tenantAppearance.findUnique({ where: { tenantId } });

    // The table stores theme/density as plain `String` (not PG enum), so we
    // narrow them to the expected literal union for the response shape.
    return {
      theme: ((cfg?.theme as ResolvedAppearance['theme']) ?? DEFAULT_TENANT_APPEARANCE.theme),
      primaryColor:
        cfg?.primaryColor ?? tenant.primaryColor ?? DEFAULT_TENANT_APPEARANCE.primaryColor,
      density:
        ((cfg?.density as ResolvedAppearance['density']) ?? DEFAULT_TENANT_APPEARANCE.density),
      allowUserOverride: cfg?.allowUserOverride ?? DEFAULT_TENANT_APPEARANCE.allowUserOverride,
    };
  }

  async updateAppearanceConfig(
    tenantId: string,
    userId: string | undefined,
    dto: UpdateTenantAppearanceDto,
  ): Promise<ResolvedAppearance> {
    await this.findOne(tenantId);
    const before = await this.getAppearanceConfig(tenantId);

    const updated: ResolvedAppearance = {
      theme: dto.theme ?? before.theme,
      primaryColor: dto.primaryColor ?? before.primaryColor,
      density: dto.density ?? before.density,
      allowUserOverride: dto.allowUserOverride ?? before.allowUserOverride,
    };

    await this.prisma.tenantAppearance.upsert({
      where: { tenantId },
      create: { tenantId, ...updated },
      update: updated,
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
