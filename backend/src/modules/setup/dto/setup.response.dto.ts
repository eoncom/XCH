import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single service-health probe row exposed inside SetupStatusResponseDto.
 */
export class SetupServiceHealthResponseDto {
  @ApiProperty({ description: 'Service name (PostgreSQL, Redis, MinIO)' })
  @Expose()
  name!: string;

  @ApiProperty({ description: 'ok | error' })
  @Expose()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  message?: string | null;
}

/**
 * Response for `GET /setup/status` — public endpoint consumed by the
 * setup wizard to decide whether to render itself.
 */
export class SetupStatusResponseDto {
  @ApiProperty()
  @Expose()
  needsSetup!: boolean;

  @ApiProperty({ type: () => [SetupServiceHealthResponseDto] })
  @Expose()
  @Type(() => SetupServiceHealthResponseDto)
  services!: SetupServiceHealthResponseDto[];
}

/**
 * Compact tenant reference exposed by `POST /setup/initialize`.
 */
export class SetupTenantRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  subdomain!: string;
}

/**
 * Compact admin-user reference exposed by `POST /setup/initialize`.
 */
export class SetupAdminRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;
}

/**
 * Demo-data load summary — passthrough since seedService.loadDemo
 * returns `{ message, stats: {...} }` and the setup endpoint mirrors
 * it, OR `{ error: '...' }` if the demo load failed (non-fatal).
 */
export class SetupDemoDataResponseDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  message?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  error?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Per-entity counts (sites, users, assets, racks, …)',
  })
  @Expose()
  stats?: Record<string, number>;
}

/**
 * Response for `POST /setup/initialize`. Cas C composite of tenant +
 * admin + optional demo-data summary + success flag.
 */
export class SetupInitializeResponseDto {
  @ApiProperty()
  @Expose()
  success!: boolean;

  @ApiProperty({ type: () => SetupTenantRefResponseDto })
  @Expose()
  @Type(() => SetupTenantRefResponseDto)
  tenant!: SetupTenantRefResponseDto;

  @ApiProperty({ type: () => SetupAdminRefResponseDto })
  @Expose()
  @Type(() => SetupAdminRefResponseDto)
  admin!: SetupAdminRefResponseDto;

  @ApiPropertyOptional({ type: () => SetupDemoDataResponseDto, nullable: true })
  @Expose()
  @Type(() => SetupDemoDataResponseDto)
  demoData?: SetupDemoDataResponseDto | null;
}

/**
 * Response for `GET /setup/generate-secrets`. Plaintext secrets are
 * intentionally returned — the user copies them into `.env` before
 * starting the app for real. They are never persisted server-side
 * (the endpoint is single-shot during initial setup only).
 */
export class SetupSecretsResponseDto {
  @ApiProperty({ description: 'Plaintext JWT secret (32 bytes hex) — copy to .env' })
  @Expose()
  jwtSecret!: string;

  @ApiProperty({ description: 'Plaintext cookie secret (16 bytes hex) — copy to .env' })
  @Expose()
  cookieSecret!: string;

  @ApiProperty({ description: 'Plaintext MinIO secret key (16 bytes hex) — copy to .env' })
  @Expose()
  minioSecretKey!: string;

  @ApiProperty({ description: 'Plaintext PostgreSQL password (12 bytes hex) — copy to .env' })
  @Expose()
  postgresPassword!: string;
}
