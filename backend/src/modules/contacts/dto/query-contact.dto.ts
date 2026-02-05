import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ContactCategory } from '@prisma/client';

export class QueryContactDto {
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
  @IsString()
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
}
