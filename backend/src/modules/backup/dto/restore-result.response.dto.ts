import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ResponseMappingCtx } from '../../../common/utils/to-response.util';

/**
 * Response for `POST /backup/full/restore` — counts of restored records by
 * table, plus the site IDs encountered in the archive.
 *
 * Cas B helper — `Record<string, number>` does not roundtrip cleanly under
 * `excludeExtraneousValues: true` (class-transformer drops dynamic keys),
 * so we map manually via `toRestoreFullResultResponseDto` (signature
 * canonique cf `common/dto/response/README.md`).
 */
export class RestoreFullResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;

  @ApiProperty({
    description: 'Records restored, keyed by table name (assets, sites, racks, …)',
    example: { sites: 3, assets: 47, racks: 5 },
  })
  @Expose()
  counts!: Record<string, number>;

  @ApiProperty({ type: [String], description: 'Site IDs touched by the restore' })
  @Expose()
  siteIds!: string[];
}

export function toRestoreFullResultResponseDto(
  input: { message: string; counts: Record<string, number>; siteIds: string[] },
  _ctx?: ResponseMappingCtx,
): RestoreFullResultResponseDto {
  return {
    message: input.message,
    counts: { ...input.counts },
    siteIds: [...input.siteIds],
  };
}

/**
 * Response for `POST /backup/site/restore` — site-scoped restore.
 * Cas B helper — same `Record<string, number>` rationale as above.
 */
export class RestoreSiteResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;

  @ApiProperty({ description: 'ID of the restored site (existing or newly created)' })
  @Expose()
  siteId!: string;

  @ApiProperty({
    description: 'Records restored, keyed by table name',
    example: { assets: 47, racks: 5 },
  })
  @Expose()
  counts!: Record<string, number>;
}

export function toRestoreSiteResultResponseDto(
  input: { message: string; siteId: string; counts: Record<string, number> },
  _ctx?: ResponseMappingCtx,
): RestoreSiteResultResponseDto {
  return {
    message: input.message,
    siteId: input.siteId,
    counts: { ...input.counts },
  };
}
