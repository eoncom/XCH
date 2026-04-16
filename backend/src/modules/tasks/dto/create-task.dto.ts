import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

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

  @ApiProperty({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedTo?: string;

  @ApiProperty({ required: false, type: Date })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ required: false, type: [Object] })
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

  @ApiProperty({ required: false, description: 'Estimated cost' })
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;

  @ApiProperty({ required: false, description: 'Actual cost' })
  @IsNumber()
  @IsOptional()
  actualCost?: number;

  @ApiProperty({ required: false, default: 'EUR' })
  @IsString()
  @IsOptional()
  costCurrency?: string;
}
