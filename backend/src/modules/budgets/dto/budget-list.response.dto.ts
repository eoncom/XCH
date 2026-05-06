import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { BudgetResponseDto } from './budget.response.dto';

export class BudgetListPageMetaResponseDto {
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
 * Paginated response for `GET /budgets`. Cas C composite — `data + meta`.
 */
export class BudgetListResponseDto {
  @ApiProperty({ type: () => [BudgetResponseDto] })
  @Expose()
  @Type(() => BudgetResponseDto)
  data!: BudgetResponseDto[];

  @ApiProperty({ type: () => BudgetListPageMetaResponseDto })
  @Expose()
  @Type(() => BudgetListPageMetaResponseDto)
  meta!: BudgetListPageMetaResponseDto;
}
