import { IsString, IsEnum, IsOptional, IsNumber, IsArray, IsDateString, ValidateNested, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ExpenseType, ExpenseFrequency } from '@prisma/client';

export class AllocationDto {
  @ApiProperty() @IsString()
  targetId: string;

  @ApiProperty() @IsNumber() @Min(0) @Max(100)
  percentage: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;
}

export class CreateExpenseDto {
  @ApiProperty() @IsString()
  label: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ enum: ExpenseType })
  @IsEnum(ExpenseType)
  type: ExpenseType;

  @ApiProperty() @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ default: 'EUR' }) @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: ExpenseFrequency })
  @IsEnum(ExpenseFrequency) @IsOptional()
  frequency?: ExpenseFrequency;

  @ApiProperty() @IsDateString()
  dateIncurred: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  dateStart?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  dateEnd?: string;

  @ApiProperty() @IsString()
  bearerId: string;

  @ApiProperty({ description: 'Delegation ID (required for expenses, R2)' })
  @IsString()
  @IsNotEmpty()
  delegationId: string;

  @ApiPropertyOptional({ description: 'Site ID — optional site-level attachment (R1)' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Vendor contact ID (from Contacts module)' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  assetId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  externalRef?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  invoiceRef?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: [AllocationDto] })
  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}

export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  label?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ExpenseType }) @IsEnum(ExpenseType) @IsOptional()
  type?: ExpenseType;

  @ApiPropertyOptional() @IsNumber() @IsOptional()
  totalAmount?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: ExpenseFrequency }) @IsEnum(ExpenseFrequency) @IsOptional()
  frequency?: ExpenseFrequency;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  dateIncurred?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  dateStart?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  dateEnd?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  bearerId?: string;

  @ApiPropertyOptional({ description: 'Delegation ID (required for expenses)' })
  @IsOptional()
  @IsString()
  delegationId?: string;

  @ApiPropertyOptional({ description: 'Site ID (null to clear)' })
  @IsOptional()
  @IsString()
  siteId?: string | null;

  @ApiPropertyOptional({ description: 'Vendor contact ID' })
  @IsOptional() @IsString()
  vendorId?: string | null;

  @ApiPropertyOptional() @IsString() @IsOptional()
  assetId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  externalRef?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  invoiceRef?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  poNumber?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ type: [AllocationDto] })
  @IsArray() @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];
}
