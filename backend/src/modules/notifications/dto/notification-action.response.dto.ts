import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Multi-class file documented exception — these are the action result shapes
 * specific to the notifications module. Same convention as
 * `common/dto/response/action.response.dto.ts` but module-scoped.
 */

/**
 * Synchronous test result returned by `POST /notifications/test`.
 */
export class NotificationTestResultResponseDto {
  @ApiProperty()
  @Expose()
  success!: boolean;

  @ApiPropertyOptional({ type: String })
  @Expose()
  error?: string;
}

/**
 * Response for `DELETE /notifications/config/:delegationId` — counts the
 * channels / rules deleted at the scope.
 */
export class NotificationDeleteSettingsResponseDto {
  @ApiProperty({ description: 'Channels deleted at this scope' })
  @Expose()
  deletedChannels!: number;

  @ApiProperty({ description: 'Rules deleted at this scope' })
  @Expose()
  deletedRules!: number;
}
