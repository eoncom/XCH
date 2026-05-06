import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AuthTenantRefResponseDto } from './auth-user-ref.response.dto';

/**
 * User shape returned by `POST /auth/register` (super-admin creates a user)
 * and the underlying piece of `POST /auth/invite`.
 *
 * The service strips passwordHash / totpSecret / totpBackupCodes / inviteToken /
 * resetToken before returning, but the DTO whitelist is the second line of
 * defense — only legit identity & profile fields are @Expose()'d.
 *
 * Cas C — Prisma user entity + tenant ref via @Type().
 */
export class AuthUserResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

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

  @ApiProperty({ description: 'local | oidc | saml' })
  @Expose()
  authProvider!: string;

  @ApiProperty({ description: 'True iff TOTP is enabled (boolean only — never the secret)' })
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

  @ApiPropertyOptional({ type: () => AuthTenantRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AuthTenantRefResponseDto)
  tenant?: AuthTenantRefResponseDto | null;
}
