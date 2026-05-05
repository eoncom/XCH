import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Site attachment exposed by upload / list endpoints. Service decorates
 * each row with a computed `url` (StorageService.getFileUrl).
 *
 * Cas A — direct mapping; the Attachment table is polymorphic (assetId /
 * taskId / rackId / siteId — exactly one set), only the site-relevant
 * fields are exposed.
 */
export class SiteAttachmentResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty()
  @Expose()
  filename!: string;

  @ApiProperty()
  @Expose()
  originalFilename!: string;

  @ApiProperty({ description: 'File size in bytes' })
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
