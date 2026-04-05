import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterTaskDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

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
