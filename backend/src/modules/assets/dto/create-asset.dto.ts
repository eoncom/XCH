import { IsString, IsOptional, IsNumber, IsObject, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ description: 'Asset type (dynamic via EnumLabel)', example: 'SWITCH' })
  @IsString()
  type: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  inventoryTag?: string;

  @ApiProperty({ description: 'Asset status (dynamic via EnumLabel)', default: 'IN_SERVICE' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  locationText?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  networkInfo?: any;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rackId?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  rackPositionU?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  rackHeightU?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rackNotes?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString()
  @IsOptional()
  warrantyEnd?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  powerConsumption?: number;

  @ApiProperty({ required: false, description: 'Effective usage percentage (0-100)' })
  @IsNumber()
  @IsOptional()
  dutyCyclePercent?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
