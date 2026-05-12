import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Response for the async backup/restore endpoints (HTTP 202) — confirms
 * the job has been enqueued on the `backup-jobs` Bull v3 queue and gives
 * the client a handle to poll status via `GET /backup/jobs/:jobId`.
 *
 * Cas A — `toResponse(BackupJobEnqueuedResponseDto, ...)`.
 *
 * Distinct from the shared `EnqueuedResponseDto` in
 * `common/dto/response/action.response.dto.ts` (which has no `jobId`) so the
 * shared shape stays a plain boolean ack.
 */
export class BackupJobEnqueuedResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  enqueued!: boolean;

  @ApiProperty({
    description: 'Bull v3 job id used as polling handle for status.',
    example: '40888',
  })
  @Expose()
  jobId!: string;
}
