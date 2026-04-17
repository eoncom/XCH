import { IsString, IsOptional, IsNumber, IsObject, IsDateString, IsIn } from 'class-validator';
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

  @ApiProperty({
    required: false,
    description:
      'Attach to a delegation (multi-site). If provided without siteId, the asset applies to all sites of the delegation.',
  })
  @IsString()
  @IsOptional()
  delegationId?: string;

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

  @ApiProperty({ required: false, description: 'Link to an AssetModel for pricing/specs defaults' })
  @IsString()
  @IsOptional()
  assetModelId?: string;

  @ApiProperty({ required: false, description: 'One-time purchase price' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsNumber()
  @IsOptional()
  acquisitionPrice?: number;

  @ApiProperty({ required: false, description: 'Monthly lease/rental price' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsNumber()
  @IsOptional()
  monthlyPrice?: number;

  @ApiProperty({ required: false, default: 'EUR' })
  @IsString()
  @IsOptional()
  priceCurrency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  // WiFi AP coverage (for floor-plan rendering)
  @ApiProperty({ required: false, description: 'WiFi coverage radius in meters' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsNumber()
  @IsOptional()
  wifiCoverageRadius?: number;

  @ApiProperty({ required: false, description: 'WiFi frequency band', enum: ['2.4GHz', '5GHz', '6GHz', 'DUAL', 'TRI'] })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsString()
  @IsIn(['2.4GHz', '5GHz', '6GHz', 'DUAL', 'TRI'])
  @IsOptional()
  wifiFrequency?: string;

  @ApiProperty({ required: false, description: 'Antenna type', enum: ['OMNI', 'DIRECTIONAL', 'SECTOR'] })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsString()
  @IsIn(['OMNI', 'DIRECTIONAL', 'SECTOR'])
  @IsOptional()
  wifiAntennaType?: string;

  @ApiProperty({ required: false, description: 'Transmit power in dBm' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsNumber()
  @IsOptional()
  wifiTxPowerDbm?: number;
}
