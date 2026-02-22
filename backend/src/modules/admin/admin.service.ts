import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';

// Default labels for all enum types
const DEFAULT_LABELS: Record<string, Record<string, { label: string; color: string; icon?: string }>> = {
  AssetType: {
    SWITCH: { label: 'Switch', color: '#3b82f6' },
    ROUTER: { label: 'Routeur', color: '#6366f1' },
    FIREWALL: { label: 'Pare-feu', color: '#ef4444' },
    SERVER: { label: 'Serveur', color: '#8b5cf6' },
    UPS: { label: 'Onduleur', color: '#f59e0b' },
    PDU: { label: 'PDU', color: '#f97316' },
    PATCH_PANEL: { label: 'Panneau de brassage', color: '#06b6d4' },
    ACCESS_POINT: { label: 'Borne WiFi', color: '#10b981' },
    CAMERA: { label: 'Cam\u00e9ra', color: '#64748b' },
    PRINTER: { label: 'Imprimante', color: '#a855f7' },
    PHONE: { label: 'T\u00e9l\u00e9phone', color: '#14b8a6' },
    WORKSTATION: { label: 'Poste de travail', color: '#0ea5e9' },
    MONITOR: { label: '\u00c9cran', color: '#6b7280' },
    CABLE_BOX_5G: { label: 'Box 5G', color: '#84cc16' },
    TEAMS_ROOM: { label: 'Salle Teams', color: '#7c3aed' },
    NAS: { label: 'NAS', color: '#0d9488' },
    OTHER: { label: 'Autre', color: '#9ca3af' },
  },
  AssetStatus: {
    ACTIVE: { label: 'Actif', color: '#22c55e' },
    INACTIVE: { label: 'Inactif', color: '#9ca3af' },
    MAINTENANCE: { label: 'En maintenance', color: '#f59e0b' },
    DECOMMISSIONED: { label: 'D\u00e9commissionn\u00e9', color: '#ef4444' },
    IN_TRANSIT: { label: 'En transit', color: '#3b82f6' },
    SPARE: { label: 'Spare', color: '#8b5cf6' },
    ORDERED: { label: 'Command\u00e9', color: '#06b6d4' },
  },
  PinType: {
    SWITCH: { label: 'Switch', color: '#3b82f6' },
    FIREWALL: { label: 'Pare-feu', color: '#ef4444' },
    ACCESS_POINT: { label: 'Borne WiFi', color: '#10b981' },
    RACK: { label: 'Baie', color: '#6366f1' },
    CAMERA: { label: 'Cam\u00e9ra', color: '#64748b' },
    PATCH_PANEL: { label: 'Panneau brassage', color: '#06b6d4' },
    RJ45: { label: 'Prise RJ45', color: '#0ea5e9' },
    NRO: { label: 'NRO/POP', color: '#dc2626' },
    PRINTER: { label: 'Imprimante', color: '#a855f7' },
    ROUTER: { label: 'Routeur', color: '#7c3aed' },
    SERVER: { label: 'Serveur', color: '#8b5cf6' },
    UPS: { label: 'Onduleur', color: '#f59e0b' },
    PDU: { label: 'PDU', color: '#f97316' },
    CABLE_BOX_5G: { label: 'Box 5G', color: '#84cc16' },
    TEAMS_ROOM: { label: 'Salle Teams', color: '#7c3aed' },
    OTHER: { label: 'Autre', color: '#9ca3af' },
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
