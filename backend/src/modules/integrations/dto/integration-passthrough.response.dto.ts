import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Multi-class file documented exception (cf README) — module-scoped
 * Swagger marker DTOs for the integrations module.
 *
 * IMPORTANT — these DTOs are NOT used at runtime via `toResponse()`. They
 * are pure Swagger markers : controllers return service results directly
 * (no class instance), so ClassSerializerInterceptor leaves the payload
 * untouched.
 *
 * Rationale : NetBox responses, sync reports, mapping arrays mirror
 * upstream NetBox API shapes (which vary by NetBox version) and are not
 * Prisma-derived — no leak risk. Mapping endpoints DO touch Prisma but
 * the service builds explicit shapes (no Prisma raw entity exposed).
 *
 * Future tightening : if a typed NetBox SDK lands post-v2.0.0, these
 * markers can be replaced by full strict DTOs.
 */

export class IntegrationsStatusResponseDto {
  @ApiProperty({ description: 'Per-provider status map (NetBox health, flags…). Free-form passthrough.' })
  data?: unknown;
}

export class IntegrationConfigResponseDto {
  @ApiProperty({
    description:
      'Tenant integration config (NetBox URL/tokenSet…). Tokens are masked server-side.',
  })
  data?: unknown;
}

export class IntegrationTestResultResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional({ type: String })
  message?: string;

  @ApiPropertyOptional({ description: 'Optional details payload' })
  details?: unknown;
}

export class IntegrationTestAllResultResponseDto {
  @ApiProperty({
    description: 'Per-provider test result map (provider → { success, message? })',
  })
  data?: unknown;
}

export class IntegrationSyncReportResponseDto {
  @ApiProperty({
    description: 'Sync report (counts: created/updated/skipped/errors + per-entity details)',
  })
  data?: unknown;
}

export class NetboxStatusResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ description: 'NetBox health check passthrough' })
  health?: unknown;
}

export class NetboxHealthResponseDto {
  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  version?: string;

  @ApiPropertyOptional()
  details?: unknown;
}

export class NetboxListResponseDto {
  @ApiProperty()
  count!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  next?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  previous?: string | null;

  @ApiProperty({ description: 'Upstream NetBox rows (passthrough)' })
  results!: unknown[];
}

export class IntegrationMappingItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  externalLabel!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class IntegrationMappingSaveResultResponseDto {
  @ApiProperty()
  saved!: number;

  @ApiProperty()
  deleted!: number;
}

export class IntegrationMappingDeleteResultResponseDto {
  @ApiProperty()
  deleted!: number;
}
