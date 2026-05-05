import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class FloorPlanPdfPageThumbnailResponseDto {
  @ApiProperty({ description: '1-based page index' })
  @Expose()
  page!: number;

  @ApiProperty({ description: 'Base64 data-URL thumbnail' })
  @Expose()
  thumbnail!: string;
}

/**
 * Response for `POST /floor-plans/inspect-pdf`. Cas C composite.
 */
export class FloorPlanPdfInspectResponseDto {
  @ApiProperty()
  @Expose()
  pageCount!: number;

  @ApiProperty({ type: () => [FloorPlanPdfPageThumbnailResponseDto] })
  @Expose()
  @Type(() => FloorPlanPdfPageThumbnailResponseDto)
  pages!: FloorPlanPdfPageThumbnailResponseDto[];
}
