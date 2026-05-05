import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Module-scoped action result shapes — multi-class file documented exception.
 */

export class SiteDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}

export class SiteAttachmentDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  message!: string;
}
