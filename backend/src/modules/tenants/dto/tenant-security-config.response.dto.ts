import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /tenants/security-config` and
 * `PATCH /tenants/security-config`.
 * Cas A — direct service shape.
 */
export class TenantSecurityConfigResponseDto {
  @ApiProperty()
  @Expose()
  require2FA!: boolean;

  @ApiProperty({ description: 'Access token TTL (e.g. "15m")' })
  @Expose()
  sessionTimeout!: string;

  @ApiProperty({ description: 'Refresh token TTL (e.g. "7d")' })
  @Expose()
  refreshTokenLifetime!: string;
}
