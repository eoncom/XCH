import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterSiteDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: ['PREPARATION', 'ACTIVE', 'CLOSED'], required: false })
  @IsEnum(['PREPARATION', 'ACTIVE', 'CLOSED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ enum: ['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'], required: false })
  @IsEnum(['OK', 'WARNING', 'CRITICAL', 'UNKNOWN'])
  @IsOptional()
  healthStatus?: string;
}
