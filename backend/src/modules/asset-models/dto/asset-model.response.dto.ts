import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * AssetModel entity exposed by all CRUD endpoints. Tenant-wide catalog.
 * Cas A — Prisma scalars whitelist explicit.
 */
export class AssetModelResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  manufacturer?: string | null;

  @ApiProperty({ description: 'AssetType (dynamic via EnumLabel)' })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  vendorCatalogId?: string | null;

  @ApiProperty({ nullable: true, description: 'Decimal(10,2) — one-time purchase price' })
  @Expose()
  acquisitionPrice!: string | number | null;

  @ApiProperty({ nullable: true, description: 'Decimal(10,2) — monthly rental/lease' })
  @Expose()
  monthlyPrice!: string | number | null;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiProperty({ enum: ['ONE_TIME', 'MONTHLY'] })
  @Expose()
  pricingMode!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  powerConsumption?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  weight?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  defaultUHeight?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  wifiCoverageRadius?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  wifiFrequency?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  wifiAntennaType?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  wifiTxPowerDbm?: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;
}
