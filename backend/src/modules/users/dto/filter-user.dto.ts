import { IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterUserDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'name', 'email', 'role'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'name', 'email', 'role'])
  sortBy?: string;
}
