import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /auth/sso-config` — public endpoint consumed by the
 * login page to show/hide the SSO button.
 */
export class SsoConfigResponseDto {
  @ApiProperty()
  @Expose()
  ssoEnabled!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'IdP type identifier (oidc / saml / null)' })
  @Expose()
  provider?: string | null;
}
