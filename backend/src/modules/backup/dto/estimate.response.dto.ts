import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `POST /backup/estimate` — pre-flight sizing for a backup run.
 *
 * Cas A — `BackupService.estimateBackupSize` produces this shape directly,
 * mapped via `toResponse(EstimateResponseDto, ...)`. Anti-leak guaranteed
 * by `@Expose()` whitelist + `excludeExtraneousValues: true` (ADR-023).
 *
 * Frontend usage : pre-launch dialog computes if a backup is feasible
 * (`ok === true`) given the available `freeBytes` on the worker tmpfs.
 */
export class EstimateResponseDto {
  @ApiProperty({
    description:
      'Bytes that the DB JSON payload will consume in the archive ' +
      '(uncompressed). Approximation from sampling × ratio.',
  })
  @Expose()
  dataBytes!: number;

  @ApiProperty({
    description:
      'Bytes that the MinIO files will consume in the archive ' +
      '(uncompressed). Sum of `obj.size` from listObjectsV2 walk.',
  })
  @Expose()
  filesBytes!: number;

  @ApiProperty({
    description: 'Total = dataBytes + filesBytes. Uncompressed.',
  })
  @Expose()
  totalBytes!: number;

  @ApiProperty({
    description: 'Number of MinIO objects that would be included.',
  })
  @Expose()
  fileCount!: number;

  @ApiProperty({
    description:
      'Free bytes available on the worker tmpfs (os.tmpdir()), at the ' +
      'moment of the estimate call. Updated by fs.statfs.',
  })
  @Expose()
  freeBytes!: number;

  @ApiProperty({
    description:
      'True iff freeBytes ≥ totalBytes × 1.2 + 512 MB safety margin. ' +
      'When false, the backup will be rejected with HTTP 507 at runtime.',
  })
  @Expose()
  ok!: boolean;
}
