import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /tenants/appearance` and `PATCH /tenants/appearance`.
 * Cas A — direct from `getAppearanceConfig` (resolved from
 * TenantAppearance + Tenant fallbacks + DEFAULT_TENANT_APPEARANCE).
 */
export class TenantAppearanceResponseDto {
  @ApiProperty({ enum: ['light', 'dark', 'system'] })
  @Expose()
  theme!: 'light' | 'dark' | 'system';

  @ApiProperty({ description: 'Primary color (hex / OKLCH / …)' })
  @Expose()
  primaryColor!: string;

  @ApiProperty({ enum: ['comfortable', 'compact'] })
  @Expose()
  density!: 'comfortable' | 'compact';

  @ApiProperty({ description: 'Whether end-users can override the tenant default' })
  @Expose()
  allowUserOverride!: boolean;
}
