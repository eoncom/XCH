import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Resolved effective appearance returned by `GET /users/me/effective-appearance`
 * and as `PATCH /users/me/appearance` result.
 *
 * Composite : tenant defaults + user override merge + source flag + tenant
 * appearance reference + user appearance reference (or null if inherit).
 *
 * Cas C composite — sub-shapes (`tenant`, `user`) passthrough since they
 * mirror the TenantAppearance and UserAppearance shapes from the tenants
 * module (cf PR #7).
 */
export class UserEffectiveAppearanceResponseDto {
  @ApiProperty({ enum: ['light', 'dark', 'system'] })
  @Expose()
  theme!: string;

  @ApiProperty()
  @Expose()
  primaryColor!: string;

  @ApiProperty({ enum: ['comfortable', 'compact'] })
  @Expose()
  density!: string;

  @ApiProperty()
  @Expose()
  allowUserOverride!: boolean;

  @ApiProperty({ enum: ['inherit', 'custom'] })
  @Expose()
  source!: 'inherit' | 'custom';

  @ApiProperty({ description: 'Effective tenant defaults' })
  @Expose()
  @Transform(({ obj }) => obj?.tenant ?? null, { toClassOnly: true })
  tenant!: unknown;

  @ApiPropertyOptional({
    nullable: true,
    description: 'User custom override or null when source=inherit',
  })
  @Expose()
  @Transform(({ obj }) => obj?.user ?? null, { toClassOnly: true })
  user?: unknown;
}
