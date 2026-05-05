import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RackResponseDto } from './rack.response.dto';

/**
 * Page meta returned by `GET /racks` (legacy page/pageSize/total form,
 * matches `common/interfaces/paginated.interface.ts:buildPaginatedResponse`).
 */
export class RackListPageMetaResponseDto {
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
 * Paginated response for `GET /racks`. Matches `PaginatedResponse<T>` from
 * `common/interfaces/paginated.interface.ts` (data + meta).
 *
 * Distinct from `PaginatedResponseDto<T>` (cursor-based) — racks list uses
 * the legacy page/pageSize form because the UI consumer expects it.
 *
 * Cas C composite — `@Type` on `data[]` and `meta`.
 */
export class RackListResponseDto {
  @ApiProperty({ type: () => [RackResponseDto] })
  @Expose()
  @Type(() => RackResponseDto)
  data!: RackResponseDto[];

  @ApiProperty({ type: () => RackListPageMetaResponseDto })
  @Expose()
  @Type(() => RackListPageMetaResponseDto)
  meta!: RackListPageMetaResponseDto;
}
