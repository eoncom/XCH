import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Aggregated document entry returned by `GET /sites/:id/documents`.
 *
 * Documents come from sites + assets + racks + tasks attached to the site.
 * The shape includes attachment scalars + computed url + entity context
 * (entityType, entityName, entityId) so the UI can render a unified list.
 *
 * Cas C — service composes the shape; passthrough on `entityContext`
 * because it varies by source entity type.
 */
export class SiteDocumentResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

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

  @ApiProperty()
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

  @ApiProperty({ enum: ['site', 'asset', 'rack', 'task'] })
  @Expose()
  @Transform(({ obj }) => obj?.entityType, { toClassOnly: true })
  entityType!: 'site' | 'asset' | 'rack' | 'task';

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj?.entityId, { toClassOnly: true })
  entityId!: string;

  @ApiPropertyOptional({ type: String })
  @Expose()
  @Transform(({ obj }) => obj?.entityName, { toClassOnly: true })
  entityName?: string;
}
