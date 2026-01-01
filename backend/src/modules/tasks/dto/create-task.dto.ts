import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'], default: 'TODO' })
  @IsEnum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ required: false, type: 'array', items: { type: 'object' } })
  @IsArray()
  @IsOptional()
  checklist?: any[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ticketRef?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ticketUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  ticketStatus?: string;
}
