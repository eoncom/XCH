import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { SiteResponseDto } from './site.response.dto';

/**
 * Page meta for `GET /sites` (legacy page/pageSize/total form).
 */
export class SiteListPageMetaResponseDto {
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
 * Paginated response for `GET /sites`.
 * Cas C composite — `@Type` on `data[]` and `meta`.
 */
export class SiteListResponseDto {
  @ApiProperty({ type: () => [SiteResponseDto] })
  @Expose()
  @Type(() => SiteResponseDto)
  data!: SiteResponseDto[];

  @ApiProperty({ type: () => SiteListPageMetaResponseDto })
  @Expose()
  @Type(() => SiteListPageMetaResponseDto)
  meta!: SiteListPageMetaResponseDto;
}
