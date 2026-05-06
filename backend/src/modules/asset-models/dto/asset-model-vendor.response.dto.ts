import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Single available vendor in `GET /asset-models/import/vendors`.
 */
export class AssetModelVendorResponseDto {
  @ApiProperty({ description: 'Vendor key (e.g. "fortinet")' })
  @Expose()
  key!: string;

  @ApiProperty({ description: 'Display label' })
  @Expose()
  label!: string;

  @ApiPropertyOptional({ type: String })
  @Expose()
  version?: string;

  @ApiPropertyOptional({ description: 'Number of items in the bundled pack' })
  @Expose()
  itemCount?: number;
}

/**
 * Result of a vendor catalog import (`POST /asset-models/import/:vendor`
 * or `POST /asset-models/import/upload`).
 */
export class AssetModelImportResultResponseDto {
  @ApiProperty({ description: 'Models created from this import' })
  @Expose()
  created!: number;

  @ApiProperty({ description: 'Models updated (already existed for this tenant)' })
  @Expose()
  updated!: number;

  @ApiProperty({ description: 'Models skipped' })
  @Expose()
  skipped!: number;

  @ApiPropertyOptional({ type: String })
  @Expose()
  catalogId?: string;

  @ApiPropertyOptional({ type: String })
  @Expose()
  message?: string;
}
