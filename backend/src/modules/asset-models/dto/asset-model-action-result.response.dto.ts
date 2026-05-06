import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action result shapes.
 */

/**
 * Response for `DELETE /asset-models/:id` — service returns `{ deleted: true }`.
 */
export class AssetModelDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  deleted!: boolean;
}

/**
 * Compact catalog reference returned in the delete result.
 */
export class AssetModelCatalogDeleteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  vendor!: string;
}

/**
 * Response for `DELETE /asset-models/catalogs/:id?withModels=true|false`.
 */
export class AssetModelCatalogDeletedResultResponseDto {
  @ApiProperty({ description: 'True iff the catalog row was removed' })
  @Expose()
  deleted!: boolean;

  @ApiProperty({ type: () => AssetModelCatalogDeleteRefResponseDto })
  @Expose()
  catalog!: AssetModelCatalogDeleteRefResponseDto;

  @ApiPropertyOptional({ description: 'AssetModels also dropped (when ?withModels=true)' })
  @Expose()
  deletedModelsCount?: number;
}
