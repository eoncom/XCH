import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `DELETE /backup/:id` — localised confirmation message.
 * Distinct from `DeletedResponseDto` (boolean form) because the existing
 * UI consumer reads `res.message` to display a toast.
 */
export class DeleteBackupResultResponseDto {
  @ApiProperty({ description: 'Localised user-facing confirmation message' })
  @Expose()
  message!: string;
}
