import { IsString, IsEnum, IsOptional, IsNumber, IsArray, IsDateString, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ExpenseType, ExpenseFrequency } from '@prisma/client';

export class AllocationDto {
  @ApiProperty() @IsString()
  targetId: string;

  @ApiProperty() @IsNumber() @Min(0) @Max(100)
  percentage: number;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  notes?: string;
}

export class CreateExpenseDto {
  @ApiProperty() @IsString()
  label: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ enum: ExpenseType })
  @IsEnum(ExpenseType)
  type: ExpenseType;

  @ApiProperty() @IsNumber()
  totalAmount: number;

  @ApiProperty({ required: false, default: 'EUR' }) @IsString() @IsOptional()
  currency?: string;

  @ApiProperty({ enum: ExpenseFrequency, required: false })
  @IsEnum(ExpenseFrequency) @IsOptional()
  frequency?: ExpenseFrequency;

  @ApiProperty() @IsDateString()
  dateIncurred: string;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  dateStart?: string;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  dateEnd?: string;

  @ApiProperty() @IsString()
  bearerId: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  assetId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  externalRef?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  vendor?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  invoiceRef?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  poNumber?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  notes?: string;

  @ApiProperty({ type: [AllocationDto], required: false })
  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}

export class UpdateExpenseDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional()
  label?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ enum: ExpenseType, required: false }) @IsEnum(ExpenseType) @IsOptional()
  type?: ExpenseType;

  @ApiProperty({ required: false }) @IsNumber() @IsOptional()
  totalAmount?: number;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  currency?: string;

  @ApiProperty({ enum: ExpenseFrequency, required: false }) @IsEnum(ExpenseFrequency) @IsOptional()
  frequency?: ExpenseFrequency;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  dateIncurred?: string;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  dateStart?: string;

  @ApiProperty({ required: false }) @IsDateString() @IsOptional()
  dateEnd?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  bearerId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  assetId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  externalRef?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  vendor?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  invoiceRef?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  poNumber?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  notes?: string;

  @ApiProperty({ type: [AllocationDto], required: false })
  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}
