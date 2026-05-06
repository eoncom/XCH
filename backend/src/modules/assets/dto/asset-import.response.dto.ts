import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single error row from a CSV preview / import.
 */
export class AssetImportErrorRowResponseDto {
  @ApiProperty({ description: 'CSV row number (1-based, header excluded)' })
  @Expose()
  row!: number;

  @ApiProperty({ description: 'Field that failed validation' })
  @Expose()
  field!: string;

  @ApiProperty({ description: 'Localised error message' })
  @Expose()
  message!: string;

  @ApiPropertyOptional({ description: 'Raw value that failed' })
  @Expose()
  value?: unknown;
}

/**
 * Response for `POST /assets/import` and `POST /assets/import/commit`
 * (CSV bulk insert).
 */
export class AssetImportResultResponseDto {
  @ApiProperty({ description: 'Rows successfully imported' })
  @Expose()
  imported!: number;

  @ApiProperty({ description: 'Rows skipped (duplicates / etc.)' })
  @Expose()
  skipped!: number;

  @ApiProperty({ type: () => [AssetImportErrorRowResponseDto] })
  @Expose()
  @Type(() => AssetImportErrorRowResponseDto)
  errors!: AssetImportErrorRowResponseDto[];

  @ApiPropertyOptional({ type: String })
  @Expose()
  message?: string;
}

/**
 * Response for `POST /assets/import/preview` (dry-run).
 * Same shape as the commit result + `validRows` array of parsed entries.
 */
export class AssetImportPreviewResponseDto {
  @ApiProperty({ description: 'Total rows parsed from the CSV (header excluded)' })
  @Expose()
  total!: number;

  @ApiProperty({ description: 'Rows that would be imported' })
  @Expose()
  valid!: number;

  @ApiProperty({ description: 'Rows that would be skipped due to errors' })
  @Expose()
  invalid!: number;

  @ApiProperty({ type: () => [AssetImportErrorRowResponseDto] })
  @Expose()
  @Type(() => AssetImportErrorRowResponseDto)
  errors!: AssetImportErrorRowResponseDto[];
}

/**
 * Response for `GET /assets/import/template`. Inline CSV template string.
 */
export class AssetImportTemplateResponseDto {
  @ApiProperty()
  @Expose()
  filename!: string;

  @ApiProperty({ description: 'Raw CSV content' })
  @Expose()
  content!: string;
}
