import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single module entry returned by `GET /tenants/modules`.
 */
export class TenantModuleResponseDto {
  @ApiProperty({ description: 'Module key (sites, assets, racks, …)' })
  @Expose()
  key!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiProperty()
  @Expose()
  description!: string;

  @ApiProperty()
  @Expose()
  enabled!: boolean;
}

/**
 * Response for `GET /tenants/modules` and `PATCH /tenants/modules`.
 * Cas C composite — `@Type` on `modules[]`.
 */
export class TenantModulesResponseDto {
  @ApiProperty({ type: () => [TenantModuleResponseDto] })
  @Expose()
  @Type(() => TenantModuleResponseDto)
  modules!: TenantModuleResponseDto[];
}
