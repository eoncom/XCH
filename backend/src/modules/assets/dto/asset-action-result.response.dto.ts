import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action result shapes — multi-class file documented exception.
 */

export class AssetDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

export class AssetAttachmentDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

/**
 * Response for `PATCH /assets/batch` — count of updated assets.
 */
export class AssetBatchUpdateResultResponseDto {
  @ApiProperty()
  @Expose()
  updated!: number;
}
