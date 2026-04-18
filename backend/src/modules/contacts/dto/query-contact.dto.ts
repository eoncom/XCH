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

  @ApiPropertyOptional({ description: 'Filter by delegation ID' })
  @IsOptional()
  @IsString()
  delegationId?: string;

  @ApiPropertyOptional({ description: 'Filter by site ID' })
  @IsOptional()
  @IsString()
  siteId?: string;

  /**
   * Include global contacts (delegationId=null) in results when filtering by delegation.
   *
   * v1.4.x fix — ValidationPipe has `enableImplicitConversion:true` in main.ts,
   * so a URL query string "true" is ALREADY converted to boolean `true` before
   * class-transformer runs. The old `@Transform(({value}) => value === 'true')`
   * then received a boolean and produced `true === 'true'` → `false`, which made
   * `includeGlobal=true` silently behave like `includeGlobal=false` and hid all
   * global providers from the vendor combobox. This transform now handles both
   * booleans and strings so either shape works.
   */
  @ApiPropertyOptional({ description: 'Include global contacts (delegationId=null) in results' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      return v === 'true' || v === '1' || v === 'yes';
    }
    return undefined;
  })
  @IsBoolean()
  includeGlobal?: boolean;
}
