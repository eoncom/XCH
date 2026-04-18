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
   * v1.4.x — kept as a raw string because `ValidationPipe` with
   * `enableImplicitConversion:true` converts any non-empty string to `true`
   * when the target type is `boolean` (`Boolean("false")` → `true`). By
   * declaring the field as `string`, we short-circuit the implicit conversion
   * and let `contacts.service.ts` do the actual semantic parsing (accepts
   * "false" / "0" to opt out, anything else treated as include-global).
   *
   * Default when omitted: global contacts ARE included (matches the product
   * rule that global contacts appear everywhere).
   */
  @ApiPropertyOptional({
    description: 'Include global contacts (delegationId=null) in results. Pass "false" to opt out.',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsString()
  includeGlobal?: string;
}
