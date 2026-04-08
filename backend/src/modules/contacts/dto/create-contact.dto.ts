import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({
    description: 'Contact name',
    example: 'Acme Corporation',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Contact type ID',
    example: 'clxxxxxxxxxxxxx',
  })
  @IsString()
  @IsNotEmpty()
  typeId: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'contact@acme.com',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+33 1 23 45 67 89',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Mobile phone number',
    example: '+33 6 12 34 56 78',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mobile?: string;

  @ApiPropertyOptional({
    description: 'Physical address',
    example: '123 Main St, Paris, France',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Company name (for person contacts)',
    example: 'Acme Corporation',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @ApiPropertyOptional({
    description: 'Role or job title',
    example: 'Sales Manager',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Preferred supplier for network equipment',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Delegation ID (null = global, R2/R3)',
  })
  @IsOptional()
  @IsString()
  delegationId?: string;

  @ApiPropertyOptional({
    description: 'Site ID — optional site-level attachment (R1/R3)',
  })
  @IsOptional()
  @IsString()
  siteId?: string;
}
