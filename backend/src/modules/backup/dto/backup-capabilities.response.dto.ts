import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Server-driven capability discovery for the backup module.
 *
 * Returned by `GET /backup/capabilities`. The frontend uses this to
 * grey out toggles whose backend prerequisites aren't met
 * (e.g. encryption requires `XCH_MASTER_KEY` set per ADR-019).
 *
 * Track D.2 Step 2 — see ADR-026 §1.
 */
export class BackupCapabilitiesResponseDto {
  @ApiProperty({
    description:
      'Whether AES-256-GCM streaming encryption is available (true ⇔ XCH_MASTER_KEY set on the backend).',
  })
  @Expose()
  encryption!: boolean;
}
