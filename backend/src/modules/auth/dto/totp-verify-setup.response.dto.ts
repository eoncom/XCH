import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `POST /auth/2fa/verify-setup`.
 *
 * The plaintext `backupCodes` array is intentionally returned ONCE at
 * setup completion — the user must save them out-of-band (printed,
 * stored in a password manager). The server only persists the SHA-256
 * hashes (cf TotpService.generateBackupCodes). Plaintext-on-the-wire is
 * acceptable here because the user cannot recover the codes later.
 */
export class TotpVerifySetupResponseDto {
  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({
    type: [String],
    description: 'Plaintext backup codes (returned ONCE — user must save them out-of-band)',
  })
  @Expose()
  backupCodes!: string[];
}
