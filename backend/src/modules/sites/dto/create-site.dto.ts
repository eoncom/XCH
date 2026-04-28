import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SiteStatus, HealthStatus } from '@prisma/client';

export class CreateSiteDto {
  @ApiProperty({ description: 'ID of the delegation this site belongs to' })
  @IsString()
  delegationId: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: SiteStatus, default: SiteStatus.ACTIVE })
  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;

  // Address / city are optional — a mobile/temporary construction site may
  // only carry GPS coordinates. The frontend enforces that at least one of
  // (address, lat+lng) is filled (business rule); the backend accepts both
  // nullable at the schema level.
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ default: 'France' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  // ADR-018 — Site.contacts JSON dropped; contacts are managed via the
  // Contact API (POST /api/contacts with siteId), not via the Site DTO.

  // Access notes — split from former JSON. Each is a free-form Text column
  // (ADR-018 cible D.2).
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accessSchedules?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accessBadges?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accessProcedures?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accessSafety?: string;

  // Connectivity moved to the structured ConnectivityLink table in v1.3 —
  // POST/PATCH connectivity data via /api/connectivity, not via the Site DTO.

  @ApiProperty({ required: false, description: 'Cut-off procedure note (moved from connectivity JSON in phase 6.5)' })
  @IsString()
  @IsOptional()
  cutProcedure?: string;

  // ADR-018 — emplacements managed via dedicated SiteEmplacement
  // CRUD endpoints (out of scope of the bulk Site DTO).

  @ApiProperty({ required: false, description: 'URL to governance documents reference' })
  @IsString()
  @IsOptional()
  governanceDocsRef?: string;

  // Server / document portal URLs split from former Site.metadata.serverInfo
  // (ADR-018 cible D.4).
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  smbPath?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sharepointUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  gedUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  accessRightsUrl?: string;

  @ApiProperty({ enum: HealthStatus, default: HealthStatus.UNKNOWN })
  @IsEnum(HealthStatus)
  @IsOptional()
  healthStatus?: HealthStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, description: 'Enable/disable monitoring for this site', default: true })
  @IsBoolean()
  @IsOptional()
  monitoringEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Auto-generate a monthly electricity expense for this site', default: false })
  @IsBoolean()
  @IsOptional()
  autoGenerateElectricityExpense?: boolean;
}
