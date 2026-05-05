import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for `POST /backup/full` — created backup metadata.
 * Cas B (helper-shaped) — service constructs the literal directly.
 */
export class BackupResultResponseDto {
  @ApiProperty({ description: 'Localised user-facing confirmation message' })
  @Expose()
  message!: string;

  @ApiProperty({ description: 'Generated archive filename' })
  @Expose()
  filename!: string;

  @ApiProperty({ description: 'Archive size in bytes' })
  @Expose()
  size!: number;
}
