import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { AssetType, AssetStatus } from '@prisma/client';

export class ImportAssetRowDto {
  @IsEnum(AssetType)
  type: AssetType;

  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  siteId?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  macAddress?: string;

  @IsString()
  @IsOptional()
  firmwareVersion?: string;

  @IsDateString()
  @IsOptional()
  warrantyEnd?: string;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export interface ImportResultDto {
  total: number;
  imported: number;
  errors: Array<{ row: number; field: string; message: string }>;
}
