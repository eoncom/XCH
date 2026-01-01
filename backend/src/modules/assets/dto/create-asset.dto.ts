import { IsString, IsOptional, IsEnum, IsNumber, IsObject, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssetDto {
  @ApiProperty({ enum: ['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'ACCESS_POINT', 'TEAMS_ROOM', 'WEBCAM', 'DISPLAY', 'CAMERA', 'SERVER', 'PATCH_PANEL', 'PDU', 'OTHER'] })
  @IsEnum(['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'ACCESS_POINT', 'TEAMS_ROOM', 'WEBCAM', 'DISPLAY', 'CAMERA', 'SERVER', 'PATCH_PANEL', 'PDU', 'OTHER'])
  type: string;

  @ApiProperty()
  @IsString()
  siteId: string;

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

  @ApiProperty({ enum: ['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED'], default: 'IN_SERVICE' })
  @IsEnum(['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED'])
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
