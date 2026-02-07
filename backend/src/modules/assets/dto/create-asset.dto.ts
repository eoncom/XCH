import { IsString, IsOptional, IsEnum, IsNumber, IsObject, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssetType, AssetStatus } from '@prisma/client';

export class CreateAssetDto {
  @ApiProperty({ enum: AssetType })
  @IsEnum(AssetType)
  type: AssetType;

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

  @ApiProperty({ enum: AssetStatus, default: 'IN_SERVICE' })
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

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
  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @ApiProperty({ required: false })
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

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
