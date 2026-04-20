import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEnumLabelDto {
  @ApiProperty({ example: 'AssetType' })
  @IsString()
  @IsNotEmpty()
  enumType: string;

  @ApiProperty({ example: 'SWITCH' })
  @IsString()
  @IsNotEmpty()
  enumValue: string;

  @ApiProperty({ example: 'Commutateur r\u00e9seau' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ example: 'network' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'AssetType-only flag. True = this asset type is eligible to terminate a ConnectivityLink.',
  })
  @IsBoolean()
  @IsOptional()
  isConnectivityCapable?: boolean;
}
