import { IsString, IsOptional, IsEnum, IsNumber, IsObject, IsBoolean } from 'class-validator';
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

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  city: string;

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

  @ApiProperty({ required: false })
  @IsOptional()
  contacts?: any; // Can be array or object (JSONB)

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  accessNotes?: any;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  connectivity?: any;

  @ApiProperty({ required: false, description: 'Array of document emplacements (SMB/SharePoint links)' })
  @IsObject()
  @IsOptional()
  emplacements?: any;

  @ApiProperty({ required: false, description: 'URL to governance documents reference' })
  @IsString()
  @IsOptional()
  governanceDocsRef?: string;

  @ApiProperty({ enum: HealthStatus, default: HealthStatus.UNKNOWN })
  @IsEnum(HealthStatus)
  @IsOptional()
  healthStatus?: HealthStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, description: 'Metadata JSON (serverInfo, etc.)' })
  @IsObject()
  @IsOptional()
  metadata?: any;

  @ApiProperty({ required: false, description: 'Enable/disable monitoring for this site', default: true })
  @IsBoolean()
  @IsOptional()
  monitoringEnabled?: boolean;

  @ApiProperty({ required: false, description: 'Auto-generate a monthly electricity expense for this site', default: false })
  @IsBoolean()
  @IsOptional()
  autoGenerateElectricityExpense?: boolean;
}
