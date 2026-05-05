import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  ConnectivityRole,
  HttpMethod,
  MonitorKind,
  MonitorStatus,
  SeverityLevel,
} from '@prisma/client';

/**
 * Compact site reference embedded in MonitorCheck responses (CHECK_INCLUDE).
 */
export class MonitorSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  delegationId?: string | null;
}

/**
 * Compact asset reference embedded in MonitorCheck responses.
 */
export class MonitorAssetRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  type!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiPropertyOptional({ type: () => MonitorSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorSiteRefResponseDto)
  site?: MonitorSiteRefResponseDto | null;
}

/**
 * Compact connectivity-link reference embedded in MonitorCheck responses.
 */
export class MonitorLinkRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: ConnectivityRole })
  @Expose()
  role!: ConnectivityRole;

  @ApiProperty()
  @Expose()
  provider!: string;

  @ApiProperty({ description: 'FIBER | ADSL | 4G | 5G | STARLINK | ...' })
  @Expose()
  type!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiPropertyOptional({ type: () => MonitorSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorSiteRefResponseDto)
  site?: MonitorSiteRefResponseDto | null;
}

/**
 * HTTP-specific config embedded in MonitorCheck responses (1:0..1).
 */
export class MonitorHttpConfigResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: HttpMethod })
  @Expose()
  method!: HttpMethod;

  @ApiProperty()
  @Expose()
  expectedStatus!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  expectedBodyContains?: string | null;

  @ApiProperty()
  @Expose()
  followRedirects!: boolean;

  @ApiProperty()
  @Expose()
  timeoutMs!: number;
}

/**
 * MonitorCheck response — used by `findOne`, `findAll`, `create`, `update`.
 *
 * Cas C (cf `common/dto/response/README.md`) : Prisma entity with includes
 * (httpConfig + site + asset + link). Maps via `plainToInstance` + `@Type()`
 * on each relation.
 */
export class MonitorCheckResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  assetId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  linkId!: string | null;

  @ApiProperty({ enum: MonitorKind })
  @Expose()
  kind!: MonitorKind;

  @ApiProperty()
  @Expose()
  target!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  targetPort!: number | null;

  @ApiProperty()
  @Expose()
  intervalSec!: number;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  lastCheckedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  nextCheckAt!: Date | null;

  @ApiProperty({ enum: MonitorStatus })
  @Expose()
  lastStatus!: MonitorStatus;

  @ApiProperty({ enum: SeverityLevel })
  @Expose()
  severity!: SeverityLevel;

  @ApiProperty({ nullable: true })
  @Expose()
  createdById!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => MonitorHttpConfigResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorHttpConfigResponseDto)
  httpConfig?: MonitorHttpConfigResponseDto | null;

  @ApiPropertyOptional({ type: () => MonitorSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorSiteRefResponseDto)
  site?: MonitorSiteRefResponseDto | null;

  @ApiPropertyOptional({ type: () => MonitorAssetRefResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorAssetRefResponseDto)
  asset?: MonitorAssetRefResponseDto | null;

  @ApiPropertyOptional({ type: () => MonitorLinkRefResponseDto, nullable: true })
  @Expose()
  @Type(() => MonitorLinkRefResponseDto)
  link?: MonitorLinkRefResponseDto | null;
}
