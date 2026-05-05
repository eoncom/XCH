import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single NotificationLog entry returned by `GET /notifications/logs`.
 * Cas C — Prisma scalar entity.
 */
export class NotificationLogResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ description: 'Event type code (TASK_ASSIGNED, SITE_STATUS_CHANGED, …)' })
  @Expose()
  eventType!: string;

  @ApiProperty({ description: 'Channel used (email, teams)' })
  @Expose()
  channel!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  delegationId!: string | null;

  @ApiProperty({ description: 'Recipient (email or webhook URL)' })
  @Expose()
  recipient!: string;

  @ApiProperty()
  @Expose()
  subject!: string;

  @ApiProperty()
  @Expose()
  success!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  errorMessage?: string | null;

  @ApiPropertyOptional({
    description: 'Free-form context JSON (entityId, siteId, details…)',
  })
  @Expose()
  context?: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;
}

/**
 * Page meta returned alongside `data` by `GET /notifications/logs`.
 * Pre-S9 the service returned `{ data, meta: { total, page, pageSize, totalPages } }`,
 * shape preserved for backward compat.
 */
export class NotificationLogPageMetaResponseDto {
  @ApiProperty()
  @Expose()
  total!: number;

  @ApiProperty()
  @Expose()
  page!: number;

  @ApiProperty()
  @Expose()
  pageSize!: number;

  @ApiProperty()
  @Expose()
  totalPages!: number;
}

/**
 * Composite paginated response for `GET /notifications/logs`. Distinct from
 * `PaginatedResponseDto<T>` (cursor-based) — this endpoint uses the legacy
 * page/pageSize/total form because the UI consumer expects it.
 *
 * Cas C composite — `@Type` on `data[]` and `meta`.
 */
export class NotificationLogPageResponseDto {
  @ApiProperty({ type: () => [NotificationLogResponseDto] })
  @Expose()
  @Type(() => NotificationLogResponseDto)
  data!: NotificationLogResponseDto[];

  @ApiProperty({ type: () => NotificationLogPageMetaResponseDto })
  @Expose()
  @Type(() => NotificationLogPageMetaResponseDto)
  meta!: NotificationLogPageMetaResponseDto;
}
