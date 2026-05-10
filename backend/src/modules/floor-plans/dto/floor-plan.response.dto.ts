import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { PinResponseDto } from './pin.response.dto';

// Track C 2026-05-10 — B3 fix: aligned with Prisma FloorPlan schema. Previous
// shape exposed `name`, `floor`, `building`, `parentId`, `width`, `height`,
// `tenantId`, `createdAt`, `updatedAt` — none of which exist on the schema.
// At runtime class-transformer dropped the actual `title`/`site`/`planGroupId`
// values and emitted undefined for the wrong field names, breaking the floor
// plans list page (filter rejected every plan because plan.title was missing).
export class FloorPlanResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty()
  @Expose()
  title!: string;

  @ApiProperty({ description: 'Floor plan version (incremented on new-version)' })
  @Expose()
  version!: number;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Plan group identifier — same value across versions of the same logical plan' })
  @Expose()
  planGroupId?: string | null;

  @ApiProperty()
  @Expose()
  fileUrl!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  fileSize?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  mimeType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  uploadedBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  uploadedAt!: Date;

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

  @ApiPropertyOptional({ description: 'Site reference (passthrough — id, code, name, etc.)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.site ?? null, { toClassOnly: true })
  site?: unknown;

  @ApiPropertyOptional({ type: () => [PinResponseDto] })
  @Expose()
  @Type(() => PinResponseDto)
  pins?: PinResponseDto[];

  // Track C 2026-05-10 — B3 fix: server-side computed count of versions in
  // the same planGroupId, exposed so the list view can display "X versions"
  // badge without having to dedup client-side.
  @ApiPropertyOptional({ type: Number, description: 'Number of versions in this planGroupId (>=1)' })
  @Expose()
  totalVersions?: number;
}
