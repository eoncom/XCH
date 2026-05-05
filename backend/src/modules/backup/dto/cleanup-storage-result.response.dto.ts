import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `POST /backup/cleanup-storage` — orphaned MinIO objects
 * tally after the cleanup pass.
 *
 * Cas B — composite shape with three string arrays (paths) tracked
 * separately for UI display.
 */
export class CleanupStorageResultResponseDto {
  @ApiProperty({
    type: [String],
    description: 'Object keys that were deleted from MinIO',
  })
  @Expose()
  deleted!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Object keys skipped because still referenced or within the grace window',
  })
  @Expose()
  skipped!: string[];

  @ApiProperty({
    type: [String],
    description: 'Object keys for which deletion failed (logged, then continued)',
  })
  @Expose()
  errors!: string[];
}
