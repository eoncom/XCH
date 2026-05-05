import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { MonitorStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/response';

/**
 * One row of MonitorResult exposed via `GET /monitors/:id/history`.
 *
 * Cas C (cf `common/dto/response/README.md`) — Prisma entity exposed via
 * `plainToInstance`. Generic page envelope concretised in
 * `MonitorHistoryResponseDto` below since NestJS Swagger does not reflect
 * generics at runtime.
 */
export class MonitorHistoryItemResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  checkId!: string;

  @ApiProperty({ enum: MonitorStatus })
  @Expose()
  status!: MonitorStatus;

  @ApiProperty({ nullable: true })
  @Expose()
  responseMs!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  error?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  checkedAt!: Date;
}

/**
 * Concrete paginated envelope for the history endpoint. Subclasses
 * `PaginatedResponseDto` purely so Swagger can render the array element type.
 */
export class MonitorHistoryResponseDto extends PaginatedResponseDto<MonitorHistoryItemResponseDto> {
  @ApiProperty({ type: () => [MonitorHistoryItemResponseDto] })
  @Expose()
  @Type(() => MonitorHistoryItemResponseDto)
  declare items: MonitorHistoryItemResponseDto[];
}
