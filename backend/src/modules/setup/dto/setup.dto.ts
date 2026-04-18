import { IsString, IsEmail, IsNotEmpty, MinLength, IsOptional, IsBoolean, Matches } from 'class-validator';
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

  // Optional logo URL. Leave empty — the organisation name is shown in the sidebar
  // when no logo is uploaded, which is cleaner than a broken placeholder image.
  @ApiPropertyOptional({ example: 'https://cdn.example.com/my-company-logo.svg' })
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

  @ApiProperty({ example: 'SecureP@ss123!', description: 'Min 8 chars, at least one lowercase, one uppercase and one digit' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
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
