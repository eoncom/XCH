import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBillingEntityDto {
  @ApiProperty() @IsString()
  name: string;

  @ApiProperty() @IsString()
  code: string;

  @ApiProperty({ description: 'Type: DIRECTION, BU, DELEGATION, SITE, SERVICE, OTHER' })
  @IsString()
  type: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Delegation ID (null = global, R2)' })
  @IsOptional()
  @IsString()
  delegationId?: string;

  @ApiPropertyOptional({ description: 'Site ID — optional site-level attachment (R1)' })
  @IsOptional()
  @IsString()
  siteId?: string;
}

export class UpdateBillingEntityDto {
  @ApiPropertyOptional() @IsString() @IsOptional()
  name?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  code?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  type?: string;

  @ApiPropertyOptional() @IsString() @IsOptional()
  description?: string;

  @ApiPropertyOptional() @IsBoolean() @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Delegation ID (null to make global)' })
  @IsOptional()
  @IsString()
  delegationId?: string | null;

  @ApiPropertyOptional({ description: 'Site ID (null to clear)' })
  @IsOptional()
  @IsString()
  siteId?: string | null;
}
