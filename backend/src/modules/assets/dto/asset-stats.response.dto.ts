import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Per-type asset count map (`GET /assets/stats/by-type`).
 *
 * `Record<string, number>` — passthrough since type labels are dynamic
 * (EnumLabel). Cas B helper (cf README — Record rule).
 */
export class AssetStatsByTypeResponseDto {
  @ApiProperty({
    description: 'Per-type count (router / switch / firewall / …) — passthrough',
    example: { router: 12, switch: 8, firewall: 3 },
  })
  @Expose()
  @Transform(({ obj }) => obj ?? {}, { toClassOnly: true })
  // Index signature handled by passthrough — Swagger marker.
  readonly _markerByType?: Record<string, number>;
}

/**
 * Per-site asset count entry returned by `GET /assets/stats/by-site`.
 */
export class AssetStatsBySiteEntryResponseDto {
  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty()
  @Expose()
  siteName!: string;

  @ApiProperty()
  @Expose()
  siteCode!: string;

  @ApiProperty()
  @Expose()
  count!: number;
}

/**
 * Response for `GET /assets/stats/by-site`. Direct array of entries.
 * Cas A — array of typed sub-DTOs, mapped via toResponseArray.
 */
export class AssetStatsBySiteResponseDto {
  @ApiProperty({ type: () => [AssetStatsBySiteEntryResponseDto] })
  @Expose()
  data!: AssetStatsBySiteEntryResponseDto[];
}
