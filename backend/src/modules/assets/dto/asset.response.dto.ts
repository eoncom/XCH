import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

/**
 * Compact site reference embedded in Asset responses.
 */
export class AssetSiteRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}

/**
 * Compact rack reference embedded in Asset responses.
 */
export class AssetRackRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;
}

/**
 * Asset entity exposed by all CRUD endpoints + import + batch + stats.
 *
 * Cas C strict — entité Prisma avec ~30 champs scalaires + relations
 * (site / rack / assetModel / pins / tasks / movements / connectivityLinks /
 * sdwanRoles / photos / externalRefs). Le DTO whitelist explicit chaque
 * champ scalaire pour anti-leak garanti (type A risque le plus élevé).
 *
 * Sous-relations passthrough via @Transform({obj}) pour les types qui sont
 * typés dans d'autres PRs cascade :
 *   - assetModel : PR #13 asset-models
 *   - pins, tasks, movements, sdwan, photos : déjà typés ou hors-scope
 *
 * Champs sensibles potentiels (qrCodeToken) : @Expose() explicite avec
 * commentaire — le token est utilisé pour validation server-side, sa
 * fuite ne compromet pas l'auth (pas de credential).
 */
export class AssetResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  delegationId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty({ description: 'Asset type (dynamic via EnumLabel)' })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  model?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  manufacturer?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  serialNumber?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  inventoryTag?: string | null;

  @ApiProperty({ description: 'Asset status (dynamic via EnumLabel)' })
  @Expose()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  assetModelId?: string | null;

  @ApiProperty({ nullable: true, description: 'Decimal(10,2) serialised as string' })
  @Expose()
  acquisitionPrice!: string | number | null;

  @ApiProperty({ nullable: true, description: 'Decimal(10,2) serialised as string' })
  @Expose()
  monthlyPrice!: string | number | null;

  @ApiProperty()
  @Expose()
  priceCurrency!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  locationText?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  ip?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  mac?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  hostname?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  vlan?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  port?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  rackId?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  rackPositionU?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  rackHeightU?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  rackNotes?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Base64 data URL of the QR code image (large field)',
  })
  @Expose()
  qrCodeUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Token used by /api/assets/:id/scan for server-side validation (not a credential)',
  })
  @Expose()
  qrCodeToken?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  purchaseDate?: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  warrantyEnd?: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  weight?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  powerConsumption?: number | null;

  @ApiProperty({ description: 'Effective usage % (0-100) for consumption estimation' })
  @Expose()
  dutyCyclePercent!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

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

  // ──────────────────────────────────────────────────────────────────────
  // Embedded relations
  // ──────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ type: () => AssetSiteRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AssetSiteRefResponseDto)
  site?: AssetSiteRefResponseDto | null;

  @ApiPropertyOptional({ type: () => AssetRackRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AssetRackRefResponseDto)
  rack?: AssetRackRefResponseDto | null;

  // ──────────────────────────────────────────────────────────────────────
  // Passthrough relations (typed in other cascade PRs)
  // ──────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'AssetModel reference (passthrough — typed in PR #13)' })
  @Expose()
  @Transform(({ obj }) => obj?.assetModel ?? null, { toClassOnly: true })
  assetModel?: unknown;

  @ApiPropertyOptional({ description: 'Pins on floor plans (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.pins ?? undefined, { toClassOnly: true })
  pins?: unknown;

  @ApiPropertyOptional({ description: 'Linked tasks (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.tasks ?? undefined, { toClassOnly: true })
  tasks?: unknown;

  @ApiPropertyOptional({ description: 'Movement history (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.movements ?? undefined, { toClassOnly: true })
  movements?: unknown;

  @ApiPropertyOptional({ description: 'Connectivity links terminating on this asset (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.connectivityLinks ?? undefined, { toClassOnly: true })
  connectivityLinks?: unknown;

  @ApiPropertyOptional({ description: 'External integration refs (NetBox / etc.) — passthrough' })
  @Expose()
  @Transform(({ obj }) => obj?.externalRefs ?? undefined, { toClassOnly: true })
  externalRefs?: unknown;

  @ApiPropertyOptional({ description: 'Photos (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.photos ?? undefined, { toClassOnly: true })
  photos?: unknown;

  @ApiPropertyOptional({ description: 'SD-WAN role assignments (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.sdwanRoles ?? undefined, { toClassOnly: true })
  sdwanRoles?: unknown;

  @ApiPropertyOptional({
    description: 'Auto-disabled monitor count (transient field on update response)',
  })
  @Expose()
  @Transform(({ obj }) => obj?.disabledMonitorCount, { toClassOnly: true })
  disabledMonitorCount?: number;
}
