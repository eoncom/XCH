import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { MonitorKind } from '@prisma/client';

/**
 * Single disabled monitor exposed by the auto-disable banner endpoint.
 */
export class AutoDisabledMonitorResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  target!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  targetPort!: number | null;

  @ApiProperty({ enum: MonitorKind })
  @Expose()
  kind!: MonitorKind;
}

/**
 * Banner state for an entity (asset / site) returned by
 * `GET /monitors/auto-disabled/status` (ADR-016 §E).
 *
 * Cas B (cf `common/dto/response/README.md`) — composite shape derived from
 * 3 distinct queries (disabled monitors + last AUTO_DISABLED + last
 * AUTO_DISABLED_ACK). Service constructs the literal directly.
 */
export class AutoDisabledStatusResponseDto {
  @ApiProperty({ type: () => [AutoDisabledMonitorResponseDto] })
  @Expose()
  @Type(() => AutoDisabledMonitorResponseDto)
  disabledMonitors!: AutoDisabledMonitorResponseDto[];

  @ApiProperty()
  @Expose()
  acknowledged!: boolean;
}
