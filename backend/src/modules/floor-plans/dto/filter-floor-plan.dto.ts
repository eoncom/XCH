import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterFloorPlanDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt', 'version', 'siteId'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'version', 'siteId'])
  sortBy?: string;
}
