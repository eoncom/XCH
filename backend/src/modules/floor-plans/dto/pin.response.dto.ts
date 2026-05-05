import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Pin (marker on floor plan) — Cas C entity. Asset / rack / link relations
 * are passthrough since they're typed by their own cascade PRs.
 */
export class PinResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  floorPlanId!: string;

  @ApiProperty({ description: 'Pin type (NRO / SDB / WIFI_AP / ASSET / RACK / OTHER)' })
  @Expose()
  pinType!: string;

  @ApiProperty()
  @Expose()
  x!: number;

  @ApiProperty()
  @Expose()
  y!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  label?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  assetId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  rackId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  linkId?: string | null;

  @ApiPropertyOptional({ description: 'Asset reference (passthrough)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.asset ?? null, { toClassOnly: true })
  asset?: unknown;

  @ApiPropertyOptional({ description: 'Rack reference (passthrough)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.rack ?? null, { toClassOnly: true })
  rack?: unknown;

  @ApiPropertyOptional({ description: 'ConnectivityLink reference (passthrough)', nullable: true })
  @Expose()
  @Transform(({ obj }) => obj?.link ?? null, { toClassOnly: true })
  link?: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;
}
