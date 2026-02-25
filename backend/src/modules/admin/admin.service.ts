import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';

// Default labels for all enum types — MUST match Prisma schema enums exactly
const DEFAULT_LABELS: Record<string, Record<string, { label: string; color: string; icon?: string }>> = {
  AssetType: {
    PRINTER:      { label: 'Imprimante',          color: '#a855f7' },
    IPAD:         { label: 'iPad',                 color: '#0ea5e9' },
    TABLET:       { label: 'Tablette',             color: '#06b6d4' },
    SWITCH:       { label: 'Switch',               color: '#3b82f6' },
    FIREWALL:     { label: 'Pare-feu',             color: '#ef4444' },
    ROUTER:       { label: 'Routeur',              color: '#6366f1' },
    WIFI_AP:      { label: 'Point d\'accès WiFi',  color: '#10b981' },
    ACCESS_POINT: { label: 'Point d\'accès',       color: '#22c55e' },
    TEAMS_ROOM:   { label: 'Teams Room',           color: '#7c3aed' },
    WEBCAM:       { label: 'Webcam',               color: '#14b8a6' },
    DISPLAY:      { label: 'Écran',                color: '#6b7280' },
    CAMERA:       { label: 'Caméra',               color: '#64748b' },
    SERVER:       { label: 'Serveur',              color: '#8b5cf6' },
    CABLE:        { label: 'Câble',                color: '#f59e0b' },
    PATCH_PANEL:  { label: 'Panneau de brassage',  color: '#06b6d4' },
    PDU:          { label: 'PDU',                  color: '#f97316' },
    BOX_5G:       { label: 'Box 5G',               color: '#84cc16' },
    OTHER:        { label: 'Autre',                color: '#9ca3af' },
  },
  AssetStatus: {
    IN_SERVICE:     { label: 'En service',   color: '#22c55e' },
    OUT_OF_SERVICE: { label: 'Hors service', color: '#ef4444' },
    IN_TRANSIT:     { label: 'En transit',   color: '#3b82f6' },
    STOCK:          { label: 'En stock',     color: '#f59e0b' },
    RETIRED:        { label: 'Retiré',       color: '#9ca3af' },
  },
  PinType: {
    SWITCH:       { label: 'Switch',               color: '#3b82f6' },
    FIREWALL:     { label: 'Pare-feu',             color: '#ef4444' },
    ACCESS_POINT: { label: 'AP WiFi',              color: '#10b981' },
    PRINTER:      { label: 'Imprimante',           color: '#a855f7' },
    RACK:         { label: 'Baie',                 color: '#6366f1' },
    CAMERA:       { label: 'Caméra',               color: '#64748b' },
    PATCH_PANEL:  { label: 'Panneau de brassage',  color: '#06b6d4' },
    RJ45:         { label: 'Prise RJ45',           color: '#0ea5e9' },
    NRO:          { label: 'Arrivée Fibre NRO',    color: '#dc2626' },
    ROUTER:       { label: 'Routeur',              color: '#7c3aed' },
    TEAMS_ROOM:   { label: 'Teams Room',           color: '#7c3aed' },
    WEBCAM:       { label: 'Webcam',               color: '#14b8a6' },
    DISPLAY:      { label: 'Écran',                color: '#6b7280' },
    SERVER:       { label: 'Serveur',              color: '#8b5cf6' },
    PDU:          { label: 'PDU',                  color: '#f97316' },
    BOX_5G:       { label: 'Box 5G',               color: '#84cc16' },
    OTHER:        { label: 'Autre',                color: '#9ca3af' },
  },
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all enum labels for a tenant + enum type.
   * Returns custom labels merged with defaults.
   */
  async getEnumLabels(tenantId: string, enumType?: string) {
    // Get custom labels from DB
    const where: any = { tenantId };
    if (enumType) where.enumType = enumType;

    const customLabels = await this.prisma.enumLabel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { enumValue: 'asc' }],
    });

    // Build result: merge defaults with custom
    const result: Record<string, any[]> = {};
    const types = enumType ? [enumType] : Object.keys(DEFAULT_LABELS);

    for (const type of types) {
      const defaults = DEFAULT_LABELS[type] || {};
      const customs = customLabels.filter((c) => c.enumType === type);
      const customMap = new Map(customs.map((c) => [c.enumValue, c]));

      result[type] = Object.entries(defaults).map(([value, def], idx) => {
        const custom = customMap.get(value);
        return {
          enumType: type,
          enumValue: value,
          label: custom?.label || def.label,
          color: custom?.color || def.color,
          icon: custom?.icon || def.icon || null,
          sortOrder: custom?.sortOrder ?? idx,
          isHidden: custom?.isHidden ?? false,
          isCustom: !!custom,
        };
      });
    }

    return result;
  }

  /**
   * Update or create a custom label for a specific enum value.
   */
  async updateEnumLabel(tenantId: string, dto: UpdateEnumLabelDto) {
    return this.prisma.enumLabel.upsert({
      where: {
        tenantId_enumType_enumValue: {
          tenantId,
          enumType: dto.enumType,
          enumValue: dto.enumValue,
        },
      },
      create: {
        tenantId,
        enumType: dto.enumType,
        enumValue: dto.enumValue,
        label: dto.label,
        icon: dto.icon,
        color: dto.color,
        sortOrder: dto.sortOrder ?? 0,
        isHidden: dto.isHidden ?? false,
      },
      update: {
        label: dto.label,
        icon: dto.icon,
        color: dto.color,
        sortOrder: dto.sortOrder,
        isHidden: dto.isHidden,
      },
    });
  }

  /**
   * Reset all custom labels for a specific enum type (or all).
   */
  async resetEnumLabels(tenantId: string, enumType?: string) {
    const where: any = { tenantId };
    if (enumType) where.enumType = enumType;

    const result = await this.prisma.enumLabel.deleteMany({ where });
    return { deleted: result.count };
  }

  /**
   * Get default labels (no customization).
   */
  getDefaults(enumType?: string) {
    if (enumType) {
      return { [enumType]: DEFAULT_LABELS[enumType] || {} };
    }
    return DEFAULT_LABELS;
  }
}
