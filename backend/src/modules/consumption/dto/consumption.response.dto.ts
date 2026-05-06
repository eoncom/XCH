import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * `byType` Record entry — watts + count for a given asset type.
 * Cas B helper (toConsumptionResultResponseDto) re-shapes the input
 * Record because class-transformer does not roundtrip Record<string,T>.
 */
export class ConsumptionByTypeEntryResponseDto {
  @ApiProperty()
  @Expose()
  watts!: number;

  @ApiProperty()
  @Expose()
  count!: number;
}

/**
 * Compact site reference embedded in ConsumptionSiteResponseDto.
 */
export class ConsumptionSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional()
  @Expose()
  autoGenerateElectricityExpense?: boolean;
}

/**
 * Compact rack reference embedded in ConsumptionRackResponseDto.
 */
export class ConsumptionRackRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;
}

/**
 * Computed consumption shape returned by `GET /consumption/site/:id` and
 * `GET /consumption/rack/:id`. Cas B helper — `byType` is a dynamic-key
 * Record that needs manual mapping (cf README common/dto/response).
 */
export class ConsumptionResultResponseDto {
  @ApiProperty()
  @Expose()
  totalWatts!: number;

  @ApiProperty()
  @Expose()
  kWhMonth!: number;

  @ApiProperty()
  @Expose()
  costMonth!: number;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiProperty()
  @Expose()
  costPerKwh!: number;

  @ApiProperty({ description: 'Total assets linked (any status)' })
  @Expose()
  assetCount!: number;

  @ApiProperty({ description: 'Active-only count (IN_SERVICE + UNDER_MAINTENANCE)' })
  @Expose()
  activeAssetCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ConsumptionByTypeEntryResponseDto' },
    description:
      'Per-asset-type aggregation { type → { watts, count } }. Manual passthrough — class-transformer does not roundtrip Record<string,T>.',
  })
  @Expose()
  byType!: Record<string, ConsumptionByTypeEntryResponseDto>;
}

/**
 * Site-scoped consumption — extends the result with the site reference.
 */
export class ConsumptionSiteResponseDto extends ConsumptionResultResponseDto {
  @ApiProperty({ type: () => ConsumptionSiteRefResponseDto })
  @Expose()
  site!: ConsumptionSiteRefResponseDto;
}

/**
 * Rack-scoped consumption — extends the result with the rack reference.
 */
export class ConsumptionRackResponseDto extends ConsumptionResultResponseDto {
  @ApiProperty({ type: () => ConsumptionRackRefResponseDto })
  @Expose()
  rack!: ConsumptionRackRefResponseDto;
}

/**
 * Per-site row in the tenant-wide `GET /consumption/summary` response.
 */
export class ConsumptionSummaryItemResponseDto {
  @ApiProperty({ type: () => ConsumptionSiteRefResponseDto })
  @Expose()
  site!: ConsumptionSiteRefResponseDto;

  @ApiProperty()
  @Expose()
  totalWatts!: number;

  @ApiProperty()
  @Expose()
  kWhMonth!: number;

  @ApiProperty()
  @Expose()
  costMonth!: number;

  @ApiProperty()
  @Expose()
  assetCount!: number;

  @ApiProperty()
  @Expose()
  activeAssetCount!: number;
}

export class ConsumptionSummaryTotalsResponseDto {
  @ApiProperty()
  @Expose()
  totalWatts!: number;

  @ApiProperty()
  @Expose()
  kWhMonth!: number;

  @ApiProperty()
  @Expose()
  costMonth!: number;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiProperty()
  @Expose()
  costPerKwh!: number;
}

export class ConsumptionSummaryMetaResponseDto {
  @ApiProperty()
  @Expose()
  totalSites!: number;

  @ApiProperty()
  @Expose()
  returned!: number;

  @ApiProperty()
  @Expose()
  limit!: number;

  @ApiProperty()
  @Expose()
  offset!: number;

  @ApiProperty()
  @Expose()
  truncated!: boolean;
}

/**
 * Response for `GET /consumption/summary` and `GET /consumption` (no
 * params). Cas C composite of `totals + sites[] + meta`.
 */
export class ConsumptionSummaryResponseDto {
  @ApiProperty({ type: () => ConsumptionSummaryTotalsResponseDto })
  @Expose()
  totals!: ConsumptionSummaryTotalsResponseDto;

  @ApiProperty({ type: () => [ConsumptionSummaryItemResponseDto] })
  @Expose()
  sites!: ConsumptionSummaryItemResponseDto[];

  @ApiProperty({ type: () => ConsumptionSummaryMetaResponseDto })
  @Expose()
  meta!: ConsumptionSummaryMetaResponseDto;
}

/**
 * Cas B helper — manual roundtrip for the `byType` Record fields. The
 * service returns Decimal-free numbers (Math.round + division) so no
 * Prisma.Decimal handling needed here.
 */
function copyByType(input: unknown): Record<string, ConsumptionByTypeEntryResponseDto> {
  const src = (input as Record<string, { watts: number; count: number }> | undefined) ?? {};
  const out: Record<string, ConsumptionByTypeEntryResponseDto> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { watts: v.watts, count: v.count };
  }
  return out;
}

export function toConsumptionSiteResponseDto(input: any): ConsumptionSiteResponseDto {
  return {
    totalWatts: input.totalWatts,
    kWhMonth: input.kWhMonth,
    costMonth: input.costMonth,
    currency: input.currency,
    costPerKwh: input.costPerKwh,
    assetCount: input.assetCount,
    activeAssetCount: input.activeAssetCount,
    byType: copyByType(input.byType),
    site: {
      id: input.site.id,
      name: input.site.name,
      code: input.site.code,
      autoGenerateElectricityExpense: input.site.autoGenerateElectricityExpense,
    },
  };
}

export function toConsumptionRackResponseDto(input: any): ConsumptionRackResponseDto {
  return {
    totalWatts: input.totalWatts,
    kWhMonth: input.kWhMonth,
    costMonth: input.costMonth,
    currency: input.currency,
    costPerKwh: input.costPerKwh,
    assetCount: input.assetCount,
    activeAssetCount: input.activeAssetCount,
    byType: copyByType(input.byType),
    rack: {
      id: input.rack.id,
      name: input.rack.name,
      siteId: input.rack.siteId,
    },
  };
}

export function toConsumptionSummaryResponseDto(input: any): ConsumptionSummaryResponseDto {
  return {
    totals: {
      totalWatts: input.totals.totalWatts,
      kWhMonth: input.totals.kWhMonth,
      costMonth: input.totals.costMonth,
      currency: input.totals.currency,
      costPerKwh: input.totals.costPerKwh,
    },
    sites: (input.sites ?? []).map((s: any) => ({
      site: { id: s.site.id, name: s.site.name, code: s.site.code },
      totalWatts: s.totalWatts,
      kWhMonth: s.kWhMonth,
      costMonth: s.costMonth,
      assetCount: s.assetCount,
      activeAssetCount: s.activeAssetCount,
    })),
    meta: {
      totalSites: input.meta.totalSites,
      returned: input.meta.returned,
      limit: input.meta.limit,
      offset: input.meta.offset,
      truncated: input.meta.truncated,
    },
  };
}
