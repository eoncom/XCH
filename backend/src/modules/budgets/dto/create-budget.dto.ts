import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BudgetPeriod } from '@prisma/client';

export class CreateBudgetDto {
  @ApiProperty() @IsString()
  label: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  delegationId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  siteId?: string;

  @ApiPropertyOptional({ description: 'Expense type filter (e.g. EQUIPMENT, SERVICE)' })
  @IsString() @IsOptional()
  expenseType?: string;

  @ApiProperty({ enum: BudgetPeriod })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @ApiProperty() @IsDateString()
  startDate: string;

  @ApiProperty() @IsDateString()
  endDate: string;

  @ApiProperty() @IsNumber() @Min(0)
  amount: number;

  @ApiPropertyOptional({ default: 'EUR' }) @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;
}

export class UpdateBudgetDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  label?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  delegationId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  siteId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  expenseType?: string;

  @ApiPropertyOptional({ enum: BudgetPeriod })
  @IsEnum(BudgetPeriod) @IsOptional()
  period?: BudgetPeriod;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  startDate?: string;

  @ApiPropertyOptional() @IsDateString() @IsOptional()
  endDate?: string;

  @ApiPropertyOptional() @IsNumber() @IsOptional() @Min(0)
  amount?: number;

  @ApiPropertyOptional() @IsString() @IsOptional()
  currency?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  notes?: string;
}

export class FilterBudgetDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  delegationId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  siteId?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  expenseType?: string;

  @ApiPropertyOptional() @IsOptional()
  page?: number;

  @ApiPropertyOptional() @IsOptional()
  pageSize?: number;
}
