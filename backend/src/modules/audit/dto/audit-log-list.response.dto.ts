import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AuditLogResponseDto } from './audit-log.response.dto';

export class AuditLogListPageMetaResponseDto {
  @ApiProperty()
  @Expose()
  total!: number;

  @ApiProperty()
  @Expose()
  page!: number;

  @ApiProperty()
  @Expose()
  pageSize!: number;

  @ApiProperty()
  @Expose()
  totalPages!: number;
}

/**
 * Paginated response for `GET /audit` and `GET /audit/entity/:type/:id`.
 * Cas C composite — `data + meta`.
 */
export class AuditLogListResponseDto {
  @ApiProperty({ type: () => [AuditLogResponseDto] })
  @Expose()
  @Type(() => AuditLogResponseDto)
  data!: AuditLogResponseDto[];

  @ApiProperty({ type: () => AuditLogListPageMetaResponseDto })
  @Expose()
  @Type(() => AuditLogListPageMetaResponseDto)
  meta!: AuditLogListPageMetaResponseDto;
}
