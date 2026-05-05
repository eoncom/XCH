import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * Compact tenant reference embedded in User responses.
 */
export class UserTenantRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}

/**
 * Compact delegation reference embedded inside UserDelegation rows.
 */
export class UserDelegationRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupLabel?: string | null;
}

/**
 * UserDelegation row exposed inside `userDelegations` array.
 */
export class UserDelegationItemResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  delegationId!: string;

  @ApiProperty({ description: 'Right level: MANAGE | WRITE | READ' })
  @Expose()
  right!: string;

  @ApiProperty({ type: () => UserDelegationRefResponseDto })
  @Expose()
  @Type(() => UserDelegationRefResponseDto)
  delegation!: UserDelegationRefResponseDto;
}

/**
 * User entity exposed by all CRUD endpoints. SENSITIVE fields are
 * deliberately NOT @Expose()'d : passwordHash, totpSecret, totpBackupCodes,
 * inviteToken, resetToken, failedLoginAttempts, lockedUntil. The runtime
 * smoke test in dto-shape.spec verifies these never leak in the wire
 * payload.
 *
 * Cas C — Prisma entity + tenant ref + userDelegations[] + appearance
 * scalars passthrough.
 */
export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  avatarUrl?: string | null;

  @ApiProperty()
  @Expose()
  isSuperAdmin!: boolean;

  @ApiProperty()
  @Expose()
  active!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  externalId?: string | null;

  @ApiProperty({ description: 'local | oidc | saml' })
  @Expose()
  authProvider!: string;

  @ApiProperty({ description: 'True iff the user has TOTP enabled (boolean only — never the secret)' })
  @Expose()
  totpEnabled!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastLoginAt?: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => UserTenantRefResponseDto, nullable: true })
  @Expose()
  @Type(() => UserTenantRefResponseDto)
  tenant?: UserTenantRefResponseDto;

  @ApiPropertyOptional({ type: () => [UserDelegationItemResponseDto] })
  @Expose()
  @Type(() => UserDelegationItemResponseDto)
  userDelegations?: UserDelegationItemResponseDto[];

  // Appearance scalars (ADR-018) — passthrough since they're individual
  // nullable strings; the resolved appearance is exposed via /me/appearance
  // endpoints with their own DTOs.
  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.appearanceTheme ?? null, { toClassOnly: true })
  appearanceTheme?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.appearancePrimaryColor ?? null, { toClassOnly: true })
  appearancePrimaryColor?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.appearanceDensity ?? null, { toClassOnly: true })
  appearanceDensity?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.appearanceSource ?? null, { toClassOnly: true })
  appearanceSource?: string | null;
}
