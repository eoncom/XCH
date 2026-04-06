import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ContactCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryContactDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by contact type ID',
    example: 'clxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by contact category',
    enum: ContactCategory,
    example: ContactCategory.PROVIDER,
  })
  @IsOptional()
  @IsEnum(ContactCategory)
  category?: ContactCategory;

  @ApiPropertyOptional({
    description: 'Search by name, email, or company (case-insensitive)',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Direct filter: exact scope type' })
  @IsOptional()
  @IsString()
  scopeType?: string;

  @ApiPropertyOptional({ description: 'Direct filter: exact scope ID' })
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiPropertyOptional({ description: 'Hierarchical filter: show contacts visible at this scope type (includes global + ancestors)' })
  @IsOptional()
  @IsString()
  forScopeType?: string;

  @ApiPropertyOptional({ description: 'Hierarchical filter: scope ID' })
  @IsOptional()
  @IsString()
  forScopeId?: string;
}
