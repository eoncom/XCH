import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { NotificationChannelResponseDto } from './notification-channel.response.dto';
import { NotificationRuleResponseDto } from './notification-rule.response.dto';

/**
 * Scope reference embedded in the settings response.
 */
export class NotificationScopeResponseDto {
  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  delegationId!: string | null;
}

/**
 * Composite response for `GET /notifications/config(.../delegationId|?delegationId=…)`
 * and `PUT /notifications/config`.
 *
 * Cas C — composite shape (scope + channels[] + rules[] + isDefault) with
 * `@Type` on each array element.
 */
export class NotificationSettingsResponseDto {
  @ApiProperty({ type: () => NotificationScopeResponseDto })
  @Expose()
  @Type(() => NotificationScopeResponseDto)
  scope!: NotificationScopeResponseDto;

  @ApiProperty({ type: () => [NotificationChannelResponseDto] })
  @Expose()
  @Type(() => NotificationChannelResponseDto)
  channels!: NotificationChannelResponseDto[];

  @ApiProperty({ type: () => [NotificationRuleResponseDto] })
  @Expose()
  @Type(() => NotificationRuleResponseDto)
  rules!: NotificationRuleResponseDto[];

  @ApiProperty({
    description: 'True iff no row exists at this scope (defaults are inherited)',
  })
  @Expose()
  isDefault!: boolean;
}

/**
 * Response for `GET /notifications/configs` (super-admin overview across
 * every scope). No `scope` field — both arrays carry their own `delegationId`
 * via the channel/rule rows themselves.
 */
export class NotificationAllSettingsResponseDto {
  @ApiProperty({ type: () => [NotificationChannelResponseDto] })
  @Expose()
  @Type(() => NotificationChannelResponseDto)
  channels!: NotificationChannelResponseDto[];

  @ApiProperty({ type: () => [NotificationRuleResponseDto] })
  @Expose()
  @Type(() => NotificationRuleResponseDto)
  rules!: NotificationRuleResponseDto[];
}
