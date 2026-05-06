import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact user reference exposed inside UserDelegation rows when the
 * caller listed delegations BY delegation (findByDelegation). Strict
 * whitelist — no sensitive fields (passwordHash, totpSecret, etc.).
 */
export class UserDelegationUserRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  active!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastLoginAt?: Date | null;
}

/**
 * Compact delegation reference exposed inside UserDelegation rows.
 * Mirrors the `select` declared in service.getUserDelegations /
 * getMyDelegations / setRole.
 */
export class UserDelegationDelegationRefResponseDto {
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

  @ApiPropertyOptional()
  @Expose()
  isActive?: boolean;
}

/**
 * UserDelegation entity exposed by all endpoints. Cas C — Prisma scalars
 * + optional user/delegation refs (one or the other depending on the
 * service method called).
 */
export class UserDelegationResponseDto {
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
  delegationId!: string;

  @ApiProperty({ description: 'MANAGE | WRITE | READ' })
  @Expose()
  right!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Origin of grant: manual user-id | "sso"' })
  @Expose()
  grantedBy?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  grantedAt!: Date;

  @ApiPropertyOptional({ type: () => UserDelegationUserRefResponseDto, nullable: true })
  @Expose()
  @Type(() => UserDelegationUserRefResponseDto)
  user?: UserDelegationUserRefResponseDto | null;

  @ApiPropertyOptional({ type: () => UserDelegationDelegationRefResponseDto, nullable: true })
  @Expose()
  @Type(() => UserDelegationDelegationRefResponseDto)
  delegation?: UserDelegationDelegationRefResponseDto | null;
}
