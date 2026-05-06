import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { ExpenseFrequency, ExpenseType } from '@prisma/client';

/**
 * Compact bearer reference embedded in Expense responses (BillingEntity).
 */
export class ExpenseBearerRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  type!: string;
}

/**
 * Single CostAllocation row embedded in Expense responses.
 */
export class ExpenseAllocationResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  expenseId!: string;

  @ApiProperty()
  @Expose()
  targetId!: string;

  @ApiProperty()
  @Expose()
  percentage!: number;

  @ApiProperty()
  @Expose()
  amount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional({ type: () => ExpenseBearerRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ExpenseBearerRefResponseDto)
  target?: ExpenseBearerRefResponseDto | null;
}

/**
 * Expense entity exposed by all CRUD endpoints.
 * Cas C strict — entity + bearer + allocations + passthrough refs.
 */
export class ExpenseResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: ExpenseType })
  @Expose()
  type!: ExpenseType;

  @ApiProperty()
  @Expose()
  totalAmount!: number;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiProperty({ enum: ExpenseFrequency })
  @Expose()
  frequency!: ExpenseFrequency;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  dateIncurred!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  dateStart?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  dateEnd?: Date | null;

  @ApiProperty()
  @Expose()
  bearerId!: string;

  @ApiProperty()
  @Expose()
  delegationId!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  assetId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  externalRef?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  vendorId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  invoiceRef?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  poNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  createdBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => ExpenseBearerRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ExpenseBearerRefResponseDto)
  bearer?: ExpenseBearerRefResponseDto | null;

  @ApiPropertyOptional({ type: () => [ExpenseAllocationResponseDto] })
  @Expose()
  @Type(() => ExpenseAllocationResponseDto)
  allocations?: ExpenseAllocationResponseDto[];

  @ApiPropertyOptional({ description: 'Delegation reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.delegation ?? null, { toClassOnly: true })
  delegation?: unknown;

  @ApiPropertyOptional({ description: 'Site reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.site ?? null, { toClassOnly: true })
  site?: unknown;

  @ApiPropertyOptional({ description: 'Asset reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.asset ?? null, { toClassOnly: true })
  asset?: unknown;

  @ApiPropertyOptional({ description: 'Vendor contact reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.vendorContact ?? null, { toClassOnly: true })
  vendorContact?: unknown;
}
