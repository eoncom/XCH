import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact ContactType reference embedded in Contact responses.
 */
export class ContactTypeRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  slug!: string;

  @ApiProperty()
  @Expose()
  category!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  color?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  icon?: string | null;
}

/**
 * Contact entity exposed by all CRUD endpoints. Cas C — Prisma entity
 * scalars + ContactType relation typed via @Type().
 */
export class ContactResponseDto {
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
  typeId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  mobile?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  address?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  company?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  role?: string | null;

  @ApiProperty()
  @Expose()
  isPrimary!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Owning delegation (NULL = global, readable by all tenant users)' })
  @Expose()
  delegationId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  siteId?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => ContactTypeRefResponseDto, nullable: true })
  @Expose()
  @Type(() => ContactTypeRefResponseDto)
  type?: ContactTypeRefResponseDto | null;
}

/**
 * Response for `DELETE /contacts/:id`.
 */
export class ContactDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
