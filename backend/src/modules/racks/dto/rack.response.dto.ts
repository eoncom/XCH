import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { RackStatus, RackType } from '@prisma/client';

/**
 * Compact site reference embedded in Rack responses.
 */
export class RackSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}

/**
 * Compact asset reference embedded in Rack responses (mounted equipment).
 * findAll uses the verbose select; findOne uses the position-focused select.
 * The DTO covers both via `@ApiPropertyOptional`.
 */
export class RackMountedAssetResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional({ type: String })
  @Expose()
  name?: string;

  @ApiProperty({ description: 'Asset type label' })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  manufacturer?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  model?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  serialNumber?: string | null;

  @ApiProperty({ description: 'Dynamic asset status label (EnumLabel)' })
  @Expose()
  status!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  rackPositionU!: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  rackHeightU!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  rackNotes?: string | null;
}

/**
 * Computed occupation summary returned by findOne / findAll.
 */
export class RackOccupationResponseDto {
  @ApiProperty()
  @Expose()
  totalU!: number;

  @ApiProperty()
  @Expose()
  usedU!: number;

  @ApiProperty()
  @Expose()
  freeU!: number;

  @ApiProperty({ description: 'Occupation percentage rounded to nearest integer' })
  @Expose()
  percent!: number;
}

/**
 * Optional counters returned by findAll only (mirrors Prisma `_count`).
 */
export class RackCountResponseDto {
  @ApiProperty()
  @Expose()
  assets!: number;
}

/**
 * Rack entity exposed by findOne / findAll / create / update / mount/unmount.
 *
 * Cas C — Prisma entity with includes (site + assets) plus computed
 * `occupation` and optional `_count`. Maps via `plainToInstance` + `@Type()`.
 */
export class RackResponseDto {
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

  @ApiProperty({ nullable: true })
  @Expose()
  serialNumber!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  model!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  manufacturer!: string | null;

  @ApiProperty({ description: 'Total height in U (4, 6, 12, 18, 24, 42)' })
  @Expose()
  heightU!: number;

  @ApiProperty({ enum: RackType })
  @Expose()
  rackType!: RackType;

  @ApiProperty({ enum: RackStatus })
  @Expose()
  status!: RackStatus;

  @ApiProperty({ nullable: true })
  @Expose()
  location!: string | null;

  @ApiPropertyOptional({
    description: 'Free-form specs JSON {dimensions, depth, maxLoad, cooling, security, power}',
    nullable: true,
  })
  @Expose()
  // Prisma `Json` fields don't roundtrip cleanly under `excludeExtraneousValues`
  // (cf README — `Record<string, T>` piège). `obj` access bypasses the
  // class-instantiation pipeline and reads the source value directly.
  @Transform(({ obj }) => obj?.specs ?? null, { toClassOnly: true })
  specs?: unknown;

  @ApiProperty({ nullable: true })
  @Expose()
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => RackSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => RackSiteRefResponseDto)
  site?: RackSiteRefResponseDto | null;

  @ApiPropertyOptional({
    type: () => [RackMountedAssetResponseDto],
    description: 'Mounted equipment (present in findOne / findAll)',
  })
  @Expose()
  @Type(() => RackMountedAssetResponseDto)
  assets?: RackMountedAssetResponseDto[];

  @ApiPropertyOptional({ type: () => RackOccupationResponseDto })
  @Expose()
  @Type(() => RackOccupationResponseDto)
  occupation?: RackOccupationResponseDto;

  @ApiPropertyOptional({
    type: () => RackCountResponseDto,
    description: 'Counts (present in findAll only)',
  })
  @Expose({ name: '_count' })
  @Type(() => RackCountResponseDto)
  _count?: RackCountResponseDto;
}
