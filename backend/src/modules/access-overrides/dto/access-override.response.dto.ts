import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact user reference embedded in AccessOverride responses.
 */
export class AccessOverrideUserRefResponseDto {
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
 * Compact site reference embedded in AccessOverride responses.
 */
export class AccessOverrideSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}

/**
 * AccessOverride entity exposed by all CRUD endpoints. Cas C — Prisma
 * entity + optional user/site relations included by the service.
 */
export class AccessOverrideResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty({ description: '"*" = full site, or specific resource (assets, racks, tasks, plans, contacts, expenses, monitoring)' })
  @Expose()
  resource!: string;

  @ApiProperty({ description: 'ALLOW | DENY' })
  @Expose()
  effect!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'READ | WRITE | MANAGE — required when effect=ALLOW, null when DENY' })
  @Expose()
  permission?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  label?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  grantedBy?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  grantedAt!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  expiresAt?: Date | null;

  @ApiPropertyOptional({ type: () => AccessOverrideUserRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AccessOverrideUserRefResponseDto)
  user?: AccessOverrideUserRefResponseDto | null;

  @ApiPropertyOptional({ type: () => AccessOverrideSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AccessOverrideSiteRefResponseDto)
  site?: AccessOverrideSiteRefResponseDto | null;
}

/**
 * Response for `DELETE /access-overrides/:id`.
 */
export class AccessOverrideRemovedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
