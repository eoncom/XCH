import { IsString, IsOptional, IsObject, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TenantSecurityReminderInputDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional({ enum: ['INFO', 'WARNING', 'CRITICAL'] })
  @IsString()
  @IsOptional()
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  siteId?: string | null;
}

/**
 * ADR-018 — UpdateTenantDto used to accept a free-form `config` JSON. The
 * field is preserved for backward compatibility (the frontend still posts
 * `config: { theme, securityReminders, … }`) but the service routes the
 * known sub-keys to the typed tables and ignores the rest.
 */
export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({ required: false, example: '#0070f3' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({
    description:
      'Politique SSRF (ADR-016) — autorise les cibles RFC1918 pour le monitoring / la connectivité / les assets. À activer pour un déploiement on-premise LAN.',
  })
  @IsBoolean()
  @IsOptional()
  allowInternalNetworkTargets?: boolean;

  @ApiPropertyOptional({
    description: 'Legacy nested config — only `theme` and `securityReminders` are still routed.',
  })
  @IsObject()
  @IsOptional()
  config?: {
    theme?: string;
    securityReminders?: TenantSecurityReminderInputDto[];
    [k: string]: unknown;
  };
}
