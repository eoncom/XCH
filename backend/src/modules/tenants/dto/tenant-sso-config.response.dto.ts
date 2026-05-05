import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * SSO config exposed by `GET /tenants/sso-config` and
 * `PATCH /tenants/sso-config`. The clientSecret is masked (last-4-chars
 * hint only) — the real plaintext NEVER leaves the server.
 *
 * Cas A — service builds the safe shape directly. roleMapping passthrough
 * since it's a `Record<string, string>` (cf README — Record helper rule).
 */
export class TenantSsoConfigResponseDto {
  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ description: 'Provider identifier (oidc / saml / …)' })
  @Expose()
  provider!: string;

  @ApiProperty({ description: 'OIDC issuer URL' })
  @Expose()
  issuer!: string;

  @ApiProperty()
  @Expose()
  clientId!: string;

  @ApiProperty({ description: 'True iff a clientSecret is currently configured' })
  @Expose()
  clientSecretSet!: boolean;

  @ApiProperty({ description: 'Last-4-chars hint of the client secret (or empty)' })
  @Expose()
  clientSecretHint!: string;

  @ApiPropertyOptional({ type: String })
  @Expose()
  callbackUrl?: string;

  @ApiProperty({
    description: 'Group-claim → XCH role mapping ({ admin: "MANAGE", manager: "WRITE", … })',
    example: { admin: 'MANAGE', manager: 'WRITE', technician: 'READ', default: 'READ' },
  })
  @Expose()
  @Transform(({ obj }) => obj?.roleMapping ?? null, { toClassOnly: true })
  roleMapping!: Record<string, string>;
}
