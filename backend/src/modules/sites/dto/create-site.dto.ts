import { IsString, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SiteStatus, HealthStatus } from '@prisma/client';

export class CreateSiteDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: SiteStatus, default: SiteStatus.ACTIVE })
  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ default: 'France' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  contacts?: any;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  accessNotes?: any;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  connectivity?: any;

  @ApiProperty({ enum: HealthStatus, default: HealthStatus.UNKNOWN })
  @IsEnum(HealthStatus)
  @IsOptional()
  healthStatus?: HealthStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
