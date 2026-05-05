import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Single AP pin entry returned by `GET /floor-plans/:id/heatmap-data`.
 * The asset reference is passthrough since it's typed in PR #12 assets.
 */
export class FloorPlanHeatmapAccessPointResponseDto {
  @ApiProperty()
  @Expose()
  pinId!: string;

  @ApiProperty()
  @Expose()
  x!: number;

  @ApiProperty()
  @Expose()
  y!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  label?: string | null;

  @ApiPropertyOptional({ description: 'Linked asset (passthrough)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.asset ?? null, { toClassOnly: true })
  asset?: unknown;
}

/**
 * Composite response for the heatmap visualisation.
 * Cas C composite — scale info + AP pins array.
 */
export class FloorPlanHeatmapDataResponseDto {
  @ApiProperty()
  @Expose()
  floorPlanId!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  scaleMetersPerPixel?: number | null;

  @ApiPropertyOptional({ description: 'Scale calibration ref line (passthrough)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.scaleRefLine ?? null, { toClassOnly: true })
  scaleRefLine?: unknown;

  @ApiProperty({ type: () => [FloorPlanHeatmapAccessPointResponseDto] })
  @Expose()
  accessPoints!: FloorPlanHeatmapAccessPointResponseDto[];
}
