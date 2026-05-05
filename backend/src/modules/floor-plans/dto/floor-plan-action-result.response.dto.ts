import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action shapes — multi-class file documented exception.
 */

export class FloorPlanDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

export class FloorPlanPinDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
