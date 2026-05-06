import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AssetModelResponseDto } from './asset-model.response.dto';

export class AssetModelListPageMetaResponseDto {
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

export class AssetModelListResponseDto {
  @ApiProperty({ type: () => [AssetModelResponseDto] })
  @Expose()
  @Type(() => AssetModelResponseDto)
  data!: AssetModelResponseDto[];

  @ApiProperty({ type: () => AssetModelListPageMetaResponseDto })
  @Expose()
  @Type(() => AssetModelListPageMetaResponseDto)
  meta!: AssetModelListPageMetaResponseDto;
}
