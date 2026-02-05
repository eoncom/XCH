import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ContactCategory } from '@prisma/client';

export class CreateContactTypeDto {
  @ApiProperty({
    description: 'Name of the contact type',
    example: 'Télécommunications',
    minLength: 1,
    maxLength: 50,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Category of the contact type',
    enum: ContactCategory,
    example: ContactCategory.PROVIDER,
  })
  @IsEnum(ContactCategory)
  category: ContactCategory;

  @ApiPropertyOptional({
    description: 'Hex color code for UI display',
    example: '#FF5733',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier for UI display',
    example: 'phone',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}
