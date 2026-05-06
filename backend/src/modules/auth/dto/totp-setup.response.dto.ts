import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `POST /auth/2fa/setup`.
 *
 * The plaintext `secret` is intentionally returned to the caller — the user
 * enters it into their authenticator app (or scans the QR code). The same
 * value is persisted encrypted-at-rest (ADR-019). Plaintext-on-the-wire is
 * acceptable here because the user must possess it to enable 2FA.
 */
export class TotpSetupResponseDto {
  @ApiProperty({ description: 'Plaintext TOTP secret (user-facing — entered into authenticator app)' })
  @Expose()
  secret!: string;

  @ApiProperty({ description: 'Base64 data URL of the QR code image (encodes the otpauth:// URI)' })
  @Expose()
  qrCodeDataUrl!: string;
}
