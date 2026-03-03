import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFloorPlanDto {
  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  floor?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  building?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  version?: number;

  @ApiProperty({ required: false, description: 'Group ID for versioning (auto-generated if not set)' })
  @IsString()
  @IsOptional()
  planGroupId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, description: 'Scale: meters per normalized pixel unit (0-1)' })
  @IsNumber()
  @IsOptional()
  scaleMetersPerPixel?: number;

  @ApiProperty({ required: false, description: 'Scale reference line: {x1,y1,x2,y2,meters}' })
  @IsOptional()
  scaleRefLine?: any;
}
