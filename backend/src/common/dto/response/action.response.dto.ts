import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Utility action-result shapes shared across modules. Multi-class file is the
 * documented exception to "1 entity = 1 file" — these are primitive return
 * shapes for endpoints that have no domain entity to expose (delete, enqueue,
 * ack, bulk-toggle).
 */

export class DeletedResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  deleted!: boolean;
}

export class EnqueuedResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  enqueued!: boolean;
}

export class AcknowledgedResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  acknowledged!: boolean;
}

export class CountResponseDto {
  @ApiProperty({ example: 12 })
  @Expose()
  count!: number;
}
