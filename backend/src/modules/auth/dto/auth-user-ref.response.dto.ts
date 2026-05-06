import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact tenant reference embedded in auth-flow user payloads.
 */
export class AuthTenantRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  subdomain?: string | null;
}

/**
 * User reference returned alongside auth flows (login result, session,
 * 2FA verify). Strict whitelist — sensitive fields (passwordHash,
 * totpSecret, totpBackupCodes, inviteToken, resetToken, failedLoginAttempts,
 * lockedUntil, externalId) are never @Expose()'d.
 *
 * Cas C — embeds compact tenant ref via @Type().
 */
export class AuthUserRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiPropertyOptional({ type: () => AuthTenantRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AuthTenantRefResponseDto)
  tenant?: AuthTenantRefResponseDto | null;

  @ApiProperty({ description: 'True iff the user has TOTP enabled (boolean only — never the secret)' })
  @Expose()
  totpEnabled!: boolean;

  @ApiProperty()
  @Expose()
  isSuperAdmin!: boolean;
}
