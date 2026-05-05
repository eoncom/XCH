import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Response for `GET /floor-plans/:id/stats`.
 * `byType` is a `Record<string, number>` (cf README — passthrough via
 * @Transform({obj}) since the keys are dynamic pin types).
 */
export class FloorPlanStatsResponseDto {
  @ApiProperty({ description: 'Total pins on this floor plan' })
  @Expose()
  totalPins!: number;

  @ApiProperty({
    description: 'Counts grouped by pin type (NRO / SDB / WIFI_AP / ASSET / RACK / OTHER)',
    example: { NRO: 1, SDB: 2, WIFI_AP: 8, ASSET: 14 },
  })
  @Expose()
  @Transform(({ obj }) => obj?.byType ?? {}, { toClassOnly: true })
  byType!: Record<string, number>;
}
