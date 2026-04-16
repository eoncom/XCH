import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssetModelDto {
  @ApiProperty({ description: 'Model name (e.g. "HP LaserJet Pro M404n")' })
  @IsString()
  name: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  manufacturer?: string;

  @ApiProperty({ description: 'Asset type (dynamic enum value)' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: 'One-time acquisition price' })
  @IsNumber() @IsOptional() @Min(0)
  acquisitionPrice?: number;

  @ApiPropertyOptional({ description: 'Monthly recurring price' })
  @IsNumber() @IsOptional() @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ default: 'EUR' }) @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: ['ONE_TIME', 'MONTHLY'], default: 'ONE_TIME' })
  @IsString() @IsOptional()
  @IsIn(['ONE_TIME', 'MONTHLY'])
  pricingMode?: string;

  @ApiPropertyOptional({ description: 'Power consumption in Watts' })
  @IsNumber() @IsOptional() @Min(0)
  powerConsumption?: number;

  @ApiPropertyOptional({ description: 'Weight in kg' })
  @IsNumber() @IsOptional() @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'Default rack height in U' })
  @IsInt() @IsOptional() @Min(1)
  defaultUHeight?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;
}

export class UpdateAssetModelDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  type?: string;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0)
  acquisitionPrice?: number;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: ['ONE_TIME', 'MONTHLY'] })
  @IsString() @IsOptional()
  @IsIn(['ONE_TIME', 'MONTHLY'])
  pricingMode?: string;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0)
  powerConsumption?: number;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0)
  weight?: number;

  @ApiPropertyOptional() @IsInt() @IsOptional() @Min(1)
  defaultUHeight?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  isActive?: boolean;
}

export class FilterAssetModelDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  type?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  search?: string;

  @ApiPropertyOptional() @IsOptional()
  isActive?: string; // query param comes as string

  @ApiPropertyOptional() @IsOptional()
  page?: number;

  @ApiPropertyOptional() @IsOptional()
  pageSize?: number;
}
