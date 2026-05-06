import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ContactResponseDto } from './contact.response.dto';

export class ContactListPageMetaResponseDto {
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
 * Paginated response for `GET /contacts`. Cas C composite — `data + meta`.
 */
export class ContactListResponseDto {
  @ApiProperty({ type: () => [ContactResponseDto] })
  @Expose()
  @Type(() => ContactResponseDto)
  data!: ContactResponseDto[];

  @ApiProperty({ type: () => ContactListPageMetaResponseDto })
  @Expose()
  @Type(() => ContactListPageMetaResponseDto)
  meta!: ContactListPageMetaResponseDto;
}
