import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterExpenseDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by expense type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by bearer ID' })
  @IsOptional()
  @IsString()
  bearerId?: string;

  @ApiPropertyOptional({ description: 'Filter by target ID (via allocations)' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Filter expenses from this date (ISO)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter expenses up to this date (ISO)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Search by label, vendor, or external ref' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by scope type (direct)' })
  @IsOptional()
  @IsString()
  scopeType?: string;

  @ApiPropertyOptional({ description: 'Filter by scope ID (direct)' })
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiPropertyOptional({ description: 'Hierarchical scope filter type' })
  @IsOptional()
  @IsString()
  forScopeType?: string;

  @ApiPropertyOptional({ description: 'Hierarchical scope filter ID' })
  @IsOptional()
  @IsString()
  forScopeId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor contact ID' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['dateIncurred', 'totalAmount', 'label', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['dateIncurred', 'totalAmount', 'label', 'createdAt'])
  sortBy?: string;
}
