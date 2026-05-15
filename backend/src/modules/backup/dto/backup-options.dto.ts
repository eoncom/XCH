import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for `POST /backup/estimate` and `POST /backup/full` (v2).
 *
 * Track D.1 — Backup v2 Core. Defaults match the pre-v2 behaviour:
 * full backup (db + files) when `dbOnly` is unset or false.
 */
export class BackupOptionsDto {
  @ApiProperty({
    required: false,
    default: false,
    description:
      'When true, skip MinIO files and back up DB metadata only. ' +
      'Smaller archive, faster, but restore will leave file refs dangling.',
  })
  @IsBoolean()
  @IsOptional()
  dbOnly?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'When true, encrypt the backup ZIP with AES-256-GCM streaming (Track D.2). ' +
      'A sidecar `<filename>.enc.json` is co-located in xch-backups with the IV, ' +
      'auth tag and key version (sidecar versionning `version: 1` for future crypto agility). ' +
      'Requires XCH_MASTER_KEY (ADR-019). Verify via `GET /backup/capabilities`.',
  })
  @IsBoolean()
  @IsOptional()
  encrypt?: boolean;
}
