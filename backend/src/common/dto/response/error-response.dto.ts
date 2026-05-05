import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Standard error envelope produced by AllExceptionsFilter
 * (`backend/src/common/filters/all-exceptions.filter.ts`). Documenting it here
 * lets every endpoint reference `@ApiResponse({ status: 4xx, type: ErrorResponseDto })`
 * for Swagger consumers.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  @Expose()
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  @Expose()
  error!: string;

  @ApiProperty({ example: 'Invalid target: not a valid hostname' })
  @Expose()
  message!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  timestamp!: string;

  @ApiProperty({ example: '/api/monitors/abc' })
  @Expose()
  path!: string;
}
