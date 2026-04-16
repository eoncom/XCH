import { IsString, IsOptional, IsDateString } from 'class-validator';

export class ImportAssetRowDto {
  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  status?: string;

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
