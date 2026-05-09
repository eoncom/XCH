import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Réponse 202 du `POST /api/_test-error/worker` — confirme que le job a
 * été enqueueé sur la queue BullMQ `test-error`. Le worker traitera le
 * job de façon asynchrone et lèvera côté `TestErrorProcessor.throw`.
 *
 * Note shape : on n'utilise PAS `EnqueuedResponseDto` (commun) parce que
 * le jobId est une donnée utile pour le diagnostic (corrélation logs
 * worker `BullEvent {... "job_id": "<n>"}` ↔ event GlitchTip).
 */
export class TestErrorEnqueuedResponseDto {
  @ApiProperty({ example: 'enqueued' })
  @Expose()
  status!: string;

  @ApiProperty({ example: '42', description: 'Bull job ID — stable across retries' })
  @Expose()
  jobId!: string;
}
