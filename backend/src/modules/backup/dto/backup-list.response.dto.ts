import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single entry in the backup catalog returned by `GET /backup/list`.
 * Cas A — direct shape produced by `BackupService.listBackups`.
 */
export class BackupListItemResponseDto {
  @ApiProperty({ description: 'AuditLog row id used as backup ID' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  filename!: string;

  @ApiProperty({ enum: ['full', 'site'] })
  @Expose()
  type!: 'full' | 'site';

  @ApiPropertyOptional({ type: String })
  @Expose()
  siteCode?: string;

  @ApiProperty({ description: 'Archive size in bytes (0 if unknown)' })
  @Expose()
  size!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Track D.2 — true if the archive is AES-256-GCM encrypted (sidecar `<filename>.enc.json` present in MinIO). UI surfaces a lock icon on the catalog row.',
  })
  @Expose()
  encrypted?: boolean;
}

/**
 * Response for `GET /backup/list` — wrapper exposing the catalog plus a
 * total count for UI display. Distinct from `PaginatedResponseDto<T>`
 * (cursor-based) — this catalog is small enough not to need pagination
 * (top-50 most recent backup logs).
 *
 * Cas C composite — `@Type` on `backups[]`.
 */
export class BackupListResponseDto {
  @ApiProperty({ type: () => [BackupListItemResponseDto] })
  @Expose()
  @Type(() => BackupListItemResponseDto)
  backups!: BackupListItemResponseDto[];

  @ApiProperty({ description: 'Total backups in the catalog (= backups.length)' })
  @Expose()
  total!: number;
}
