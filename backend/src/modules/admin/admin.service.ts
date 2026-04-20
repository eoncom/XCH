import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UpdateEnumLabelDto } from './dto/update-enum-label.dto';
import { CreateEnumValueDto } from './dto/create-enum-value.dto';
import { PIN_TYPE_DEFAULTS } from '../../common/constants/pin-config';

// Default labels for all enum types — built-in values
// `connectivityCapable` marks AssetType rows that are eligible to terminate a
// ConnectivityLink (router/firewall/5G box/switch). Surfaced on EnumLabel rows
// as `isConnectivityCapable` and overridable per-tenant.
type DefaultLabel = {
  label: string;
  color: string;
  icon?: string;
  connectivityCapable?: boolean;
};

const DEFAULT_LABELS: Record<string, Record<string, DefaultLabel>> = {
  AssetType: {
    PRINTER:      { label: 'Imprimante',          color: '#a855f7' },
    IPAD:         { label: 'iPad',                 color: '#0ea5e9' },
    TABLET:       { label: 'Tablette',             color: '#06b6d4' },
    SWITCH:       { label: 'Switch',               color: '#3b82f6', connectivityCapable: true },
    FIREWALL:     { label: 'Pare-feu',             color: '#ef4444', connectivityCapable: true },
    ROUTER:       { label: 'Routeur',              color: '#6366f1', connectivityCapable: true },
    WIFI_AP:      { label: 'Point d\'accès WiFi',  color: '#10b981' },
    TEAMS_ROOM:   { label: 'Teams Room',           color: '#7c3aed' },
    WEBCAM:       { label: 'Webcam',               color: '#14b8a6' },
    DISPLAY:      { label: 'Écran',                color: '#6b7280' },
    CAMERA:       { label: 'Caméra',               color: '#64748b' },
    SERVER:       { label: 'Serveur',              color: '#8b5cf6' },
    CABLE:        { label: 'Câble',                color: '#f59e0b' },
    PATCH_PANEL:  { label: 'Panneau de brassage',  color: '#06b6d4' },
    PDU:          { label: 'PDU',                  color: '#f97316' },
    BOX_5G:       { label: 'Box 5G',               color: '#84cc16', connectivityCapable: true },
    OTHER:        { label: 'Autre',                color: '#9ca3af' },
  },
  AssetStatus: {
    IN_SERVICE:        { label: 'En service',    color: '#22c55e' },
    UNDER_MAINTENANCE: { label: 'En maintenance', color: '#f59e0b' },
    OUT_OF_SERVICE:    { label: 'Hors service',  color: '#ef4444' },
    IN_TRANSIT:        { label: 'En transit',    color: '#3b82f6' },
    STOCK:             { label: 'En stock',      color: '#a16207' },
    RETIRED:           { label: 'Retiré',        color: '#9ca3af' },
  },
  PinType: PIN_TYPE_DEFAULTS,
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all enum labels for a tenant + enum type.
   * Returns built-in defaults merged with custom DB entries (including user-created values).
   */
  async getEnumLabels(tenantId: string, enumType?: string) {
    const where: any = { tenantId };
    if (enumType) where.enumType = enumType;

    const dbLabels = await this.prisma.enumLabel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { enumValue: 'asc' }],
    });

    const result: Record<string, any[]> = {};
    const types = enumType ? [enumType] : Object.keys(DEFAULT_LABELS);

    for (const type of types) {
      const defaults = DEFAULT_LABELS[type] || {};
      const dbForType = dbLabels.filter((c) => c.enumType === type);
      const dbMap = new Map(dbForType.map((c) => [c.enumValue, c]));

      // Start with built-in values
      const items = Object.entries(defaults).map(([value, def], idx) => {
        const db = dbMap.get(value);
        return {
          id: db?.id || null,
          enumType: type,
          enumValue: value,
          label: db?.label || def.label,
          color: db?.color || def.color,
          icon: db?.icon || def.icon || null,
          sortOrder: db?.sortOrder ?? idx,
          isHidden: db?.isHidden ?? false,
          isBuiltIn: true,
          isActive: db?.isActive ?? true,
          // DB override > built-in default. Only AssetType rows carry this today.
          isConnectivityCapable: db?.isConnectivityCapable ?? def.connectivityCapable ?? false,
        };
      });

      // Add custom (non-built-in) values from DB
      for (const db of dbForType) {
        if (!defaults[db.enumValue]) {
          items.push({
            id: db.id,
            enumType: type,
            enumValue: db.enumValue,
            label: db.label,
            color: db.color || '#9ca3af',
            icon: db.icon,
            sortOrder: db.sortOrder,
            isHidden: db.isHidden,
            isBuiltIn: db.isBuiltIn,
            isActive: db.isActive,
            isConnectivityCapable: db.isConnectivityCapable ?? false,
          });
        }
      }

      // Sort by sortOrder
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      result[type] = items;
    }

    return result;
  }

  /**
   * Update or create a custom label for a specific enum value.
   */
  async updateEnumLabel(tenantId: string, dto: UpdateEnumLabelDto) {
    // Default connectivityCapable: fall back to the built-in default when the row
    // doesn't yet exist in DB, so upserting a non-connectivity field on a
    // built-in connectivity asset type (e.g. ROUTER) doesn't silently drop the
    // flag on the first write.
    const defaultCapable =
      DEFAULT_LABELS[dto.enumType]?.[dto.enumValue]?.connectivityCapable ?? false;

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
        isBuiltIn: false,
        isActive: true,
        isConnectivityCapable: dto.isConnectivityCapable ?? defaultCapable,
      },
      update: {
        label: dto.label,
        icon: dto.icon,
        color: dto.color,
        sortOrder: dto.sortOrder,
        isHidden: dto.isHidden,
        ...(dto.isConnectivityCapable !== undefined
          ? { isConnectivityCapable: dto.isConnectivityCapable }
          : {}),
      },
    });
  }

  /**
   * Create a new custom enum value (user-defined type/status/pin type).
   */
  async createEnumValue(tenantId: string, dto: CreateEnumValueDto) {
    const validTypes = ['AssetType', 'AssetStatus', 'PinType'];
    if (!validTypes.includes(dto.enumType)) {
      throw new BadRequestException(`enumType must be one of: ${validTypes.join(', ')}`);
    }

    // Check if value already exists (built-in or custom)
    const defaults = DEFAULT_LABELS[dto.enumType] || {};
    if (defaults[dto.enumValue]) {
      throw new ConflictException(`"${dto.enumValue}" is a built-in value for ${dto.enumType}`);
    }

    const existing = await this.prisma.enumLabel.findUnique({
      where: {
        tenantId_enumType_enumValue: {
          tenantId,
          enumType: dto.enumType,
          enumValue: dto.enumValue,
        },
      },
    });
    if (existing) {
      throw new ConflictException(`"${dto.enumValue}" already exists for ${dto.enumType}`);
    }

    // Get max sortOrder
    const maxSort = await this.prisma.enumLabel.findFirst({
      where: { tenantId, enumType: dto.enumType },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.enumLabel.create({
      data: {
        tenantId,
        enumType: dto.enumType,
        enumValue: dto.enumValue,
        label: dto.label,
        icon: dto.icon || null,
        color: dto.color || '#9ca3af',
        sortOrder: (maxSort?.sortOrder ?? Object.keys(defaults).length) + 1,
        isHidden: false,
        isBuiltIn: false,
        isActive: true,
      },
    });
  }

  /**
   * Delete a custom enum value (refuses if built-in or currently used).
   */
  async deleteEnumValue(tenantId: string, id: string) {
    const label = await this.prisma.enumLabel.findFirst({
      where: { id, tenantId },
    });
    if (!label) {
      throw new BadRequestException('Enum value not found');
    }

    // Cannot delete built-in values
    if (label.isBuiltIn) {
      throw new ConflictException('Cannot delete a built-in value. You can hide it instead.');
    }

    // Also refuse if it's a default value
    const defaults = DEFAULT_LABELS[label.enumType] || {};
    if (defaults[label.enumValue]) {
      throw new ConflictException('Cannot delete a built-in value. You can hide it instead.');
    }

    // Check usage
    const usageCount = await this.countUsage(tenantId, label.enumType, label.enumValue);
    if (usageCount > 0) {
      throw new ConflictException(
        `Cannot delete "${label.enumValue}": used by ${usageCount} ${label.enumType === 'PinType' ? 'pin(s)' : 'asset(s)'}. Reassign them first.`,
      );
    }

    await this.prisma.enumLabel.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Count how many entities use a specific enum value.
   */
  async countUsage(tenantId: string, enumType: string, enumValue: string): Promise<number> {
    if (enumType === 'AssetType') {
      return this.prisma.asset.count({ where: { tenantId, type: enumValue } });
    }
    if (enumType === 'AssetStatus') {
      return this.prisma.asset.count({ where: { tenantId, status: enumValue } });
    }
    if (enumType === 'PinType') {
      return this.prisma.pin.count({
        where: {
          pinType: enumValue,
          floorPlan: { site: { tenantId } },
        },
      });
    }
    return 0;
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
