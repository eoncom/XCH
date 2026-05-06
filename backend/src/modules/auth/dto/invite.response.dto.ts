import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AuthTenantRefResponseDto } from './auth-user-ref.response.dto';

/**
 * Response for `POST /auth/invite`. The service returns a stripped User
 * (no passwordHash / totpSecret / totpBackupCodes / inviteToken-hash /
 * resetToken-hash), augmented with two transient flags :
 *
 *  - `emailSent`         : true if the SMTP transport accepted the message.
 *  - `inviteToken` (opt) : ONLY present when `emailSent === false` — the
 *    plaintext token is returned to the admin so they can hand the link
 *    over manually. Never persisted in clear server-side (only the
 *    SHA-256 hash lives in the row).
 *
 * Cas C — User shape + tenant ref + 2 controller-side computed flags.
 */
export class InviteResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiProperty()
  @Expose()
  active!: boolean;

  @ApiProperty()
  @Expose()
  authProvider!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Expose()
  inviteTokenExpiry?: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: () => AuthTenantRefResponseDto, nullable: true })
  @Expose()
  @Type(() => AuthTenantRefResponseDto)
  tenant?: AuthTenantRefResponseDto | null;

  @ApiProperty({ description: 'True iff the invitation email was actually transported by SMTP' })
  @Expose()
  emailSent!: boolean;

  @ApiPropertyOptional({
    type: String,
    description:
      'Plaintext invite token. Returned ONLY when `emailSent === false` — the admin needs it to share the link manually. Never persisted in clear server-side.',
  })
  @Expose()
  inviteToken?: string;
}
