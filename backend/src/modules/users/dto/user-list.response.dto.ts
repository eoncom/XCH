import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserResponseDto } from './user.response.dto';

export class UserListPageMetaResponseDto {
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
 * Paginated response for `GET /users`. Cas C composite.
 */
export class UserListResponseDto {
  @ApiProperty({ type: () => [UserResponseDto] })
  @Expose()
  @Type(() => UserResponseDto)
  data!: UserResponseDto[];

  @ApiProperty({ type: () => UserListPageMetaResponseDto })
  @Expose()
  @Type(() => UserListPageMetaResponseDto)
  meta!: UserListPageMetaResponseDto;
}
