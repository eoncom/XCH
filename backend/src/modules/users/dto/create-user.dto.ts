import { IsEmail, IsString, IsOptional, IsBoolean, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  password?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({ default: 'local' })
  @IsString()
  @IsOptional()
  authProvider?: string;

  tenantId?: string;
}
