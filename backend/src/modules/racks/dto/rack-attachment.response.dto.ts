import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Rack attachment exposed by upload / list endpoints. The service decorates
 * each row with a computed `url` (StorageService.getFileUrl) so the UI can
 * display / download the file directly. Both the Prisma row and the URL
 * are exposed via `@Expose()`.
 *
 * Cas A — direct mapping (the service constructs the spread literal).
 *
 * Note: the Attachment table is polymorphic (assetId / taskId / rackId /
 * siteId — exactly one set). For the rack endpoints we only expose the
 * fields the rack UI consumes.
 */
export class RackAttachmentResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  rackId!: string | null;

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'spec | invoice | photo | report | manual | other',
  })
  @Expose()
  category?: string | null;

  @ApiProperty({ description: 'User ID of the uploader' })
  @Expose()
  uploadedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  uploadedAt!: Date;

  @ApiProperty({ description: 'Computed URL to fetch / download the file' })
  @Expose()
  url!: string;
}
