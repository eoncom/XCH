import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class BaseResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;
}
