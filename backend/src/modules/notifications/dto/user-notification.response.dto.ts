import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * UserNotification entity exposed by the inbox endpoints.
 * Cas A — direct Prisma scalar mapping.
 */
export class UserNotificationResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty({ description: 'TASK_ASSIGNED | WARRANTY_EXPIRING | TASK_DUE_SOON | …' })
  @Expose()
  type!: string;

  @ApiProperty()
  @Expose()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  body?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Relative URL inside the app',
  })
  @Expose()
  link?: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;
}

/**
 * Result for `POST /notifications/inbox/mark-all-read` — number of rows
 * flipped from unread to read.
 */
export class UserNotificationMarkAllReadResponseDto {
  @ApiProperty({ description: 'Notifications marked as read' })
  @Expose()
  updated!: number;
}

/**
 * Result for `DELETE /notifications/inbox/:id` — `{ deleted: 0 }` if the
 * notification was not found / not owned by the caller, `{ deleted: 1 }`
 * otherwise. Numeric form preserved for backward compat with the existing
 * UI consumer (`if (res.deleted)`).
 */
export class UserNotificationRemoveResponseDto {
  @ApiProperty({ description: '0 if not found / not owned, 1 if removed' })
  @Expose()
  deleted!: number;
}
