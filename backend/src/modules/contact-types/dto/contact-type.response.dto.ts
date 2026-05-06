import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * ContactType entity exposed by all CRUD endpoints. Cas A — Prisma
 * entity scalar whitelist (no relations exposed; the `contacts[]`
 * relation is consumed by the contacts module separately).
 */
export class ContactTypeResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  slug!: string;

  @ApiProperty({ description: 'ContactCategory enum (TECHNICAL | LOGISTICS | ...)' })
  @Expose()
  category!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  color?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Lucide icon name' })
  @Expose()
  icon?: string | null;

  @ApiProperty({ description: 'true = built-in system type, non-deletable' })
  @Expose()
  isSystem!: boolean;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;
}

/**
 * Response for `DELETE /contact-types/:id`.
 */
export class ContactTypeDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
