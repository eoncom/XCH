import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * Compact user reference embedded in AuditLog rows. Mirrors the
 * `select` declared in audit.service.query.
 */
export class AuditLogUserRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiProperty()
  @Expose()
  email!: string;
}

/**
 * Single AuditLog row exposed by `GET /audit` and `GET /audit/entity/:type/:id`.
 *
 * Cas C — Prisma scalars + optional user ref + the synthetic
 * `entityLabel` field added by `enrichWithEntityLabels` after the row
 * is loaded. The `changes` JSON is passthrough (Prisma JSON value —
 * `@Transform({obj})` reads from the source plain).
 */
export class AuditLogResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  userId?: string | null;

  @ApiProperty({ description: 'CREATE | UPDATE | DELETE' })
  @Expose()
  action!: string;

  @ApiProperty()
  @Expose()
  entityType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  entityId?: string | null;

  @ApiPropertyOptional({
    description:
      'Free-form { before?, after? } JSON object. Passthrough — class-transformer drops dynamic keys under @Expose() alone, so we use @Transform({obj}) to read from the source plain.',
  })
  @Expose()
  @Transform(({ obj }) => obj?.changes ?? null, { toClassOnly: true })
  changes?: unknown;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  ipAddress?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  userAgent?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  timestamp!: Date;

  @ApiPropertyOptional({ type: () => AuditLogUserRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AuditLogUserRefResponseDto)
  user?: AuditLogUserRefResponseDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Human-readable entity label resolved by enrichWithEntityLabels (asset name, site code—name, …)',
  })
  @Expose()
  entityLabel?: string | null;
}
