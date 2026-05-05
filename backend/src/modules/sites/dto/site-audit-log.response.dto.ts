import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

/**
 * Single audit log entry for a site's modification history.
 * Cas A — direct from `AuditLogService.findByEntity`.
 */
export class SiteAuditLogResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  userId!: string | null;

  @ApiProperty({ description: 'CREATE | UPDATE | DELETE | …' })
  @Expose()
  action!: string;

  @ApiProperty()
  @Expose()
  entityType!: string;

  @ApiProperty()
  @Expose()
  entityId!: string;

  @ApiPropertyOptional({
    description: 'Free-form changes JSON ({before, after} or custom payload)',
    nullable: true,
  })
  @Expose()
  @Transform(({ obj }) => obj?.changes ?? null, { toClassOnly: true })
  changes?: unknown;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  timestamp!: Date;
}
