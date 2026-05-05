import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Response for `GET /tenants/current/config` — branding fields plus the
 * assembled config envelope.
 *
 * Cas C composite — sub-shapes (appearance / branding / sso / security /
 * integrations / modules) are dynamically assembled from 7 typed tables
 * with secret-masking. Passthrough via @Transform({obj}) — fully typed
 * sub-DTOs land in dedicated cascade PRs (sso, security, electricity,
 * appearance each have their own endpoint with strict DTOs).
 */
export class TenantCurrentConfigResponseDto {
  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  logoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  primaryColor?: string | null;

  @ApiProperty({
    description:
      'Assembled tenant config: appearance / branding / electricity / sso (safe) / security / integrations / modules',
  })
  @Expose()
  @Transform(({ obj }) => obj?.config ?? undefined, { toClassOnly: true })
  config!: unknown;
}
