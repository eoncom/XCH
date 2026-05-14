import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Progress payload emitted by `BackupProcessor` via `job.progress(...)`,
 * polled by the frontend `useBackupJob(jobId)` hook every 2000 ms.
 *
 * Cas C — nested type, exposed under `JobStatusResponseDto.progress`.
 */
export class JobProgressResponseDto {
  @ApiProperty({
    description:
      'Coarse phase label (collect | archive | upload | extract | ' +
      'minio-restore | prisma-import). Drives UI step indicator.',
    example: 'archive',
  })
  @Expose()
  phase!: string;

  @ApiProperty({
    description: 'Integer 0..100, computed = round((current/total)*100).',
    example: 42,
  })
  @Expose()
  percent!: number;

  @ApiProperty({ description: 'Items processed so far in the phase.' })
  @Expose()
  current!: number;

  @ApiProperty({ description: 'Total items expected in the phase.' })
  @Expose()
  total!: number;

  @ApiProperty({
    description: 'Free-text human-readable status line for the UI.',
    example: 'Streaming xch-storage objects (147 / 312)…',
  })
  @Expose()
  message!: string;
}

/**
 * Response for `GET /backup/jobs/:jobId` — polled by the frontend
 * `useBackupJob(jobId)` hook every 2000 ms until state ∈ {completed,failed}.
 *
 * Cas C — `@Type` on the nested `progress` field. Anti-leak via `@Expose`
 * whitelist (ADR-023). The processor emits any extra return value into
 * `result` — kept loose because the shape varies by job kind
 * (BackupResult vs DryRunReport vs counts).
 */
export class JobStatusResponseDto {
  @ApiProperty({
    enum: ['waiting', 'active', 'completed', 'failed'],
    description: 'Bull v3 job state, lowercase.',
  })
  @Expose()
  state!: 'waiting' | 'active' | 'completed' | 'failed';

  @ApiProperty({ type: () => JobProgressResponseDto })
  @Expose()
  @Type(() => JobProgressResponseDto)
  progress!: JobProgressResponseDto;

  @ApiPropertyOptional({
    description:
      'Job return value when state = completed. Shape depends on job kind ' +
      '(BackupResult / RestoreResult / DryRunReport). Absent otherwise.',
  })
  @Expose()
  result?: unknown;

  @ApiPropertyOptional({
    description: 'Failure reason when state = failed. Absent otherwise.',
  })
  @Expose()
  error?: string;
}
