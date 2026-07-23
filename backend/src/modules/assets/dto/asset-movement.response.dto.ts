import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Single AssetMovement row returned by `GET /assets/:id/movements`.
 * Cas A — direct from `getMovementHistory`. The `from*` / `to*` references
 * (site / rack / user) are passthrough since they're typed in their own
 * cascade PRs.
 */
export class AssetMovementResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  assetId!: string;

  @ApiProperty({
    description: 'AssetMovementType (CREATED / SITE_CHANGE / RACK_MOUNT / ...)',
  })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  fromSiteId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  toSiteId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  fromRackId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  toRackId?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  fromRackPositionU?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  toRackPositionU?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  fromStatus?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  toStatus?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'User who triggered the movement' })
  @Expose()
  userId?: string | null;

  // NB : le modèle Prisma s'appelle `timestamp` (PAS createdAt) — la
  // première version de cette DTO exposait `createdAt`/`reason` qui
  // n'existent pas sur AssetMovement : type/date/notes disparaissaient du
  // wire et l'onglet Historique crashait (format(new Date(undefined))).
  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  timestamp!: Date;

  @ApiPropertyOptional({ description: 'fromSite reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.fromSite ?? null, { toClassOnly: true })
  fromSite?: unknown;

  @ApiPropertyOptional({ description: 'toSite reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.toSite ?? null, { toClassOnly: true })
  toSite?: unknown;

  @ApiPropertyOptional({ description: 'fromRack reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.fromRack ?? null, { toClassOnly: true })
  fromRack?: unknown;

  @ApiPropertyOptional({ description: 'toRack reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.toRack ?? null, { toClassOnly: true })
  toRack?: unknown;

  @ApiPropertyOptional({ description: 'User reference (passthrough)' })
  @Expose()
  @Transform(({ obj }) => obj?.user ?? null, { toClassOnly: true })
  user?: unknown;
}
