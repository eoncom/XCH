import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `GET /tenants/electricity-config` and
 * `PATCH /tenants/electricity-config`.
 * Cas A — direct service shape.
 */
export class TenantElectricityConfigResponseDto {
  @ApiProperty({ description: 'Cost per kWh in the tenant currency' })
  @Expose()
  costPerKwh!: number;

  @ApiProperty({ description: 'Currency ISO code (EUR, USD, …)' })
  @Expose()
  currency!: string;
}
