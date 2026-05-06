import { ApiProperty } from '@nestjs/swagger';

/**
 * Marker DTOs for the report/projection endpoints. Composite aggregates
 * with dynamic group-by keys → passthrough.
 */

export class ExpenseReportByBearerResponseDto {
  @ApiProperty({ description: 'Per-bearer total (passthrough composite)' })
  readonly _marker?: unknown;
}

export class ExpenseReportByMonthResponseDto {
  @ApiProperty({ description: 'Monthly spending evolution (passthrough composite)' })
  readonly _marker?: unknown;
}

export class ExpenseReportByTargetResponseDto {
  @ApiProperty({ description: 'Per-target total (passthrough composite)' })
  readonly _marker?: unknown;
}

export class ExpenseReportChargebackResponseDto {
  @ApiProperty({ description: 'Chargeback detail (passthrough composite)' })
  readonly _marker?: unknown;
}

export class ExpenseProjectionResponseDto {
  @ApiProperty({
    description:
      'Projected expenses over a date range, optionally grouped by type/delegation/site (passthrough)',
  })
  readonly _marker?: unknown;
}
