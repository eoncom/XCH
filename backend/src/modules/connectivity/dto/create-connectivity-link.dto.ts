import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, IsNumber, IsDateString, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ConnectivityRoleDto {
  PRIMARY = 'PRIMARY',
  BACKUP = 'BACKUP',
  OTHER = 'OTHER',
}

export class CreateConnectivityLinkDto {
  @ApiProperty({ description: 'Site this link belongs to' })
  @IsString()
  @IsNotEmpty()
  siteId!: string;

  @ApiProperty({ enum: ConnectivityRoleDto, default: ConnectivityRoleDto.PRIMARY })
  @IsEnum(ConnectivityRoleDto)
  role!: ConnectivityRoleDto;

  @ApiProperty({ description: 'ISP / provider name' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({ description: 'Connection type (FIBER, ADSL, 4G, 5G, STARLINK, ...)' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiPropertyOptional({ description: 'Download speed (Mbps)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bandwidthDown?: number;

  @ApiPropertyOptional({ description: 'Upload speed (Mbps)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bandwidthUp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  publicIp?: string;

  @ApiPropertyOptional({ description: 'Monthly price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ default: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateConnectivityLinkDto extends PartialType(CreateConnectivityLinkDto) {}

export class FilterConnectivityLinkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ enum: ConnectivityRoleDto })
  @IsOptional()
  @IsEnum(ConnectivityRoleDto)
  role?: ConnectivityRoleDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}
