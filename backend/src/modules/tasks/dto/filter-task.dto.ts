import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterTaskDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'], required: false })
  @IsEnum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], required: false })
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unassigned?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  overdue?: string;
}
