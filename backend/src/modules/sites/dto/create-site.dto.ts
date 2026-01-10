import { IsString, IsOptional, IsEnum, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SiteStatus } from '@prisma/client';

export class CreateSiteDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['PREPARATION', 'ACTIVE', 'CLOSED'], default: 'ACTIVE' })
  @IsEnum(['PREPARATION', 'ACTIVE', 'CLOSED'])
  @IsOptional()
  status?: string;

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

  @ApiProperty({ enum: ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'], default: 'UNKNOWN' })
  @IsEnum(['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'])
  @IsOptional()
  healthStatus?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
