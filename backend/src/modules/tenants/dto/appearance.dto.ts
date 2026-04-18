import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Shared appearance schema — used by Tenant-level defaults and User-level overrides.
 *
 * theme        : 'light' | 'dark' | 'system' (follows OS)
 * primaryColor : #rrggbb hex (6 digits)
 * density      : 'compact' | 'comfortable'
 */
export class AppearancePayload {
  @IsOptional()
  @IsIn(['light', 'dark', 'system'], { message: 'theme must be light, dark or system' })
  theme?: 'light' | 'dark' | 'system';

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primaryColor must be a hex color like #0070f3' })
  primaryColor?: string;

  @IsOptional()
  @IsIn(['compact', 'comfortable'], { message: 'density must be compact or comfortable' })
  density?: 'compact' | 'comfortable';
}

/**
 * Tenant-level appearance: all fields required on create, plus `allowUserOverride`.
 */
export class UpdateTenantAppearanceDto extends AppearancePayload {
  @IsOptional()
  @IsBoolean()
  allowUserOverride?: boolean;
}

/**
 * User-level appearance override: same fields, all optional, plus explicit source toggle.
 */
export class UpdateUserAppearanceDto extends AppearancePayload {
  @IsOptional()
  @IsIn(['inherit', 'custom'], { message: 'source must be inherit or custom' })
  source?: 'inherit' | 'custom';
}

export interface ResolvedAppearance {
  theme: 'light' | 'dark' | 'system';
  primaryColor: string;
  density: 'compact' | 'comfortable';
  allowUserOverride: boolean;
}

export interface EffectiveAppearance extends ResolvedAppearance {
  /** Where the resolved value came from. */
  source: 'inherit' | 'custom';
  /** Tenant defaults (for displaying "reset to tenant" option). */
  tenant: ResolvedAppearance;
  /** User override raw (null if inherit). */
  user: Partial<ResolvedAppearance> | null;
}

export const DEFAULT_TENANT_APPEARANCE: ResolvedAppearance = {
  theme: 'system',
  primaryColor: '#0070f3',
  density: 'comfortable',
  allowUserOverride: true,
};
