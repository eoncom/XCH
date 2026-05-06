import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AuthUserRefResponseDto } from './auth-user-ref.response.dto';

/**
 * Response for `GET /auth/session` — returns `{ user, isAuthenticated }`
 * once the JwtAuthGuard accepted the cookie / bearer.
 *
 * Cas C — embeds AuthUserRefResponseDto via @Type(). The typed embed
 * guarantees passwordHash et al. cannot leak even if the controller
 * accidentally hands a Prisma entity to the response shape.
 */
export class SessionResponseDto {
  @ApiProperty({ type: () => AuthUserRefResponseDto })
  @Expose()
  @Type(() => AuthUserRefResponseDto)
  user!: AuthUserRefResponseDto;

  @ApiProperty()
  @Expose()
  isAuthenticated!: boolean;
}
