import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for POST /api/asset-models/import/upload.
 *
 * Accepts two shapes (the controller picks at runtime based on which keys are present):
 *
 *   1. Fortinet-native — the same schema as the bundled catalog, with the
 *      top-level arrays `fortiap`, `fortiswitch`, `fortigate` plus an optional
 *      `metadata` block.
 *
 *   2. Generic — a single `items` array of normalised rows:
 *      {
 *        vendor: "Cisco",
 *        version: "1.0",
 *        sources: ["https://..."],
 *        items: [
 *          { name, manufacturer, type, powerConsumption, weight, ... }
 *        ]
 *      }
 *
 * Because of this duality we keep the DTO loose with `@IsOptional()` almost
 * everywhere — the service validates structurally after the shape is decided.
 */
export class UploadCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  // Generic shape
  @ApiPropertyOptional({ description: 'Generic catalog items array' })
  @IsOptional()
  @IsArray()
  items?: any[];

  // Fortinet-native escape hatch — loose typing, service validates
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  fortiap?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  fortiswitch?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  fortigate?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: any;
}
