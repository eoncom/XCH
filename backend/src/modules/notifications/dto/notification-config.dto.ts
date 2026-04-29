import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannelKind, NotificationEventType } from '@prisma/client';

/**
 * ADR-020 — DTOs for the new normalized notification settings API.
 *
 * Body shape sent to PUT /api/notifications/config :
 *   {
 *     delegationId: string | null,
 *     channels: [ { kind, enabled, recipients?, webhookUrl? }, ... ],
 *     rules:    [ { eventType, enabled, channels[] }, ... ]
 *   }
 */

export class SaveSettingsChannelDto {
  @ApiProperty({ enum: NotificationChannelKind })
  @IsEnum(NotificationChannelKind)
  kind!: NotificationChannelKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'EMAIL only — recipient addresses' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  recipients?: string[];

  @ApiPropertyOptional({ description: 'TEAMS only — webhook URL (plaintext at write, encrypted at-rest)' })
  @IsOptional()
  @IsString()
  webhookUrl?: string | null;
}

export class SaveSettingsRuleDto {
  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ enum: NotificationChannelKind, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(NotificationChannelKind, { each: true })
  channels?: NotificationChannelKind[];
}

export class SaveNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Delegation ID (null = tenant-global)' })
  @IsOptional()
  @IsString()
  delegationId?: string | null;

  @ApiProperty({ type: [SaveSettingsChannelDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveSettingsChannelDto)
  channels!: SaveSettingsChannelDto[];

  @ApiProperty({ type: [SaveSettingsRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveSettingsRuleDto)
  rules!: SaveSettingsRuleDto[];
}

export class TestChannelDto {
  @ApiProperty({ enum: NotificationChannelKind })
  @IsEnum(NotificationChannelKind)
  kind!: NotificationChannelKind;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webhookUrl?: string | null;
}

export class NotificationLogQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;
}
