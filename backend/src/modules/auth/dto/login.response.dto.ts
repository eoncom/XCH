import { ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AuthUserRefResponseDto } from './auth-user-ref.response.dto';

/**
 * Response for `POST /auth/login`. The wire shape is one of three variants
 * depending on the user's 2FA state and the tenant's `require2FA` config :
 *
 *  1. `{ requires2FA: true, tempToken: <jwt-5min> }`  — user has 2FA on,
 *     must POST /auth/2fa/verify (or /backup-verify) with the temp token.
 *  2. `{ user, requires2FASetup: true }` (cookies set) — tenant requires
 *     2FA but user hasn't enrolled. Login succeeds; client redirects to
 *     2FA setup wizard.
 *  3. `{ user }` (cookies set) — vanilla success path.
 *
 * All four fields are declared optional in this single DTO so any of the
 * three variants serializes cleanly. Fields absent from the controller's
 * return value are excluded from the wire JSON (class-transformer drops
 * `undefined` props by default in `instanceToPlain`).
 *
 * Sensitive fields (passwordHash, totpSecret, …) cannot leak because
 * `user` is typed as AuthUserRefResponseDto via @Type() — the strict
 * whitelist of that DTO applies recursively.
 */
export class LoginResponseDto {
  @ApiPropertyOptional({ type: () => AuthUserRefResponseDto })
  @Expose()
  @Type(() => AuthUserRefResponseDto)
  user?: AuthUserRefResponseDto;

  @ApiPropertyOptional({ description: 'True when the user must complete 2FA via temp token' })
  @Expose()
  requires2FA?: boolean;

  @ApiPropertyOptional({ description: 'Short-lived (5 min) JWT used by /auth/2fa/verify' })
  @Expose()
  tempToken?: string;

  @ApiPropertyOptional({ description: 'True when login succeeded but the tenant requires 2FA enrollment' })
  @Expose()
  requires2FASetup?: boolean;
}
