import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * Compact delegation reference embedded in Budget responses.
 */
export class BudgetDelegationRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;
}

/**
 * Compact site reference embedded in Budget responses.
 */
export class BudgetSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;
}

/**
 * Compact billing-entity (CdC) reference embedded in Budget responses.
 */
export class BudgetBillingEntityRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  delegationId?: string | null;
}

/**
 * Compact parent-budget reference (hierarchy).
 *
 * `amount` is declared as `number` (not `string | number`) so reflect-
 * metadata pins the type to `Number`, letting class-transformer's
 * `enableImplicitConversion` route through `Number(value)` →
 * `Decimal.valueOf()`, which returns a clean JS number. A union type
 * resolves to `Object` in metadata and bypasses the conversion entirely,
 * leaving the Decimal's `{s,e,d}` internals on the wire — see the
 * dedicated runtime smoke in reliquats-dto-shape.spec for the
 * regression net.
 */
export class BudgetParentRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiProperty({ description: 'Decimal(12,2) — coerced to JS number via Decimal.valueOf()' })
  @Expose()
  amount!: number;
}

/**
 * `_count` aggregate exposed on Budget rows.
 */
export class BudgetCountsResponseDto {
  @ApiProperty()
  @Expose()
  children!: number;
}

/**
 * Budget entity exposed by all CRUD endpoints. Cas C — Prisma scalars +
 * delegation/site/billingEntity/parent refs + `_count` passthrough.
 *
 * Decimal fields (`amount`) are exposed as `string | number` because
 * Prisma serialises Decimal(12,2) to a string by default; the wire JSON
 * therefore carries `"40000.00"` rather than `40000`. The frontend
 * already coerces both shapes (cf budgets table page).
 */
export class BudgetResponseDto {
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
  delegationId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  siteId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  billingEntityId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'ExpenseType — optional narrowing filter' })
  @Expose()
  expenseType?: string | null;

  @ApiProperty({ description: 'YEAR | QUARTER | MONTH' })
  @Expose()
  period!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  startDate!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  endDate!: Date;

  @ApiProperty({ description: 'Decimal(12,2) — coerced to JS number via Decimal.valueOf()' })
  @Expose()
  amount!: number;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional()
  @Expose()
  alertsEnabled?: boolean;

  @ApiPropertyOptional()
  @Expose()
  alertThresholdPct?: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  parentId?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => BudgetDelegationRefResponseDto, nullable: true })
  @Expose()
  @Type(() => BudgetDelegationRefResponseDto)
  delegation?: BudgetDelegationRefResponseDto | null;

  @ApiPropertyOptional({ type: () => BudgetSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => BudgetSiteRefResponseDto)
  site?: BudgetSiteRefResponseDto | null;

  @ApiPropertyOptional({ type: () => BudgetBillingEntityRefResponseDto, nullable: true })
  @Expose()
  @Type(() => BudgetBillingEntityRefResponseDto)
  billingEntity?: BudgetBillingEntityRefResponseDto | null;

  @ApiPropertyOptional({ type: () => BudgetParentRefResponseDto, nullable: true })
  @Expose()
  @Type(() => BudgetParentRefResponseDto)
  parent?: BudgetParentRefResponseDto | null;

  @ApiPropertyOptional({
    type: () => BudgetCountsResponseDto,
    description: 'Prisma `_count` aggregate — passthrough via @Transform({obj}) since the underscore prefix breaks @Expose discovery.',
  })
  @Expose({ name: '_count' })
  @Transform(({ obj }) => obj?._count ?? null, { toClassOnly: true })
  _count?: BudgetCountsResponseDto | null;
}
