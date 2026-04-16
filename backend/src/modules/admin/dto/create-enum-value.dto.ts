import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnumValueDto {
  @ApiProperty({ example: 'AssetType', description: 'Enum category: AssetType, AssetStatus, or PinType' })
  @IsString()
  @IsNotEmpty()
  enumType: string;

  @ApiProperty({ example: 'DRONE', description: 'Value key (UPPER_SNAKE_CASE)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'enumValue must be UPPER_SNAKE_CASE (e.g., DRONE, SMART_TV)',
  })
  enumValue: string;

  @ApiProperty({ example: 'Drone', description: 'Display label' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ example: 'plane' })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsString()
  @IsOptional()
  color?: string;
}
