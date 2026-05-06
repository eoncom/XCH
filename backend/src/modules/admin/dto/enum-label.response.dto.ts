import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Single enum label item — exposed inside the per-type arrays of the
 * enum-labels Map response.
 */
export class EnumLabelItemResponseDto {
  @ApiProperty({ description: 'Enum value (e.g. "SWITCH" for AssetType)' })
  @Expose()
  value!: string;

  @ApiProperty({ description: 'Display label' })
  @Expose()
  label!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  color?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  icon?: string | null;

  @ApiProperty()
  @Expose()
  sortOrder!: number;

  @ApiProperty()
  @Expose()
  isHidden!: boolean;

  @ApiProperty({ description: 'true = built-in system value, non-deletable' })
  @Expose()
  isBuiltIn!: boolean;

  @ApiProperty({ description: 'false = disabled (not offered in selects)' })
  @Expose()
  isActive!: boolean;

  @ApiProperty({ description: 'true = AssetType row that can terminate a ConnectivityLink (ROUTER, FIREWALL, BOX_5G…)' })
  @Expose()
  isConnectivityCapable!: boolean;

  @ApiProperty({ description: 'true = AssetType row that can be a SD-WAN node (FIREWALL, ROUTER…)' })
  @Expose()
  isSdwanCapable!: boolean;
}

/**
 * Response for `GET /admin/enum-labels` and `GET /admin/enum-labels/defaults`.
 *
 * Cas B — the wire shape is `Record<string, EnumLabelItem[]>` keyed by
 * enum type (`AssetType`, `AssetStatus`, `PinType`). class-transformer
 * does not roundtrip dynamic-key Records under `excludeExtraneousValues`,
 * so a manual helper is used to construct the response. The DTO acts as
 * a marker for `@ApiOkResponse({ type })` discoverability and Swagger
 * documentation.
 */
export class EnumLabelMapResponseDto {
  @ApiProperty({
    description:
      'Keys are enum type identifiers (AssetType / AssetStatus / PinType). Values are arrays of EnumLabelItemResponseDto. Walked manually by `toEnumLabelMapResponseDto` (Cas B) — class-transformer does not roundtrip Record<string,T>.',
    type: 'object',
    additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/EnumLabelItemResponseDto' } },
  })
  @Expose()
  items!: Record<string, EnumLabelItemResponseDto[]>;
}

/**
 * Cas B helper — re-shape the service output (already a Record<string,
 * item[]>) into the DTO carrier. Pure copy: drops nothing, but the
 * carrier shape pins the contract for future readers.
 */
export function toEnumLabelMapResponseDto(
  input: Record<string, EnumLabelItemResponseDto[] | unknown[]>,
): EnumLabelMapResponseDto {
  const items: Record<string, EnumLabelItemResponseDto[]> = {};
  for (const [type, arr] of Object.entries(input)) {
    items[type] = (arr as any[]).map((row) => ({
      value: row.value,
      label: row.label,
      color: row.color ?? null,
      icon: row.icon ?? null,
      sortOrder: row.sortOrder ?? 0,
      isHidden: row.isHidden ?? false,
      isBuiltIn: row.isBuiltIn ?? false,
      isActive: row.isActive ?? true,
      isConnectivityCapable: row.isConnectivityCapable ?? false,
      isSdwanCapable: row.isSdwanCapable ?? false,
    }));
  }
  return { items };
}

/**
 * Cas B helper — variant for `GET /admin/enum-labels/defaults`. The
 * service returns a nested map `Record<enumType, Record<enumValue,
 * DefaultLabel>>` (no DB merge — pure built-in defaults). The wire
 * carrier flattens each per-type sub-map into an EnumLabelItem array
 * so consumers see a uniform shape across the two endpoints.
 *
 * Defaults rows lack the per-row DB metadata (sortOrder / isHidden /
 * isActive / isBuiltIn) — those default to 0 / false / true / true.
 * `isConnectivityCapable` and `isSdwanCapable` come from the static
 * DefaultLabel definition when present.
 */
export function toEnumLabelDefaultsMapResponseDto(
  input: Record<string, Record<string, unknown>>,
): EnumLabelMapResponseDto {
  const items: Record<string, EnumLabelItemResponseDto[]> = {};
  for (const [type, perValue] of Object.entries(input)) {
    items[type] = Object.entries(perValue).map(([value, raw]) => {
      const def = raw as Record<string, unknown>;
      return {
        value,
        label: (def.label as string) ?? value,
        color: (def.color as string | undefined) ?? null,
        icon: (def.icon as string | undefined) ?? null,
        sortOrder: 0,
        isHidden: false,
        isBuiltIn: true,
        isActive: true,
        isConnectivityCapable: (def.connectivityCapable as boolean | undefined) ?? false,
        isSdwanCapable: (def.sdwanCapable as boolean | undefined) ?? false,
      };
    });
  }
  return { items };
}

/**
 * Response for `PUT /admin/enum-labels` and `POST /admin/enum-labels` —
 * single Prisma EnumLabel row (the row that was created/updated).
 */
export class EnumLabelRowResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  enumType!: string;

  @ApiProperty()
  @Expose()
  enumValue!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  icon?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  color?: string | null;

  @ApiProperty()
  @Expose()
  sortOrder!: number;

  @ApiProperty()
  @Expose()
  isHidden!: boolean;

  @ApiProperty()
  @Expose()
  isBuiltIn!: boolean;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiProperty()
  @Expose()
  isConnectivityCapable!: boolean;

  @ApiProperty()
  @Expose()
  isSdwanCapable!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;
}

/**
 * Response for `DELETE /admin/enum-labels/:id` and
 * `POST /admin/enum-labels/reset` — service returns a `{ deleted | reset }`
 * marker (and a `count` for reset). Single multi-class file.
 */
export class EnumLabelDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  deleted!: boolean;
}

export class EnumLabelResetResultResponseDto {
  @ApiProperty()
  @Expose()
  reset!: boolean;

  @ApiProperty()
  @Expose()
  count!: number;
}
