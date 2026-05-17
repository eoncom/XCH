import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

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
  byType!: Record<string, { count: number; total: number }>;
}

// Usage note (added 2026-05-17 after Pass 5 drill CI gap surfaced
// dto-shape.spec.ts:92 latent failure) — this DTO is a Swagger marker only.
// `expenses.controller.ts::summary()` returns `expensesService.summary(...)`
// directly, and the global `ClassSerializerInterceptor` leaves plain-object
// responses untouched (cf `integration-passthrough.response.dto.ts` rationale).
// `byType` is therefore preserved end-to-end in prod ; the test that ran
// `toResponse(ExpensesSummaryResponseDto, ...)` against this class hit
// class-transformer's `excludeExtraneousValues + nested-untyped-Record`
// limitation, which does not represent the production wire shape.
