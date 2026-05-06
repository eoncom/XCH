import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * Compact site reference embedded inside Delegation responses
 * (findOneDelegation includes a `sites` array).
 */
export class DelegationSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ description: 'PREPARATION | ACTIVE | CLOSED' })
  @Expose()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  city?: string | null;
}

/**
 * `_count` aggregate exposed alongside Delegation entities.
 */
export class DelegationCountsResponseDto {
  @ApiProperty()
  @Expose()
  sites!: number;

  @ApiPropertyOptional()
  @Expose()
  userDelegations?: number;
}

/**
 * Delegation entity exposed by all delegation CRUD endpoints. Cas C —
 * Prisma scalars + optional sites[] (only on findOne) + optional `_count`
 * (passthrough — Prisma exposes the underscored relation aggregate).
 */
export class DelegationResponseDto {
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

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupLabel?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupColor?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => [DelegationSiteRefResponseDto] })
  @Expose()
  @Type(() => DelegationSiteRefResponseDto)
  sites?: DelegationSiteRefResponseDto[];

  @ApiPropertyOptional({
    type: () => DelegationCountsResponseDto,
    description: 'Prisma `_count` aggregate — passthrough via @Transform({obj}) since the underscore prefix breaks @Expose discovery.',
  })
  @Expose({ name: '_count' })
  @Transform(({ obj }) => obj?._count ?? null, { toClassOnly: true })
  _count?: DelegationCountsResponseDto | null;
}

/**
 * Response for `DELETE /delegations/:id` — service returns `{ deleted: true }`.
 */
export class DelegationDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  deleted!: boolean;
}

/**
 * Tree node exposed by `GET /organization/tree` — a delegation with its
 * accessible sites array. Mirrors the `select` declared in
 * organization.service.getTree.
 */
export class DelegationTreeSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  city?: string | null;
}

export class DelegationTreeNodeResponseDto {
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

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupLabel?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupColor?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({ type: () => [DelegationTreeSiteRefResponseDto] })
  @Expose()
  @Type(() => DelegationTreeSiteRefResponseDto)
  sites!: DelegationTreeSiteRefResponseDto[];
}
