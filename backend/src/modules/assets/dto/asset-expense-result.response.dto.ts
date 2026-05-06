import { ApiProperty } from '@nestjs/swagger';

/**
 * Marker-only DTO for `POST /assets/:id/generate-expense` and
 * `PATCH /assets/:id/expenses/:expenseId/resync`. Mirrors the Expense
 * entity shape (or `{ expense, before, after }` for resync) — strict
 * Expense DTO lands in PR #14. No runtime mapping ; service returns
 * a Prisma-typed payload directly. Anti-leak guarantee comes from the
 * service layer (Prisma `select` / `EXPENSE_INCLUDE`).
 */
export class AssetExpenseResultResponseDto {
  @ApiProperty({ description: 'Expense entity (or resync envelope) — shape typed in PR #14' })
  readonly _marker?: unknown;
}
