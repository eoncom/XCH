import { ApiProperty } from '@nestjs/swagger';

/**
 * Marker DTO for `GET /billing-entities/:id/summary` — totals
 * (passthrough, free-form aggregates depending on date filters).
 */
export class BillingEntitySummaryResponseDto {
  @ApiProperty({ description: 'Aggregated totals (currency / period / sum / count) — passthrough' })
  readonly _marker?: unknown;
}
