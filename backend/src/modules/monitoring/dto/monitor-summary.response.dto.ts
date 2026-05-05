import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single rolling-window slice (24h / 7d / 30d) returned by
 * `GET /monitors/:id/summary`.
 */
export class MonitorWindowResponseDto {
  @ApiProperty({ description: 'Total probes in this window' })
  @Expose()
  total!: number;

  @ApiProperty({ description: 'Probes that returned UP in this window' })
  @Expose()
  up!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Uptime percentage (0..100) — null when total = 0 (no data in window)',
  })
  @Expose()
  uptime!: number | null;
}

/**
 * Uptime summary across 3 rolling windows (24h / 7d / 30d) for a single
 * MonitorCheck.
 *
 * Cas B (cf `common/dto/response/README.md`) — calculated shape mapped via
 * the helper `toMonitorSummaryResponseDto` because the source rows from
 * `$queryRaw` are bigint-flavored and need explicit Number coercion plus
 * uptime computation.
 */
export class MonitorSummaryResponseDto {
  @ApiProperty({ type: () => MonitorWindowResponseDto })
  @Expose({ name: '24h' })
  @Type(() => MonitorWindowResponseDto)
  '24h'!: MonitorWindowResponseDto;

  @ApiProperty({ type: () => MonitorWindowResponseDto })
  @Expose({ name: '7d' })
  @Type(() => MonitorWindowResponseDto)
  '7d'!: MonitorWindowResponseDto;

  @ApiProperty({ type: () => MonitorWindowResponseDto })
  @Expose({ name: '30d' })
  @Type(() => MonitorWindowResponseDto)
  '30d'!: MonitorWindowResponseDto;
}

/**
 * Maps the `$queryRaw` UNION ALL rows into the API contract shape.
 *
 * Pre-S9 the controller returned a `Record<string, ...>` literal with 3
 * dynamic keys, which Swagger could not document. This helper preserves the
 * over-the-wire shape (24h / 7d / 30d top-level keys) while exposing a
 * statically-typed surface to controllers and tests.
 */
export function toMonitorSummaryResponseDto(
  rows: Array<{ window: string; total: bigint; up: bigint }>,
): MonitorSummaryResponseDto {
  const out: Record<string, MonitorWindowResponseDto> = {};
  for (const r of rows) {
    const total = Number(r.total);
    const up = Number(r.up);
    out[r.window] = {
      total,
      up,
      uptime: total === 0 ? null : Math.round((up / total) * 10000) / 100,
    };
  }
  return out as unknown as MonitorSummaryResponseDto;
}
