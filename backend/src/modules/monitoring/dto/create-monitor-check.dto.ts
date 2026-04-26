import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsNotEmpty,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MonitorKind, HttpMethod } from '@prisma/client';

export class CreateMonitorHttpConfigDto {
  @ApiPropertyOptional({ enum: HttpMethod, default: HttpMethod.GET })
  @IsOptional()
  @IsEnum(HttpMethod)
  method?: HttpMethod;

  @ApiPropertyOptional({ default: 200, minimum: 100, maximum: 599 })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatus?: number;

  @ApiPropertyOptional({ description: 'Substring that must appear in the response body' })
  @IsOptional()
  @IsString()
  expectedBodyContains?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  followRedirects?: boolean;

  @ApiPropertyOptional({ default: 5000, minimum: 500, maximum: 30000 })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(30000)
  timeoutMs?: number;
}

export class CreateMonitorCheckDto {
  @ApiPropertyOptional({ description: 'Site ID — exactly ONE of siteId / assetId / linkId must be set' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Asset ID' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ description: 'ConnectivityLink ID' })
  @IsOptional()
  @IsString()
  linkId?: string;

  @ApiProperty({ enum: MonitorKind, description: 'Probe type (ICMP / HTTP / TCP)' })
  @IsEnum(MonitorKind)
  kind!: MonitorKind;

  @ApiProperty({ description: 'host / IP / URL — semantics depend on kind' })
  @IsString()
  @IsNotEmpty()
  target!: string;

  @ApiPropertyOptional({ description: 'TCP port (required when kind = TCP)', minimum: 1, maximum: 65535 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  targetPort?: number;

  @ApiPropertyOptional({ default: 300, minimum: 60, maximum: 3600 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  intervalSec?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: CreateMonitorHttpConfigDto, description: 'HTTP config — only when kind = HTTP' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMonitorHttpConfigDto)
  httpConfig?: CreateMonitorHttpConfigDto;
}

export class UpdateMonitorCheckDto extends PartialType(CreateMonitorCheckDto) {}

export class FilterMonitorCheckDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkId?: string;

  @ApiPropertyOptional({ enum: MonitorKind })
  @IsOptional()
  @IsEnum(MonitorKind)
  kind?: MonitorKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ description: 'Filter by status: UP | DOWN | UNKNOWN' })
  @IsOptional()
  @IsString()
  status?: string;
}
