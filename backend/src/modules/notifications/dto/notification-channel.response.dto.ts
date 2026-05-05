import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { NotificationChannelKind } from '@prisma/client';

/**
 * NotificationChannel exposed by the settings endpoints (ADR-020).
 *
 * Cas A — `plainToInstance` direct on the API-shaped object the service
 * already produces (cf `shapeChannelForApi` in
 * `notification-settings.service.ts`). The webhookUrl is decrypted plaintext;
 * `webhookUrlSet` and `webhookUrlHint` are computed by the service for the
 * UI display.
 */
export class NotificationChannelResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: NotificationChannelKind })
  @Expose()
  kind!: NotificationChannelKind;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ type: [String] })
  @Expose()
  recipients!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Decrypted plaintext webhook URL (TEAMS only)',
  })
  @Expose()
  webhookUrl!: string | null;

  @ApiProperty({ description: 'True iff a webhookUrl is configured' })
  @Expose()
  webhookUrlSet!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Last-12-chars hint for UI confirmation (or null)',
  })
  @Expose()
  webhookUrlHint?: string | null;
}
