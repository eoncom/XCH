import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { UserResponseDto } from './user.response.dto';

/**
 * Multi-class file documented exception (cf README) — module-scoped action
 * shapes for users.
 */

/**
 * Response for `DELETE /users/:id`.
 */
export class UserDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

/**
 * Response for `POST /users/me/change-password`.
 */
export class UserPasswordChangedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

/**
 * Response for `POST /users/:id/toggle-super-admin` — service returns the
 * updated user (with stripped sensitive fields). We pass it through the
 * standard UserResponseDto whitelist as second line of defense.
 */
export class UserToggleSuperAdminResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;

  @ApiProperty({ type: () => UserResponseDto })
  @Expose()
  @Type(() => UserResponseDto)
  user!: UserResponseDto;
}
