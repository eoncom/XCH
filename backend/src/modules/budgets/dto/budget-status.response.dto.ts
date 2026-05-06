import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { BudgetResponseDto } from './budget.response.dto';

/**
 * Response for `GET /budgets/:id/status`. Composite of the Budget row +
 * computed spent/remaining figures + the matching expenses array
 * (passthrough — typed by the expenses module DTOs in PR #14).
 *
 * Decimal-related fields (`spent`, `remaining`, `budgeted`) come back as
 * plain numbers from the service (it does Math.round(x*100)/100), so the
 * wire shape is stable JSON numbers, not strings.
 */
export class BudgetStatusResponseDto {
  @ApiProperty({ type: () => BudgetResponseDto })
  @Expose()
  @Type(() => BudgetResponseDto)
  budget!: BudgetResponseDto;

  @ApiProperty({ description: 'Budget cap (Number, computed from budget.amount)' })
  @Expose()
  budgeted!: number;

  @ApiProperty({ description: 'Total spent so far (already rounded to 2 decimals)' })
  @Expose()
  spent!: number;

  @ApiProperty({ description: 'Remaining = budgeted − spent (already rounded to 2 decimals)' })
  @Expose()
  remaining!: number;

  @ApiProperty({ description: '0..100 — Math.round((spent / budgeted) * 100). 0 when budgeted ≤ 0.' })
  @Expose()
  progressPct!: number;

  @ApiProperty()
  @Expose()
  overBudget!: boolean;

  @ApiProperty({ description: 'budget.alertsEnabled && progressPct ≥ budget.alertThresholdPct' })
  @Expose()
  thresholdReached!: boolean;

  @ApiProperty({
    description: 'Matching expenses (passthrough — typed by expenses module DTOs, see PR #14). Read from source plain via @Transform({obj}).',
  })
  @Expose()
  @Transform(({ obj }) => obj?.expenses ?? [], { toClassOnly: true })
  expenses!: unknown[];
}

/**
 * Response for `DELETE /budgets/:id` — service returns `{ deleted: true }`.
 */
export class BudgetDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  deleted!: boolean;
}
