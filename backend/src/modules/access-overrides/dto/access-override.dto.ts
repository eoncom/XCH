import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString, ValidateIf } from 'class-validator';
import { OverrideEffect, PermissionLevel } from '@prisma/client';

export class CreateAccessOverrideDto {
  @ApiProperty({ description: 'User ID to apply override to' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Site ID for this override' })
  @IsString()
  siteId: string;

  @ApiProperty({
    description: 'Resource key: "*" = whole site, or specific module',
    example: '*',
    enum: ['*', 'assets', 'racks', 'tasks', 'plans', 'contacts', 'expenses', 'monitoring'],
  })
  @IsString()
  resource: string;

  @ApiProperty({ enum: ['ALLOW', 'DENY'], description: 'Effect of this override' })
  @IsEnum(OverrideEffect)
  effect: OverrideEffect;

  @ApiPropertyOptional({
    enum: ['READ', 'WRITE'],
    description: 'Permission level (required for ALLOW, must be null for DENY)',
  })
  @ValidateIf((o) => o.effect === 'ALLOW')
  @IsEnum(PermissionLevel)
  @IsOptional()
  permission?: PermissionLevel;

  @ApiPropertyOptional({ description: 'Human-readable label for this override' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Expiration date (ISO 8601). Null = permanent.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateAccessOverrideDto {
  @ApiPropertyOptional({ enum: ['ALLOW', 'DENY'] })
  @IsOptional()
  @IsEnum(OverrideEffect)
  effect?: OverrideEffect;

  @ApiPropertyOptional({ enum: ['READ', 'WRITE'] })
  @IsOptional()
  @IsEnum(PermissionLevel)
  permission?: PermissionLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
