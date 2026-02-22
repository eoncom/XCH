import { IsString, IsEmail, IsNotEmpty, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupDto {
  // Organization
  @ApiProperty({ example: 'Mon Organisation' })
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @ApiProperty({ example: 'mon-organisation' })
  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @ApiPropertyOptional({ example: 'Europe/Paris' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'Français' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '#0070f3' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  // Admin user
  @ApiProperty({ example: 'Jean Admin' })
  @IsString()
  @IsNotEmpty()
  adminName: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'SecureP@ss123!' })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional({ example: '+33 6 12 34 56 78' })
  @IsString()
  @IsOptional()
  adminPhone?: string;

  // Options
  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  loadDemoData?: boolean;
}
