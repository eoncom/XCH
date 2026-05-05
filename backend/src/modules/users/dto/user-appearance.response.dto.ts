import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Response for `GET /users/me/appearance` — raw user preference
 * (inherit | custom).
 *
 * Cas A — direct from `getMyAppearance`. The `preference` partial may
 * contain any of theme/primaryColor/density (or null when source=inherit).
 * Passthrough via @Transform({obj}) since it's a partial Record-like shape.
 */
export class UserAppearanceResponseDto {
  @ApiProperty({ enum: ['inherit', 'custom'] })
  @Expose()
  source!: 'inherit' | 'custom';

  @ApiProperty({
    nullable: true,
    description: 'Partial { theme?, primaryColor?, density? } when source=custom, else null',
  })
  @Expose()
  @Transform(({ obj }) => obj?.preference ?? null, { toClassOnly: true })
  preference!: { theme?: string; primaryColor?: string; density?: string } | null;
}
