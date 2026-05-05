import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { NotificationChannelKind } from '@prisma/client';
import { NotificationResolvedRuleResponseDto } from './notification-rule.response.dto';

/**
 * Runtime channel config returned by `GET /notifications/config/resolved`.
 * Decrypted webhookUrl included so the UI debug pane can show the effective
 * value for the current scope.
 */
export class NotificationResolvedChannelResponseDto {
  @ApiProperty({ enum: NotificationChannelKind })
  @Expose()
  kind!: NotificationChannelKind;

  @ApiProperty({ type: [String] })
  @Expose()
  recipients!: string[];

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  webhookUrl!: string | null;

  @ApiProperty()
  @Expose()
  enabled!: boolean;
}

/**
 * Composite response for `GET /notifications/config/resolved` —
 * post-inheritance view used by the UI debug pane.
 *
 * Cas C — composite (channels runtime + rules with source flag).
 */
export class NotificationResolvedSettingsResponseDto {
  @ApiProperty({ type: () => [NotificationResolvedChannelResponseDto] })
  @Expose()
  @Type(() => NotificationResolvedChannelResponseDto)
  channels!: NotificationResolvedChannelResponseDto[];

  @ApiProperty({ type: () => [NotificationResolvedRuleResponseDto] })
  @Expose()
  @Type(() => NotificationResolvedRuleResponseDto)
  rules!: NotificationResolvedRuleResponseDto[];
}
