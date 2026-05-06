import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Per-entity-type counts exposed by `POST /seed/demo`. Open shape
 * (sites / users / assets / racks / tasks / contactTypes / contacts —
 * may grow with future seed data domains) but never sensitive.
 */
export class SeedDemoStatsResponseDto {
  @ApiPropertyOptional()
  @Expose()
  sites?: number;

  @ApiPropertyOptional()
  @Expose()
  users?: number;

  @ApiPropertyOptional()
  @Expose()
  assets?: number;

  @ApiPropertyOptional()
  @Expose()
  racks?: number;

  @ApiPropertyOptional()
  @Expose()
  tasks?: number;

  @ApiPropertyOptional()
  @Expose()
  contactTypes?: number;

  @ApiPropertyOptional()
  @Expose()
  contacts?: number;
}

/**
 * Response for `POST /seed/demo` — non-sensitive metadata only.
 */
export class SeedDemoResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;

  @ApiProperty({ type: () => SeedDemoStatsResponseDto })
  @Expose()
  stats!: SeedDemoStatsResponseDto;
}

/**
 * Response for `POST /seed/reset` — global reset acknowledgement.
 */
export class SeedResetResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

/**
 * Response for `POST /seed/reset/:domain` — scoped reset (test env only).
 */
export class SeedResetDomainResponseDto {
  @ApiProperty({ description: 'sites | assets | racks | expenses | monitors | notifications' })
  @Expose()
  domain!: string;

  @ApiProperty()
  @Expose()
  message!: string;
}
