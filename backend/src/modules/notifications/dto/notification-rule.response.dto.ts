import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { NotificationChannelKind, NotificationEventType } from '@prisma/client';

/**
 * NotificationRule exposed by `GET /notifications/config`.
 * Cas A — direct from `shapeRuleForApi`.
 */
export class NotificationRuleResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: NotificationEventType })
  @Expose()
  eventType!: NotificationEventType;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ enum: NotificationChannelKind, isArray: true })
  @Expose()
  channels!: NotificationChannelKind[];
}

/**
 * Variant returned by `GET /notifications/config/resolved` — same payload
 * as `NotificationRuleResponseDto` plus a `source` flag indicating which
 * scope produced this rule (delegation > global > default fallback).
 *
 * Cas A — direct from `toResolvedRule` helper. Note: `id` is absent for
 * default-fallback rules because no row exists.
 */
export class NotificationResolvedRuleResponseDto {
  @ApiProperty({ enum: NotificationEventType })
  @Expose()
  eventType!: NotificationEventType;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ enum: NotificationChannelKind, isArray: true })
  @Expose()
  channels!: NotificationChannelKind[];

  @ApiProperty({ enum: ['global', 'delegation', 'default'] })
  @Expose()
  source!: 'global' | 'delegation' | 'default';
}
