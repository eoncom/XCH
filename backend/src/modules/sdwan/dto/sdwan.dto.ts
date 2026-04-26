import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';

export class UpsertSdwanConfigDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 'Fortinet SD-WAN' })
  @IsOptional()
  @IsString()
  provider?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

const SDWAN_ROLES = ['active', 'passive', 'peer'] as const;
export type SdwanFirewallRole = typeof SDWAN_ROLES[number];

export class AttachFirewallDto {
  @ApiProperty({ description: 'Asset id of the firewall to attach' })
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @ApiPropertyOptional({ enum: SDWAN_ROLES, default: 'active' })
  @IsOptional()
  @IsIn(SDWAN_ROLES as unknown as string[])
  role?: SdwanFirewallRole;
}
