import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ResponseMappingCtx } from '../../../common/utils/to-response.util';

/**
 * Response for `POST /backup/full/restore` when `dryRun: true`.
 *
 * The pipeline runs end-to-end (download archive + extract + checksum
 * verify + parse data files) but skips Prisma writes and MinIO uploads.
 * The report tells the operator EXACTLY what the real run would do, so
 * the UI can prompt for confirmation.
 *
 * Cas B helper — `Record<string, number>` cannot roundtrip cleanly under
 * `excludeExtraneousValues: true` (class-transformer drops dynamic keys),
 * so we map manually via `toDryRunReportResponseDto`. Same rationale as
 * `toRestoreFullResultResponseDto`.
 */
export class DryRunReportResponseDto {
  @ApiProperty({
    description:
      'Rows that would be created, keyed by table name. New rows have no ' +
      'matching natural key in the live tenant.',
    example: { sites: 2, assets: 47, expenses: 18 },
  })
  @Expose()
  wouldCreate!: Record<string, number>;

  @ApiProperty({
    description:
      'Rows that would be updated, keyed by table name. Matches found via ' +
      'natural key (Site.code, Asset.serialNumber, Attachment.path, etc.).',
    example: { sites: 1, assets: 3 },
  })
  @Expose()
  wouldUpdate!: Record<string, number>;

  @ApiProperty({
    description:
      'Rows that would be skipped (already identical), keyed by table name. ' +
      'Photo + Expense use content-hash dedup, so re-import is a no-op.',
    example: { photos: 12, expenses: 6 },
  })
  @Expose()
  wouldSkip!: Record<string, number>;

  @ApiProperty({
    type: [String],
    description:
      'Object paths listed in metadata.files but missing from the archive ' +
      '(integrity violation). Real run would abort unless force flag is set.',
  })
  @Expose()
  missingFiles!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Object paths whose SHA-256 disagrees with metadata.files[path].sha256 ' +
      '(integrity violation). Real run would abort.',
  })
  @Expose()
  invalidChecksums!: string[];

  @ApiProperty({
    description:
      'Cumulative size of files extracted from the archive (uncompressed bytes).',
  })
  @Expose()
  totalSize!: number;

  @ApiProperty({
    description:
      'Rough projected duration of the real run in seconds, based on a ' +
      '50 MB/s throughput model. Indicative — not a hard SLA.',
  })
  @Expose()
  estimatedDurationSec!: number;
}

export function toDryRunReportResponseDto(
  input: {
    wouldCreate: Record<string, number>;
    wouldUpdate: Record<string, number>;
    wouldSkip: Record<string, number>;
    missingFiles: string[];
    invalidChecksums: string[];
    totalSize: number;
    estimatedDurationSec: number;
  },
  _ctx?: ResponseMappingCtx,
): DryRunReportResponseDto {
  return {
    wouldCreate: { ...input.wouldCreate },
    wouldUpdate: { ...input.wouldUpdate },
    wouldSkip: { ...input.wouldSkip },
    missingFiles: [...input.missingFiles],
    invalidChecksums: [...input.invalidChecksums],
    totalSize: input.totalSize,
    estimatedDurationSec: input.estimatedDurationSec,
  };
}
