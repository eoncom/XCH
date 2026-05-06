import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * VendorCatalog entry returned by `GET /asset-models/catalogs`.
 * Cas A — direct Prisma scalars (the raw `content` JSON is intentionally
 * NOT exposed in the list view ; the `/catalogs/:id/download` endpoint
 * streams it as binary).
 */
export class AssetModelCatalogResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  vendor!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  version?: string | null;

  @ApiProperty({ type: [String] })
  @Expose()
  sources!: string[];

  @ApiProperty({ description: 'Number of items in the catalog' })
  @Expose()
  itemCount!: number;

  @ApiProperty({ description: 'True iff bundled with the app build' })
  @Expose()
  builtIn!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  importedAt!: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  importedBy?: string | null;
}
