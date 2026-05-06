import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * BillingEntity entity exposed by all CRUD endpoints (Cost Centre).
 * Cas A — Prisma scalars whitelist.
 */
export class BillingEntityResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty({ description: 'DIRECTION | BU | DELEGATION | SITE | SERVICE | OTHER' })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'null = global (super admin only)' })
  @Expose()
  delegationId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Delegation reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.delegation ?? null, { toClassOnly: true })
  delegation?: unknown;

  @ApiPropertyOptional({ description: 'Site reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.site ?? null, { toClassOnly: true })
  site?: unknown;

  @ApiPropertyOptional({ description: 'Optional `_count` from Prisma (expenses/allocations)' })
  @Expose({ name: '_count' })
  @Transform(({ obj }) => obj?._count ?? undefined, { toClassOnly: true })
  _count?: unknown;
}
