import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProviderType } from './create-provider.dto';

export class QueryProviderDto {
  @ApiProperty({
    required: false,
    enum: ProviderType,
    description: 'Filter by provider type'
  })
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;
}
