import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action result shapes — multi-class file documented exception
 * (cf `common/dto/response/README.md`). Same convention as
 * `notifications/dto/notification-action.response.dto.ts`.
 */

/**
 * Response for `DELETE /racks/:id` — localised confirmation.
 */
export class RackDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

/**
 * Response for `DELETE /racks/:id/attachments/:attachmentId`.
 */
export class RackAttachmentDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
