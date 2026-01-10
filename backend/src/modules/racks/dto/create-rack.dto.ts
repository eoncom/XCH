import { IsString, IsOptional, IsEnum, IsNumber, IsObject, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RackType, RackStatus } from '@prisma/client';

export class CreateRackDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty({ enum: [4, 6, 12, 18, 24, 42], example: 42 })
  @IsNumber()
  @Min(4)
  @Max(42)
  heightU: number;

  @ApiProperty({ enum: ['WALL_MOUNTED', 'FLOOR_STANDING', 'ENCLOSED_CABINET'], default: 'FLOOR_STANDING' })
  @IsEnum(RackType)
  @IsOptional()
  rackType?: RackType;

  @ApiProperty({ enum: RackStatus, default: RackStatus.IN_SERVICE })
  @IsEnum(RackStatus)
  @IsOptional()
  status?: RackStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  specs?: any;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
