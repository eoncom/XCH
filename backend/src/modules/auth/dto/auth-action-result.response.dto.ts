import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action result shapes — multi-class file documented exception
 * (cf common/dto/response/README.md).
 */

/**
 * Response for `POST /auth/refresh` and `POST /auth/logout` —
 * cookie-side-effect endpoints with a trivial body.
 */
export class AuthSuccessResultResponseDto {
  @ApiProperty()
  @Expose()
  success!: boolean;
}

/**
 * Response for `POST /auth/2fa/disable` and `DELETE /auth/2fa/user/:userId`.
 */
export class TotpDisabledResultResponseDto {
  @ApiProperty()
  @Expose()
  disabled!: boolean;
}

/**
 * Response for `POST /auth/accept-invite`, `POST /auth/forgot-password`,
 * `POST /auth/reset-password` — service returns `{ success, message }`.
 */
export class AuthMessageResultResponseDto {
  @ApiPropertyOptional()
  @Expose()
  success?: boolean;

  @ApiProperty()
  @Expose()
  message!: string;
}
