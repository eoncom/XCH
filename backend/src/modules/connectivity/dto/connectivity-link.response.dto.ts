import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ConnectivityRole, ExpenseFrequency } from '@prisma/client';

/**
 * Compact site reference embedded in ConnectivityLink responses.
 */
export class ConnectivitySiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  delegationId?: string | null;
}

/**
 * Compact asset reference embedded in ConnectivityLink responses.
 */
export class ConnectivityAssetRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  serialNumber?: string | null;
}

/**
 * Compact expense reference embedded in ConnectivityLink responses.
 */
export class ConnectivityExpenseRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  label!: string;

  @ApiProperty({ description: 'Decimal serialised as string in JSON' })
  @Expose()
  totalAmount!: string | number;

  @ApiProperty({ enum: ExpenseFrequency })
  @Expose()
  frequency!: ExpenseFrequency;
}

/**
 * ConnectivityLink response — used by `findOne`, `findAll`, `create`, `update`,
 * `generateExpense`.
 *
 * Cas C (cf `common/dto/response/README.md`) : Prisma entity with includes
 * (site + asset + expense). Maps via `plainToInstance` + `@Type()` on each
 * relation.
 */
export class ConnectivityLinkResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty({ enum: ConnectivityRole })
  @Expose()
  role!: ConnectivityRole;

  @ApiProperty()
  @Expose()
  provider!: string;

  @ApiProperty({ description: 'FIBER | ADSL | 4G | 5G | STARLINK | ...' })
  @Expose()
  type!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  bandwidthDown!: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  bandwidthUp!: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  publicIp!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Decimal(10,2) serialised as string in JSON',
  })
  @Expose()
  monthlyPrice!: string | number | null;

  @ApiProperty()
  @Expose()
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  startDate!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  endDate!: Date | null;

  @ApiProperty({ nullable: true })
  @Expose()
  contractRef!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  notes!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  assetId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  expenseId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => ConnectivitySiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ConnectivitySiteRefResponseDto)
  site?: ConnectivitySiteRefResponseDto | null;

  @ApiPropertyOptional({ type: () => ConnectivityAssetRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ConnectivityAssetRefResponseDto)
  asset?: ConnectivityAssetRefResponseDto | null;

  @ApiPropertyOptional({ type: () => ConnectivityExpenseRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ConnectivityExpenseRefResponseDto)
  expense?: ConnectivityExpenseRefResponseDto | null;
}

/**
 * Returned by `PATCH /connectivity/:id/resync-expense`. Three fields :
 * the updated expense (compact ref — full Expense DTO is migrated by PR #14),
 * `before` and `after` totalAmount values for confirmation toast UI side.
 *
 * Cas C — `plainToInstance` + `@Type()` on the embedded expense ref.
 */
export class ConnectivityResyncExpenseResponseDto {
  @ApiProperty({ type: () => ConnectivityExpenseRefResponseDto })
  @Expose()
  @Type(() => ConnectivityExpenseRefResponseDto)
  expense!: ConnectivityExpenseRefResponseDto;

  @ApiProperty({ description: 'totalAmount before the resync' })
  @Expose()
  before!: number;

  @ApiProperty({ description: 'totalAmount after the resync' })
  @Expose()
  after!: number;
}

