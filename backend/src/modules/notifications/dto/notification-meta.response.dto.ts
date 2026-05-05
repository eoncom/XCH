import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { NotificationChannelKind, NotificationEventType } from '@prisma/client';

/**
 * Single event entry in the static catalog returned by `GET /notifications/meta`.
 * Mirrors `NOTIFICATION_EVENTS_META[eventType]` from `notification-events.ts`.
 */
export class NotificationEventMetaResponseDto {
  @ApiProperty()
  @Expose()
  label!: string;

  @ApiProperty({ description: 'Free-form description shown in UI tooltips' })
  @Expose()
  description!: string;

  @ApiProperty({ enum: NotificationChannelKind, isArray: true })
  @Expose()
  defaultChannels!: NotificationChannelKind[];

  @ApiProperty({ enum: ['tasks', 'sites', 'assets', 'monitoring', 'auth'] })
  @Expose()
  category!: 'tasks' | 'sites' | 'assets' | 'monitoring' | 'auth';
}

/**
 * Available delivery channel returned by `GET /notifications/meta` — built
 * by `NotificationService.getAvailableChannels()`.
 */
export class NotificationAvailableChannelResponseDto {
  @ApiProperty({ enum: NotificationChannelKind })
  @Expose()
  kind!: NotificationChannelKind;

  @ApiProperty({ description: 'Localised display label' })
  @Expose()
  label!: string;
}

/**
 * Composite response for `GET /notifications/meta` (static catalog used by
 * the UI to render the settings form).
 *
 * Cas B — composite shape mapped via the helper `toNotificationMetaResponseDto`
 * since `events` is a `Record<NotificationEventType, EventMeta>` (dynamic key
 * map). Helper maps it to a typed array form for Swagger.
 */
export class NotificationMetaResponseDto {
  @ApiProperty({
    description:
      'Event-type catalog as a record keyed by NotificationEventType — preserved over the wire as { TASK_ASSIGNED: {...}, ... } for backward compat.',
    additionalProperties: { $ref: '#/components/schemas/NotificationEventMetaResponseDto' },
  })
  @Expose()
  @Type(() => NotificationEventMetaResponseDto)
  events!: Record<NotificationEventType, NotificationEventMetaResponseDto>;

  @ApiProperty({ type: () => [NotificationAvailableChannelResponseDto] })
  @Expose()
  @Type(() => NotificationAvailableChannelResponseDto)
  channels!: NotificationAvailableChannelResponseDto[];
}

/**
 * Maps the runtime composite — Cas B — into the API contract shape. The
 * `events` record keys are `NotificationEventType`, kept stable on the wire
 * for the existing UI consumer.
 */
export function toNotificationMetaResponseDto(
  input: {
    events: Record<NotificationEventType, NotificationEventMetaResponseDto>;
    channels: NotificationAvailableChannelResponseDto[];
  },
): NotificationMetaResponseDto {
  return {
    events: input.events,
    channels: input.channels,
  };
}
