import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { TenantStatus } from '@prisma/client';

/**
 * Tenant entity exposed by `GET /tenants/current` and `PATCH /tenants/current`.
 *
 * Cas C — Prisma scalars + assembled `config` shape (passthrough via
 * @Transform({obj}) since the config composite is built dynamically from
 * 7 typed tables ; full sub-DTO graph is documented in
 * tenant-current-config.response.dto.ts).
 */
export class TenantResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  slug?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  logoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  primaryColor?: string | null;

  @ApiProperty({ enum: TenantStatus })
  @Expose()
  status!: TenantStatus;

  @ApiProperty({ description: 'Allow internal-network probe targets (10/8, 192.168/16, …)' })
  @Expose()
  allowInternalNetworkTargets!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({
    description:
      'Backwards-compat config envelope (appearance + branding + sso safe + security + integrations + modules)',
  })
  @Expose()
  @Transform(({ obj }) => obj?.config ?? undefined, { toClassOnly: true })
  config?: unknown;
}
