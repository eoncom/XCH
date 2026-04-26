import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfigIntegrationDto {
  @ApiProperty({ enum: ['netbox'] })
  @IsEnum(['netbox'])
  provider: string;

  @ApiProperty()
  @IsString()
  baseUrl: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  apiToken?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
