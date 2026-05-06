import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AssetResponseDto } from './asset.response.dto';

export class AssetListPageMetaResponseDto {
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
 * Paginated response for `GET /assets`. Cas C composite — `data + meta`.
 */
export class AssetListResponseDto {
  @ApiProperty({ type: () => [AssetResponseDto] })
  @Expose()
  @Type(() => AssetResponseDto)
  data!: AssetResponseDto[];

  @ApiProperty({ type: () => AssetListPageMetaResponseDto })
  @Expose()
  @Type(() => AssetListPageMetaResponseDto)
  meta!: AssetListPageMetaResponseDto;
}
