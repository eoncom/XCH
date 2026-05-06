import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Asset attachment exposed by upload / list endpoints. Service decorates
 * each row with a computed `url` (StorageService.getFileUrl).
 *
 * Cas A — direct mapping; the Attachment table is polymorphic, only the
 * asset-relevant fields are exposed.
 */
export class AssetAttachmentResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  assetId!: string | null;

  @ApiProperty()
  @Expose()
  filename!: string;

  @ApiProperty()
  @Expose()
  originalFilename!: string;

  @ApiProperty()
  @Expose()
  size!: number;

  @ApiProperty()
  @Expose()
  mimetype!: string;

  @ApiProperty({ description: 'MinIO storage path' })
  @Expose()
  path!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  category?: string | null;

  @ApiProperty()
  @Expose()
  uploadedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  uploadedAt!: Date;

  @ApiProperty({ description: 'Computed URL to fetch / download the file' })
  @Expose()
  url!: string;
}
