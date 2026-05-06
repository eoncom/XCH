import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ExpenseResponseDto } from './expense.response.dto';

export class ExpenseListPageMetaResponseDto {
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

export class ExpenseListResponseDto {
  @ApiProperty({ type: () => [ExpenseResponseDto] })
  @Expose()
  @Type(() => ExpenseResponseDto)
  data!: ExpenseResponseDto[];

  @ApiProperty({ type: () => ExpenseListPageMetaResponseDto })
  @Expose()
  @Type(() => ExpenseListPageMetaResponseDto)
  meta!: ExpenseListPageMetaResponseDto;
}
