import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Aggregate over the full filtered set of expenses (no pagination slice).
 * Drives the costs page summary cards (B4 fix — test 2026-05-09): the
 * previous implementation summed only the first page of `/expenses`,
 * contradicting the by-month / by-bearer reports on the same view.
 *
 * `byType` is a passthrough composite — keys are dynamic (ExpenseType enum
 * values present in the filtered set), each value is `{ count, total }`.
 */
export class ExpensesSummaryResponseDto {
  @ApiProperty({ description: 'Sum of totalAmount across all matching expenses' })
  @Expose()
  totalAmount!: number;

  @ApiProperty({
    description:
      'Sum of cost_allocations.amount across all matching expenses (drives the "Total réparti" card so it stays coherent with totalAmount).',
  })
  @Expose()
  totalAllocated!: number;

  @ApiProperty({ description: 'Total count of matching expenses' })
  @Expose()
  count!: number;

  @ApiProperty({
    description:
      'Per-type breakdown — { [ExpenseType]: { count, total } } passthrough composite. Keys are dynamic (only types present in the filtered set appear).',
  })
  @Expose()
  // `excludeExtraneousValues: true` (toResponse helper) strips every property
  // on nested objects that lacks @Expose() — but `byType` is a dynamic
  // `Record<ExpenseType, ...>` with no inner class to decorate. Without
  // @Transform passthrough the value collapses to `{}` and the /expenses/summary
  // endpoint ships an empty breakdown to the Costs page (Pass 5 drill CI
  // surfaced this when `npm test` joined the integration job — backend unit
  // specs were never CI-run before).
  @Transform(({ value }) => value, { toClassOnly: true })
  byType!: Record<string, { count: number; total: number }>;
}
