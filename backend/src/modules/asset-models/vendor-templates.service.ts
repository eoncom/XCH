import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Bundled catalog packs shipped with the application.
 *
 * The code path is vendor-neutral: adding a new bundled pack = drop its JSON in
 * `./templates/<key>.json` + register an entry in `VENDOR_REGISTRY` below with
 * `status: 'available'` and `bundled: true`. The import pipeline
 * (`importBundled` → `importCustomCatalog`) is the same for every vendor.
 *
 * The `fortinet.json` file here is just seed data (catalogue fabricant), not
 * vendor-specific business logic.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BUNDLED_CATALOGS: Record<string, any> = {
  fortinet: require('./templates/fortinet.json'),
};

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
    modelCount:
      (BUNDLED_CATALOGS.fortinet?.fortiap?.length || 0) +
      (BUNDLED_CATALOGS.fortinet?.fortiswitch?.length || 0) +
      (BUNDLED_CATALOGS.fortinet?.fortigate?.length || 0),
    version: BUNDLED_CATALOGS.fortinet?.metadata?.version,
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
   * Generic entry point — resolves the vendor key to its bundled JSON and
   * feeds it through the same neutral import pipeline used for uploaded
   * catalogs. Adding a new bundled vendor requires zero code changes in
   * this method: just register the key in VENDOR_REGISTRY + drop the JSON
   * under ./templates/<key>.json.
   */
  async importVendor(vendorKey: string, tenantId: string) {
    const key = vendorKey.toLowerCase();
    const v = VENDOR_REGISTRY[key];
    if (!v) {
      throw new BadRequestException(
        `Catalogue fabricant "${vendorKey}" inconnu. Fabricants disponibles : ${this.availableVendorKeys().join(', ') || '(aucun)'}.`,
      );
    }
    if (v.status === 'planned') {
      throw new BadRequestException(
        `Le catalogue ${v.label} est prévu mais pas encore disponible. Uploadez son JSON ou créez les modèles manuellement via "Ajouter un modèle".`,
      );
    }
    const bundled = BUNDLED_CATALOGS[key];
    if (!bundled) {
      throw new BadRequestException(
        `Le catalogue "${v.label}" est marqué comme disponible mais son JSON bundled est introuvable (${key}.json).`,
      );
    }
    return this.importCustomCatalog(tenantId, bundled as UploadedCatalog, { builtIn: true });
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
    opts?: { builtIn?: boolean; importedBy?: string | null },
  ): Promise<{
    vendor: string;
    version: string;
    catalogId: string;
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

    const sources =
      (catalog as any)?.metadata?.sources ||
      (Array.isArray((catalog as any)?.sources) ? (catalog as any).sources : []) ||
      [];

    if (!hasFortinetShape && (!Array.isArray(catalog?.items) || catalog.items.length === 0)) {
      throw new BadRequestException(
        'Payload invalide : fournissez soit un catalogue Fortinet-native (fortiap/fortiswitch/fortigate), soit un catalogue générique avec `items: [...]`.',
      );
    }

    // Derive vendor label upfront so the VendorCatalog row is created with the right metadata.
    const vendorLabel = hasFortinetShape
      ? 'Fortinet'
      : catalog.vendor || inferVendor(catalog.items || []);
    const version = (catalog as any)?.metadata?.version || catalog.version || 'unknown';

    // Create (or replace) the VendorCatalog row — preserves the raw JSON for later download.
    // If a row already exists with (tenant, vendor, version) we replace its content.
    const existingCatalog = await this.prisma.vendorCatalog.findFirst({
      where: { tenantId, vendor: vendorLabel, version: version === 'unknown' ? null : version },
    });
    const catalogRow = existingCatalog
      ? await this.prisma.vendorCatalog.update({
          where: { id: existingCatalog.id },
          data: {
            sources,
            content: catalog as any,
            importedBy: opts?.importedBy ?? null,
            builtIn: opts?.builtIn ?? existingCatalog.builtIn,
            importedAt: new Date(),
          },
        })
      : await this.prisma.vendorCatalog.create({
          data: {
            tenantId,
            vendor: vendorLabel,
            version: version === 'unknown' ? null : version,
            sources,
            content: catalog as any,
            builtIn: opts?.builtIn ?? false,
            importedBy: opts?.importedBy ?? null,
          },
        });

    let result: any;
    if (hasFortinetShape) {
      result = await this.importFortinetShapedPayload(tenantId, catalog, catalogRow.id);
    } else {
      result = await this.importGenericItems(
        tenantId,
        catalog.items || [],
        vendorLabel,
        sources,
        catalogRow.id,
      );
    }

    // Update the itemCount on the catalog row (created + updated = models linked now)
    const itemCount = result.created + result.updated;
    await this.prisma.vendorCatalog.update({
      where: { id: catalogRow.id },
      data: { itemCount },
    });

    return {
      vendor: vendorLabel || 'Custom',
      version,
      catalogId: catalogRow.id,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
      sources,
    };
  }

  private async importGenericItems(
    tenantId: string,
    items: AssetModelTemplateItem[],
    vendorLabel: string,
    sources: string[],
    vendorCatalogId: string,
  ) {
    const counters = { created: 0, updated: 0, skipped: 0 };
    const errors: Array<{ model: string; message: string }> = [];

    for (const item of items) {
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
          defaultUHeight:
            num(item.defaultUHeight) !== null ? Math.round(num(item.defaultUHeight)!) : null,
          wifiCoverageRadius: num(item.wifiCoverageRadius),
          wifiFrequency: item.wifiFrequency || null,
          wifiAntennaType: item.wifiAntennaType || null,
          wifiTxPowerDbm:
            num(item.wifiTxPowerDbm) !== null ? Math.round(num(item.wifiTxPowerDbm)!) : null,
          notes: item.notes || genericNotes(vendorLabel, item, sources),
          vendorCatalogId,
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: item?.name || '<sans nom>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }
    this.logger.log(
      `Generic catalog import "${vendorLabel}" for tenant ${tenantId}: created=${counters.created} updated=${counters.updated} skipped=${counters.skipped}`,
    );
    return { ...counters, errors };
  }

  /**
   * Schema adapter for payloads that carry the Fortinet-native layout
   * (`fortiap`/`fortiswitch`/`fortigate` top-level arrays with datasheet-shaped
   * nested objects). This is NOT a vendor special case — the import pipeline
   * stays generic. It's simply the second JSON SHAPE we know how to read
   * (the first being the generic `items[]` shape).
   *
   * Adding support for another fabricant-specific shape in the future would
   * mean adding a sibling `importCiscoShapedPayload`, `importArubaShapedPayload`,
   * etc., called from `importCustomCatalog` after shape detection.
   */
  private async importFortinetShapedPayload(
    tenantId: string,
    cat: any,
    vendorCatalogId: string,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ model: string; message: string }>;
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
          vendorCatalogId,
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
          vendorCatalogId,
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
          vendorCatalogId,
        });
        counters[touched]++;
      } catch (err: any) {
        errors.push({ model: fw?.model || '<fw>', message: err?.message || String(err) });
        counters.skipped++;
      }
    }

    return { ...counters, errors };
  }

  /**
   * Import the bundled Fortinet catalog (ap + switch + firewall).
   * Returns a summary counting newly created models vs. those updated in place.
   */
  // NOTE: a vendor-specific `importFortinet()` method used to live here.
  // It was removed in v1.4.x because the import pipeline is now fully neutral:
  //   - Bundled packs flow through `importVendor(vendorKey)` →
  //     `importCustomCatalog(tenantId, BUNDLED_CATALOGS[vendorKey], { builtIn:true })`.
  //   - Uploaded packs flow through `POST /asset-models/import/upload` →
  //     `importCustomCatalog(tenantId, userJson)`.
  // Both end up as VendorCatalog rows, no vendor name hard-coded in business logic.

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
      vendorCatalogId?: string | null;
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
          vendorCatalogId: data.vendorCatalogId ?? null,
        } as any,
      });
      return 'created';
    }

    // Only overwrite fields when the operator hasn't set a different value manually.
    // For imports we refresh everything so "re-import" is a clean refresh;
    // if the operator customised notes, we preserve them.
    const keepCustomNotes =
      existing.notes && !existing.notes.startsWith('**Fortinet** ·') && !existing.notes.startsWith('**');
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
        // Always re-link the imported model to its (new) origin catalog
        ...(data.vendorCatalogId !== undefined
          ? { vendorCatalogId: data.vendorCatalogId ?? null }
          : {}),
      } as any,
    });
    return 'updated';
  }

  // ============================================================================
  // Pack management (v1.4.x) — upload / list / download / delete / export
  // Catalogs are stored as VendorCatalog rows, content in JSONB. The AssetModel
  // rows created by an import carry vendorCatalogId so deletions can cascade.
  // ============================================================================

  async listCatalogs(tenantId: string) {
    return this.prisma.vendorCatalog.findMany({
      where: { tenantId },
      orderBy: [{ vendor: 'asc' }, { importedAt: 'desc' }],
      select: {
        id: true,
        vendor: true,
        version: true,
        sources: true,
        itemCount: true,
        builtIn: true,
        importedAt: true,
        importedBy: true,
      },
    });
  }

  async getCatalogContent(tenantId: string, catalogId: string) {
    const cat = await this.prisma.vendorCatalog.findFirst({
      where: { id: catalogId, tenantId },
    });
    if (!cat) {
      throw new BadRequestException('Catalogue non trouvé');
    }
    return cat;
  }

  async deleteCatalog(tenantId: string, catalogId: string, deleteModels: boolean) {
    const cat = await this.prisma.vendorCatalog.findFirst({
      where: { id: catalogId, tenantId },
    });
    if (!cat) throw new BadRequestException('Catalogue non trouvé');

    // Optionally drop the models too
    let deletedModelsCount = 0;
    if (deleteModels) {
      const toDelete = await this.prisma.assetModel.findMany({
        where: { tenantId, vendorCatalogId: catalogId },
        include: { _count: { select: { assets: true } } },
      });
      // Never delete a model that still has assets linked — would orphan them
      const safe = toDelete.filter((m) => (m._count?.assets ?? 0) === 0);
      const unsafeCount = toDelete.length - safe.length;
      if (safe.length > 0) {
        const r = await this.prisma.assetModel.deleteMany({
          where: { id: { in: safe.map((m) => m.id) } },
        });
        deletedModelsCount = r.count;
      }
      if (unsafeCount > 0) {
        this.logger.warn(
          `Catalog ${catalogId} delete: ${unsafeCount} linked models kept (they still have assets).`,
        );
      }
    }

    await this.prisma.vendorCatalog.delete({ where: { id: catalogId } });
    return {
      deleted: true,
      catalog: { id: cat.id, vendor: cat.vendor },
      deletedModelsCount,
    };
  }

  /**
   * Export AssetModels matching a filter as a downloadable JSON pack. The shape
   * matches the generic upload format so `export → upload` is a round-trip.
   */
  async exportPack(
    tenantId: string,
    filter: { manufacturer?: string; type?: string; vendorCatalogId?: string },
  ) {
    const where: any = { tenantId };
    if (filter.manufacturer) where.manufacturer = filter.manufacturer;
    if (filter.type) where.type = filter.type;
    if (filter.vendorCatalogId) where.vendorCatalogId = filter.vendorCatalogId;

    const models = await this.prisma.assetModel.findMany({
      where,
      orderBy: [{ manufacturer: 'asc' }, { type: 'asc' }, { name: 'asc' }],
    });

    const vendor =
      filter.manufacturer ||
      inferVendor(models.map((m) => ({ manufacturer: m.manufacturer } as any))) ||
      'Catalogue personnalisé';

    return {
      vendor,
      version: new Date().toISOString().slice(0, 10),
      exportedAt: new Date().toISOString(),
      items: models.map((m) => ({
        name: m.name,
        manufacturer: m.manufacturer,
        type: m.type,
        powerConsumption: m.powerConsumption,
        weight: m.weight,
        defaultUHeight: m.defaultUHeight,
        acquisitionPrice: m.acquisitionPrice ? Number(m.acquisitionPrice) : null,
        monthlyPrice: m.monthlyPrice ? Number(m.monthlyPrice) : null,
        currency: m.currency,
        pricingMode: m.pricingMode,
        wifiCoverageRadius: (m as any).wifiCoverageRadius ?? null,
        wifiFrequency: (m as any).wifiFrequency ?? null,
        wifiAntennaType: (m as any).wifiAntennaType ?? null,
        wifiTxPowerDbm: (m as any).wifiTxPowerDbm ?? null,
        notes: m.notes,
      })),
    };
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
