import { IsString, IsNumber, Min, Max, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PinType } from '@prisma/client';

export class CreatePinDto {
  @ApiProperty({ enum: PinType })
  @IsEnum(PinType)
  pinType: PinType;

  @ApiProperty({ description: 'Normalized X coordinate (0.0 to 1.0)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  x: number;

  @ApiProperty({ description: 'Normalized Y coordinate (0.0 to 1.0)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  y: number;

  @ApiProperty({ required: false, description: 'Asset ID (for equipment pins)' })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  color?: string;
}
