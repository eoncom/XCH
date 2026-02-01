import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProviderType {
  TELECOM = 'TELECOM',
  INTERNET = 'INTERNET',
  CLOUD = 'CLOUD',
  HOSTING = 'HOSTING',
  OTHER = 'OTHER',
}

export class CreateProviderDto {
  @ApiProperty({ description: 'Provider name', example: 'Orange Business Services' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: ProviderType,
    description: 'Provider type',
    example: ProviderType.TELECOM
  })
  @IsEnum(ProviderType)
  type: ProviderType;

  @ApiProperty({
    required: false,
    description: 'Contact information (phone, email, etc.)',
    example: 'Service Client: 3900 | contact@orange-business.com'
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;

  @ApiProperty({
    required: false,
    description: 'Additional notes',
    example: 'Opérateur principal pour les liaisons FTTH et 4G backup'
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
