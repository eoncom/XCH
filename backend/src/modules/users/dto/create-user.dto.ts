import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: ['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER'], default: 'VIEWER' })
  @IsEnum(['ADMIN', 'MANAGER', 'TECHNICIEN', 'VIEWER'])
  @IsOptional()
  role?: 'ADMIN' | 'MANAGER' | 'TECHNICIEN' | 'VIEWER';

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
