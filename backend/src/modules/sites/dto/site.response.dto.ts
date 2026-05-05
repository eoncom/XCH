import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { HealthStatus, SiteStatus } from '@prisma/client';

/**
 * Compact delegation reference embedded in Site responses.
 */
export class SiteDelegationRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupLabel?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupColor?: string | null;
}

/**
 * Counters from `_count` (assets / racks / tasks for the site).
 */
export class SiteCountResponseDto {
  @ApiProperty()
  @Expose()
  assets!: number;

  @ApiProperty()
  @Expose()
  racks!: number;

  @ApiProperty()
  @Expose()
  tasks!: number;
}

/**
 * Site entity exposed by all CRUD + nearby endpoints.
 *
 * Cas C composite — Prisma scalars + computed PostGIS lat/lng + delegation
 * ref + complex nested shapes (connectivityLinks, connectivity backward-compat,
 * healthSnapshot, contactsOnSite, emplacements). Complex sub-shapes are
 * passed through via `@Transform({obj})` to preserve the existing wire
 * contract without forcing a full sub-DTO migration in this PR (the
 * connectivityLinks rows are already typed via PR #2 connectivity).
 */
export class SiteResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  delegationId!: string | null;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: SiteStatus })
  @Expose()
  status!: SiteStatus;

  @ApiProperty({ nullable: true })
  @Expose()
  address!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  city!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  postalCode!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  country!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Latitude extracted from PostGIS coordinates' })
  @Expose()
  latitude?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Longitude extracted from PostGIS coordinates' })
  @Expose()
  longitude?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  accessSchedules?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  accessBadges?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  accessProcedures?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  accessSafety?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  cutProcedure?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  governanceDocsRef?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  smbPath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  sharepointUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  gedUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  accessRightsUrl?: string | null;

  @ApiProperty({ enum: HealthStatus })
  @Expose()
  healthStatus!: HealthStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastHealthCheck!: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  monitoringEnabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => SiteDelegationRefResponseDto, nullable: true })
  @Expose()
  @Type(() => SiteDelegationRefResponseDto)
  delegation?: SiteDelegationRefResponseDto | null;

  @ApiPropertyOptional({
    type: () => SiteCountResponseDto,
    description: 'Aggregated counts (assets / racks / tasks)',
  })
  @Expose({ name: '_count' })
  @Type(() => SiteCountResponseDto)
  _count?: SiteCountResponseDto;

  // ──────────────────────────────────────────────────────────────────────
  // Complex sub-shapes — passthrough via @Transform({obj}) to preserve the
  // current wire contract without forcing the full migration of every
  // related entity (sub-DTOs land in their own cascade PRs).
  // ──────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Typed ConnectivityLink rows for the site (already shaped by PR #2 connectivity)',
  })
  @Expose()
  @Transform(({ obj }) => obj?.connectivityLinks ?? undefined, { toClassOnly: true })
  connectivityLinks?: unknown;

  @ApiPropertyOptional({
    description:
      'Backward-compat computed connectivity { primary, backup, links, cutProcedure }',
  })
  @Expose()
  @Transform(({ obj }) => obj?.connectivity ?? undefined, { toClassOnly: true })
  connectivity?: unknown;

  @ApiPropertyOptional({
    description: 'SiteHealthSnapshot row (1:0..1) — null when no probe data',
    nullable: true,
  })
  @Expose()
  @Transform(({ obj }) => obj?.healthSnapshot ?? null, { toClassOnly: true })
  healthSnapshot?: unknown;

  @ApiPropertyOptional({
    description: 'Contact rows attached to the site (active only)',
  })
  @Expose()
  @Transform(({ obj }) => obj?.contactsOnSite ?? undefined, { toClassOnly: true })
  contactsOnSite?: unknown;

  @ApiPropertyOptional({
    description: 'SiteEmplacement rows ordered by `order` ASC',
  })
  @Expose()
  @Transform(({ obj }) => obj?.emplacements ?? undefined, { toClassOnly: true })
  emplacements?: unknown;
}
