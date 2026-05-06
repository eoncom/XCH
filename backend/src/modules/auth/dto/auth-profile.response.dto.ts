import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /auth/profile` — returns the in-memory `req.user`
 * object built by `JwtStrategy.validate()` from the JWT payload.
 *
 * Whitelist of the JWT-payload-derived shape: id, userId (alias),
 * email, tenantId, isSuperAdmin. Nothing from the database is added.
 */
export class AuthProfileResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ description: 'Alias of `id` — kept for legacy callers using userId' })
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  isSuperAdmin!: boolean;
}
