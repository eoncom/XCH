import { IsString, IsObject, IsOptional, IsIn, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveNotificationConfigDto {
  @ApiProperty({ description: 'Scope type', enum: ['TENANT', 'DIVISION', 'DELEGATION'] })
  @IsString()
  @IsIn(['TENANT', 'DIVISION', 'DELEGATION'])
  scopeType: string;

  @ApiProperty({ description: 'Scope ID (tenantId, divisionId, or delegationId)' })
  @IsString()
  scopeId: string;

  @ApiProperty({ description: 'Channel configurations (email, teams)' })
  @IsObject()
  channels: Record<string, any>;

  @ApiProperty({ description: 'Event configurations' })
  @IsObject()
  events: Record<string, any>;
}

export class TestChannelDto {
  @ApiProperty({ description: 'Channel name', enum: ['email', 'teams'] })
  @IsString()
  @IsIn(['email', 'teams'])
  channel: string;

  @ApiProperty({ description: 'Channel configuration to test' })
  @IsObject()
  config: Record<string, any>;
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
