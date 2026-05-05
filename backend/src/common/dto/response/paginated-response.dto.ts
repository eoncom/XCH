import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Generic paginated response shape (cursor-based pagination, ADR-023 §3).
 *
 * The keyset/cursor flavor used by `MonitorsService.history` is the canonical
 * pattern in XCH (S5 PR4 R1) — opaque cursor + hasNext flag, no total count.
 *
 * Concrete subclasses materialise the `items` field with the correct DTO type
 * for Swagger generation, since generics aren't reflected at runtime.
 *
 * Example :
 *   export class MonitorHistoryResponseDto
 *     extends PaginatedResponseDto<MonitorHistoryItemResponseDto> {
 *     @ApiProperty({ type: [MonitorHistoryItemResponseDto] })
 *     @Type(() => MonitorHistoryItemResponseDto)
 *     @Expose()
 *     declare items: MonitorHistoryItemResponseDto[];
 *   }
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, description: 'Page items (concrete DTO type set by subclass)' })
  @Expose()
  items!: T[];

  @ApiProperty({ description: 'Page size requested by the client' })
  @Expose()
  limit!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Opaque cursor for the next page (null when no further page)',
  })
  @Expose()
  nextCursor!: string | null;

  @ApiProperty({ description: 'True iff a further page exists' })
  @Expose()
  hasNext!: boolean;
}
