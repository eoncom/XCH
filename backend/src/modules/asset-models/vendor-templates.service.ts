import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fortinetCatalog: any = require('./templates/fortinet.json');

export interface VendorCatalogDescriptor {
  key: string; // stable identifier for the URL, lowercase ascii: "fortinet", "cisco", …
  label: string; // human-readable, shown in the import menu
  manufacturer: string; // value stored on AssetModel.manufacturer
  status: 'available' | 'planned';
  description: string;
  modelCount: number; // 0 when status=planned
  version?: string;
}

/**
 * Normalised single-model payload for the upload import (generic schema).
 * One row in the uploaded catalog equals one AssetModel.
 */
export interface AssetModelTemplateItem {
  name: string;
  manufacturer?: string;
  type: string; // AssetType enum value (WIFI_AP, SWITCH, FIREWALL, PRINTER, …)
  powerConsumption?: number | null;
  weight?: number | null;
  defaultUHeight?: number | null;
  acquisitionPrice?: number | null;
  monthlyPrice?: number | null;
  currency?: string | null;
  pricingMode?: string | null;
  wifiCoverageRadius?: number | null;
  wifiFrequency?: string | null;
  wifiAntennaType?: string | null;
  wifiTxPowerDbm?: number | null;
  notes?: string | null;
}

/**
 * Shape accepted by the upload endpoint. Either:
 *   - Fortinet-native (`fortiap`, `fortiswitch`, `fortigate`), auto-detected, OR
 *   - Generic: `{ vendor, items: AssetModelTemplateItem[] }`.
 */
export interface UploadedCatalog {
  vendor?: string;
  version?: string;
  sources?: string[];
  items?: AssetModelTemplateItem[];
  // Fortinet-native escape hatch
  fortiap?: any[];
  fortiswitch?: any[];
  fortigate?: any[];
  metadata?: any;
}

/**
 * Central registry of bundled vendor catalogs. New vendors (Cisco, Aruba,
 * Meraki, HP, Yealink, Starlink, …) are added by dropping their JSON in
 * `./templates/` and registering here. The `planned` entries surface in
 * the UI so operators see what's coming.
 */
const VENDOR_REGISTRY: Record<string, VendorCatalogDescriptor> = {
  fortinet: {
    key: 'fortinet',
    label: 'Fortinet',
    manufacturer: 'Fortinet',
    status: 'available',
    description: 'FortiAP (WiFi 6/6E/7) · FortiSwitch · FortiGate',
    modelCount: (fortinetCatalog?.fortiap?.length || 0)
      + (fortinetCatalog?.fortiswitch?.length || 0)
      + (fortinetCatalog?.fortigate?.length || 0),
    version: fortinetCatalog?.metadata?.version,
  },
  cisco: {
    key: 'cisco',
    label: 'Cisco',
    manufacturer: 'Cisco',
    status: 'planned',
    description: 'Catalyst · Meraki MR/MS/MX · WebEx (prévu)',
    modelCount: 0,
  },
  aruba: {
    key: 'aruba',
    label: 'HPE Aruba',
    manufacturer: 'Aruba',
    status: 'planned',
    description: 'Instant On · CX Switches · Access Points (prévu)',
    modelCount: 0,
  },
  hp: {
    key: 'hp',
    label: 'HP',
    manufacturer: 'HP',
    status: 'planned',
    description: 'LaserJet · DesignJet · Workstations (prévu)',
    modelCount: 0,
  },
  canon: {
    key: 'canon',
    label: 'Canon',
    manufacturer: 'Canon',
    status: 'planned',
    description: 'imageRUNNER · imagePRESS (prévu)',
    modelCount: 0,
  },
  yealink: {
    key: 'yealink',
    label: 'Yealink',
    manufacturer: 'Yealink',
    status: 'planned',
    description: 'MeetingBoard · MeetingBar · T-series phones (prévu)',
    modelCount: 0,
  },
  starlink: {
    key: 'starlink',
    label: 'Starlink',
    manufacturer: 'Starlink',
    status: 'planned',
    description: 'Terminaux Mini / Standard / Flat High Performance (prévu)',
    modelCount: 0,
  },
};

/**
 * VendorTemplateService — import vendor catalogs (Fortinet, Cisco, …) into
 * the `AssetModel` catalog so operators don't retype dozens of specs by hand.
 *
 * Each imported model is a regular `AssetModel` row: editable, deletable,
 * linkable from assets like any other. The `notes` field embeds the source
 * URL for traceability (user can click through to the official datasheet).
 *
 * Idempotent: re-running the import upserts by (tenantId, name) — custom
 * tweaks on existing rows are preserved unless a field value actually changes.
 */
@Injectable()
export class VendorTemplatesService {
  private readonly logger = new Logger(VendorTemplatesService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List all known vendor catalogs. Used by the Settings UI to build the
   * "Importer un catalogue fabricant" dropdown.
   */
  listVendors(): VendorCatalogDescriptor[] {
    return Object.values(VENDOR_REGISTRY);
  }

  /**
   * Generic entry point — resolves the vendor key to the appropriate
   * import routine. Throws 400 when the vendor is unknown or not yet shipped.
   */
  async importVendor(vendorKey: string, tenantId: string) {
    const v = VENDOR_REGISTRY[vendorKey.toLowerCase()];
    if (!v) {
      throw new BadRequestException(
        `Catalogue fabricant "${vendorKey}" inconnu. Fabricants disponibles : ${this.availableVendorKeys().join(', ')}.`,
      );
    }
    if (v.status === 'planned') {
      throw new BadRequestException(
        `Le catalogue ${v.label} est prévu mais pas encore disponible. Utilisez l'ajout manuel via "Ajouter un modèle".`,
      );
    }
    switch (v.key) {
      case 'fortinet':
        return this.importFortinet(tenantId);
      default:
        throw new BadRequestException(`Pas d'import implémenté pour "${vendorKey}".`);
    }
  }

  private availableVendorKeys(): string[] {
    return Object.values(VENDOR_REGISTRY)
      .filter((v) => v.status === 'available')
      .map((v) => v.key);
  }

  /**
   * Import an operator-uploaded catalog JSON. The payload is either:
   *   - A Fortinet-native bundle (has `fortiap`/`fortiswitch`/`fortigate` arrays) —
   *     reuses the existing Fortinet mapping so a freshly-crawled Fortinet dump
   *     can be re-imported without code changes.
   *   - A generic bundle `{ vendor?, items: AssetModelTemplateItem[] }` — each
   *     item becomes one AssetModel; `manufacturer` is derived from the payload
   *     or per-item.
   *
   * The endpoint is super-admin only (enforced by the controller). Here we
   * focus on validation + mapping. Throws 400 for malformed payloads.
   */
  async importCustomCatalog(
    tenantId: string,
    catalog: UploadedCatalog,
  ): Promise<{
    vendor: string;
    version: string;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ model: string; message: string }>;
    sources: string[];
  }> {
    // Shape-detect — Fortinet-native wins if present
    const hasFortinetShape =
      Array.isArray(catalog?.fortiap) ||
      Array.isArray(catalog?.fortiswitch) ||
      Array.isArray(catalog?.fortigate);

    if (hasFortinetShape) {
      // Reuse the bundled Fortinet routine but with the uploaded payload.
      // We monkey-assign temporarily — clean but isolated to this call.
      return this.importFortinetLike(tenantId, catalog);
    }

    if (!Array.isArray(catalog?.items) || catalog.items.length === 0) {
      throw new BadRequestException(
        'Payload invalide : fournissez soit un catalogue Fortinet-native (fortiap/fortiswitch/fortigate), soit un catalogue générique avec `items: [...]`.',
      );
    }

    const counters = { created: 0, updated: 0, skipped: 0 };
    const errors: Array<{ model: string; message: string }> = [];
    const vendorLabel = catalog.vendor || inferVendor(catalog.items);

    for (const item of catalog.items) {
      try {
        if (!item?.name || typeof item.name !== 'string') {
          throw new Error('champ `name` manquant ou invalide');
        }
        if (!item?.type || typeof item.type !== 'string') {
          throw new Error('champ `type` manquant ou invalide');
        }
        const touched = await this.upsertAssetModel(tenantId, {
          name: item.name,
          manufacturer: item.manufacturer || vendorLabel || 'Inconnu',
          type: item.type,
          powerConsumption: num(item.powerConsumption),
          weight: num(item.weight),
          defaultUHeight: num(item.defaultUHeight) !== null
            ? Math.round(num(item.defaultUHeight)!)
            : null,
          wifiCoverageRadius: num(item.wifiCoverageRadius),
          wifiFrequency: item.wifiFrequency || null,
          wifiAntennaType: item.wifiAntennaType || null,
          wifiTxPowerDbm: num(item.wifiTxPowerDbm) !== null
            ? Math.round(num(item.wifiTxPowerDbm)!)
            : null,
          notes: item.notes || genericNotes(vendorLabel, item, catalog.sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: item?.name || '<sans nom>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    this.logger.log(
      `Custom catalog import "${vendorLabel}" for tenant ${tenantId}: created=${counters.created} updated=${counters.updated} skipped=${counters.skipped} errors=${errors.length}`,
    );

    return {
      vendor: vendorLabel || 'Custom',
      version: catalog.version || 'unknown',
      ...counters,
      errors,
      sources: catalog.sources || [],
    };
  }

  /**
   * Shared routine for Fortinet-shape payloads (bundled OR uploaded).
   * Keeping it private so `importFortinet()` (the no-arg bundled variant) and
   * `importCustomCatalog()` (the upload) both flow through one code path.
   */
  private async importFortinetLike(
    tenantId: string,
    cat: any,
  ): Promise<{
    vendor: string;
    version: string;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ model: string; message: string }>;
    sources: string[];
  }> {
    const counters = { created: 0, updated: 0, skipped: 0 };
    const errors: Array<{ model: string; message: string }> = [];
    const sources = cat?.metadata?.sources || cat?.sources || [];

    for (const ap of cat.fortiap || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: ap.model,
          manufacturer: 'Fortinet',
          type: 'WIFI_AP',
          powerConsumption: num(ap?.power?.consumption_max_w),
          weight: num(ap?.physical?.weight_kg),
          wifiCoverageRadius:
            num(ap?.wifi?.coverage_radius_m?.chantier_estime) ??
            num(ap?.wifi?.coverage_radius_m?.indoor_standard),
          wifiFrequency: mapFrequency(ap?.wifi?.frequency_bands_ghz),
          wifiAntennaType: mapAntenna(ap?.wifi?.antenna?.type),
          wifiTxPowerDbm: pickMaxTxPower(ap?.wifi?.tx_power_dbm_max),
          notes: fortiapNotes(ap, sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: ap?.model || '<ap>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }
    for (const sw of cat.fortiswitch || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: sw.model,
          manufacturer: 'Fortinet',
          type: 'SWITCH',
          powerConsumption:
            num(sw?.power?.consumption_max_w) ?? num(sw?.power?.consumption_avg_w),
          weight: num(sw?.physical?.weight_kg),
          defaultUHeight: detectUHeight(sw?.physical?.form_factor),
          notes: fortiswitchNotes(sw, sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: sw?.model || '<sw>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }
    for (const fw of cat.fortigate || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: fw.model,
          manufacturer: 'Fortinet',
          type: 'FIREWALL',
          powerConsumption:
            num(fw?.power?.consumption_max_w) ?? num(fw?.power?.consumption_avg_w),
          weight: num(fw?.physical?.weight_kg),
          defaultUHeight: detectUHeight(fw?.physical?.form_factor),
          notes: fortigateNotes(fw, sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: fw?.model || '<fw>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    return {
      vendor: 'Fortinet',
      version: cat?.metadata?.version || cat?.version || 'unknown',
      ...counters,
      errors,
      sources,
    };
  }

  /**
   * Import the bundled Fortinet catalog (ap + switch + firewall).
   * Returns a summary counting newly created models vs. those updated in place.
   */
  async importFortinet(tenantId: string): Promise<{
    vendor: string;
    version: string;
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ model: string; message: string }>;
    sources: string[];
  }> {
    const cat = fortinetCatalog as any;
    const counters = { created: 0, updated: 0, skipped: 0 };
    const errors: Array<{ model: string; message: string }> = [];

    // --- FortiAP (WIFI_AP) ---
    for (const ap of cat.fortiap || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: ap.model,
          manufacturer: 'Fortinet',
          type: 'WIFI_AP',
          powerConsumption: num(ap?.power?.consumption_max_w),
          weight: num(ap?.physical?.weight_kg),
          wifiCoverageRadius:
            num(ap?.wifi?.coverage_radius_m?.chantier_estime) ??
            num(ap?.wifi?.coverage_radius_m?.indoor_standard),
          wifiFrequency: mapFrequency(ap?.wifi?.frequency_bands_ghz),
          wifiAntennaType: mapAntenna(ap?.wifi?.antenna?.type),
          wifiTxPowerDbm: pickMaxTxPower(ap?.wifi?.tx_power_dbm_max),
          notes: fortiapNotes(ap, cat?.metadata?.sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: ap.model, message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    // --- FortiSwitch (SWITCH) ---
    for (const sw of cat.fortiswitch || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: sw.model,
          manufacturer: 'Fortinet',
          type: 'SWITCH',
          powerConsumption: num(sw?.power?.consumption_max_w) ?? num(sw?.power?.consumption_avg_w),
          weight: num(sw?.physical?.weight_kg),
          defaultUHeight: detectUHeight(sw?.physical?.form_factor),
          notes: fortiswitchNotes(sw, cat?.metadata?.sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: sw.model, message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    // --- FortiGate (FIREWALL — FWF-* with integrated Wi-Fi stays FIREWALL too) ---
    for (const fw of cat.fortigate || []) {
      try {
        const touched = await this.upsertAssetModel(tenantId, {
          name: fw.model,
          manufacturer: 'Fortinet',
          type: 'FIREWALL',
          powerConsumption: num(fw?.power?.consumption_max_w) ?? num(fw?.power?.consumption_avg_w),
          weight: num(fw?.physical?.weight_kg),
          defaultUHeight: detectUHeight(fw?.physical?.form_factor),
          notes: fortigateNotes(fw, cat?.metadata?.sources),
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: fw.model, message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    this.logger.log(
      `Fortinet import for tenant ${tenantId}: created=${counters.created} updated=${counters.updated} skipped=${counters.skipped} errors=${errors.length}`,
    );

    return {
      vendor: 'Fortinet',
      version: cat?.metadata?.version || 'unknown',
      ...counters,
      errors,
      sources: cat?.metadata?.sources || [],
    };
  }

  /**
   * Upsert a row by (tenantId, name). Returns 'created' or 'updated' so the
   * caller can build a summary. Throws on validation errors caught by the caller.
   */
  private async upsertAssetModel(
    tenantId: string,
    data: {
      name: string;
      manufacturer: string;
      type: string;
      powerConsumption?: number | null;
      weight?: number | null;
      defaultUHeight?: number | null;
      wifiCoverageRadius?: number | null;
      wifiFrequency?: string | null;
      wifiAntennaType?: string | null;
      wifiTxPowerDbm?: number | null;
      notes?: string | null;
    },
  ): Promise<'created' | 'updated'> {
    const existing = await this.prisma.assetModel.findUnique({
      where: { tenantId_name: { tenantId, name: data.name } },
    });

    if (!existing) {
      await this.prisma.assetModel.create({
        data: {
          tenantId,
          name: data.name,
          manufacturer: data.manufacturer,
          type: data.type,
          powerConsumption: data.powerConsumption ?? null,
          weight: data.weight ?? null,
          defaultUHeight: data.defaultUHeight ?? null,
          wifiCoverageRadius: data.wifiCoverageRadius ?? null,
          wifiFrequency: data.wifiFrequency ?? null,
          wifiAntennaType: data.wifiAntennaType ?? null,
          wifiTxPowerDbm: data.wifiTxPowerDbm ?? null,
          notes: data.notes ?? null,
        },
      });
      return 'created';
    }

    // Only overwrite fields when the operator hasn't set a different value manually.
    // For imports we refresh everything so "re-import" is a clean refresh;
    // if the operator customised notes, we preserve them.
    const keepCustomNotes =
      existing.notes && !existing.notes.startsWith('**Fortinet** ·');
    await this.prisma.assetModel.update({
      where: { id: existing.id },
      data: {
        manufacturer: data.manufacturer,
        type: data.type,
        powerConsumption: data.powerConsumption ?? existing.powerConsumption,
        weight: data.weight ?? existing.weight,
        defaultUHeight: data.defaultUHeight ?? existing.defaultUHeight,
        wifiCoverageRadius: data.wifiCoverageRadius ?? (existing as any).wifiCoverageRadius,
        wifiFrequency: data.wifiFrequency ?? (existing as any).wifiFrequency,
        wifiAntennaType: data.wifiAntennaType ?? (existing as any).wifiAntennaType,
        wifiTxPowerDbm: data.wifiTxPowerDbm ?? (existing as any).wifiTxPowerDbm,
        notes: keepCustomNotes ? existing.notes : data.notes ?? existing.notes,
      },
    });
    return 'updated';
  }
}

// ============================================================================
// Helpers — keep at module bottom, pure functions, no Prisma deps
// ============================================================================

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Convert Fortinet's frequency_bands_ghz array into our AppearanceDto enum.
 * [2.4]      → "2.4GHz"
 * [5]        → "5GHz"
 * [6]        → "6GHz"
 * [2.4, 5]   → "DUAL"
 * [2.4, 5, 6]→ "TRI"
 */
function mapFrequency(bands: any): string | null {
  if (!Array.isArray(bands)) return null;
  const has24 = bands.includes(2.4);
  const has5 = bands.includes(5);
  const has6 = bands.includes(6);
  if (has24 && has5 && has6) return 'TRI';
  if (has24 && has5) return 'DUAL';
  if (has6) return '6GHz';
  if (has5) return '5GHz';
  if (has24) return '2.4GHz';
  return null;
}

function mapAntenna(type: any): string | null {
  if (typeof type !== 'string') return null;
  const t = type.toLowerCase();
  if (t.includes('omni') || t.includes('pifa') || t.includes('interne')) return 'OMNI';
  if (t.includes('direct')) return 'DIRECTIONAL';
  if (t.includes('sect')) return 'SECTOR';
  return 'OMNI'; // sane default for integrated indoor APs
}

function pickMaxTxPower(tx: any): number | null {
  if (tx === null || tx === undefined) return null;
  if (typeof tx === 'number') return tx;
  const candidates = [tx['2.4ghz'], tx['5ghz'], tx['6ghz']]
    .map(num)
    .filter((v): v is number => v !== null);
  return candidates.length ? Math.max(...candidates) : null;
}

/**
 * Parse Fortinet's form_factor string ("1RU Rack", "Desktop", "Desktop/1RU"...) to U count.
 * Null for desktop / wallmount / unspecified.
 */
function detectUHeight(formFactor: any): number | null {
  if (typeof formFactor !== 'string') return null;
  const m = /(\d+)\s*RU/i.exec(formFactor);
  if (m) return parseInt(m[1], 10);
  return null;
}

function fortiapNotes(ap: any, sources?: string[]): string {
  const lines: string[] = [];
  lines.push(`**Fortinet** · ${ap.model} (${ap.family})`);
  if (ap.wifi?.generation) lines.push(`- ${ap.wifi.generation} · ${ap.wifi.standard || ''}`.trim());
  if (ap.wifi?.mimo) lines.push(`- MIMO: ${ap.wifi.mimo}`);
  if (ap.wifi?.max_data_rate_gbps != null) {
    lines.push(`- Débit max: ${ap.wifi.max_data_rate_gbps} Gbps`);
  }
  if (ap.power?.poe_required) lines.push(`- PoE requis: ${ap.power.poe_required}`);
  if (ap.power?.compatibility_warning) {
    lines.push(`- ⚠ ${ap.power.compatibility_warning}`);
  }
  if (ap.interfaces?.ethernet) lines.push(`- Ethernet: ${ap.interfaces.ethernet}`);
  if (ap.wifi?.coverage_radius_m?.chantier_estime != null) {
    lines.push(
      `- Rayon chantier estimé: ${ap.wifi.coverage_radius_m.chantier_estime} m ` +
        `(indoor standard ${ap.wifi.coverage_radius_m.indoor_standard} m). ` +
        `Valeur estimée, non officielle Fortinet.`,
    );
  }
  const src = (sources || []).find((s: string) => /fortiap/i.test(s));
  if (src) lines.push(`- Source: ${src}`);
  return lines.join('\n');
}

function fortiswitchNotes(sw: any, sources?: string[]): string {
  const lines: string[] = [];
  lines.push(`**Fortinet** · ${sw.model} (${sw.family} · ${sw.category})`);
  if (sw.ports?.access) {
    lines.push(`- Ports access: ${sw.ports.access.count}× ${sw.ports.access.type || ''}`);
  }
  if (sw.ports?.uplink) {
    lines.push(`- Uplink: ${sw.ports.uplink.count}× ${sw.ports.uplink.type || ''}`);
  }
  if (sw.poe?.type && sw.poe?.budget_w) {
    lines.push(`- PoE: ${sw.poe.type} — budget ${sw.poe.budget_w} W sur ${sw.poe.ports} ports`);
  } else {
    lines.push(`- Sans PoE`);
  }
  if (sw.performance?.switching_capacity_gbps != null) {
    lines.push(
      `- Capacité: ${sw.performance.switching_capacity_gbps} Gbps · ${sw.performance.packets_per_second_mpps} Mpps`,
    );
  }
  if (sw.power?.noise_dba != null) {
    lines.push(`- Bruit: ${sw.power.noise_dba} dBA` + (sw.power.silent ? ' (silencieux)' : ''));
  }
  if (sw.power?.redundant_psu) lines.push(`- Alim redondante: ${sw.power.redundant_psu}`);
  if (sw.note) lines.push(`- ℹ ${sw.note}`);
  const src = (sources || []).find((s: string) => /fortiswitch/i.test(s));
  if (src) lines.push(`- Source: ${src}`);
  return lines.join('\n');
}

/**
 * Infer a vendor label from a generic payload by majority vote of items[].manufacturer.
 * Fallback to "Catalogue personnalisé" when no manufacturer can be derived.
 */
function inferVendor(items: AssetModelTemplateItem[]): string {
  const counts = new Map<string, number>();
  for (const it of items) {
    const m = (it?.manufacturer || '').trim();
    if (m) counts.set(m, (counts.get(m) || 0) + 1);
  }
  if (counts.size === 0) return 'Catalogue personnalisé';
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Build a default notes block for generic-catalog items that didn't include their own.
 */
function genericNotes(
  vendor: string,
  item: AssetModelTemplateItem,
  sources?: string[],
): string {
  const lines: string[] = [];
  lines.push(`**${vendor || item.manufacturer || 'Catalogue'}** · ${item.name}`);
  if (item.type) lines.push(`- Type: ${item.type}`);
  if (item.weight != null) lines.push(`- Poids: ${item.weight} kg`);
  if (item.powerConsumption != null) lines.push(`- Consommation: ${item.powerConsumption} W`);
  if (item.wifiCoverageRadius != null) {
    lines.push(`- Couverture WiFi (rayon): ${item.wifiCoverageRadius} m`);
  }
  if (item.wifiFrequency) lines.push(`- Bandes: ${item.wifiFrequency}`);
  if (sources?.length) {
    const src = sources[0];
    lines.push(`- Source: ${src}`);
  }
  return lines.join('\n');
}

function fortigateNotes(fw: any, sources?: string[]): string {
  const lines: string[] = [];
  lines.push(`**Fortinet** · ${fw.model} (${fw.family} · ${fw.generation})`);
  if (fw.ports?.summary) lines.push(`- Ports: ${fw.ports.summary}`);
  if (fw.storage) lines.push(`- Stockage: ${fw.storage}`);
  if (fw.performance?.ips_throughput_gbps != null) {
    lines.push(
      `- Throughput: IPS ${fw.performance.ips_throughput_gbps} Gbps · ` +
        `NGFW ${fw.performance.ngfw_throughput_gbps} Gbps · ` +
        `IPsec ${fw.performance.ipsec_vpn_throughput_gbps} Gbps`,
    );
  }
  if (fw.performance?.concurrent_sessions_tcp != null) {
    lines.push(`- Sessions TCP simultanées: ${fw.performance.concurrent_sessions_tcp.toLocaleString('fr-FR')}`);
  }
  if (fw.performance?.max_fortiaps != null) {
    lines.push(
      `- Contrôle APs/Switches max: ${fw.performance.max_fortiaps} / ${fw.performance.max_fortiswitches}`,
    );
  }
  if (fw.poe_budget_w) lines.push(`- PoE budget: ${fw.poe_budget_w} W`);
  if (fw.wifi_integrated?.enabled) {
    lines.push(
      `- WiFi intégré: ${fw.wifi_integrated.standard} · ${fw.wifi_integrated.mimo}`,
    );
  }
  if (fw.power?.noise) lines.push(`- Bruit: ${fw.power.noise}`);
  const src = (sources || []).find((s: string) => /fortigate/i.test(s));
  if (src) lines.push(`- Source: ${src}`);
  return lines.join('\n');
}
