import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FloorPlanResponseDto } from './floor-plan.response.dto';

export class FloorPlanListPageMetaResponseDto {
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

export class FloorPlanListResponseDto {
  @ApiProperty({ type: () => [FloorPlanResponseDto] })
  @Expose()
  @Type(() => FloorPlanResponseDto)
  data!: FloorPlanResponseDto[];

  @ApiProperty({ type: () => FloorPlanListPageMetaResponseDto })
  @Expose()
  @Type(() => FloorPlanListPageMetaResponseDto)
  meta!: FloorPlanListPageMetaResponseDto;
}
