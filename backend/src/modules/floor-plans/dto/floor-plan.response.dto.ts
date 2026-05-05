import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { PinResponseDto } from './pin.response.dto';

/**
 * FloorPlan entity exposed by all CRUD endpoints.
 * Cas C — Prisma scalars + nested pins[] + scaleRefLine JSON passthrough.
 */
export class FloorPlanResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  floor?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  building?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  fileUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  fileType?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  fileSize?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  width?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  height?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  scaleMetersPerPixel?: number | null;

  @ApiPropertyOptional({
    description: 'Scale calibration reference line JSON (passthrough)',
    nullable: true,
  })
  @Expose()
  @Transform(({ obj }) => obj?.scaleRefLine ?? null, { toClassOnly: true })
  scaleRefLine?: unknown;

  @ApiProperty({ description: 'Floor plan version (incremented on new-version)' })
  @Expose()
  version!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  parentId?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => [PinResponseDto] })
  @Expose()
  @Type(() => PinResponseDto)
  pins?: PinResponseDto[];
}
