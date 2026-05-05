import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /users/me/profile` and `PUT /users/me/profile`.
 * Cas A — direct from `getProfile`. Sensitive fields stripped at the
 * service level, but the DTO whitelist provides a second line of defense.
 */
export class UserProfileResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

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

  @ApiProperty({ description: 'local | oidc | saml' })
  @Expose()
  authProvider!: string;

  @ApiProperty()
  @Expose()
  totpEnabled!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastLoginAt?: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;
}
