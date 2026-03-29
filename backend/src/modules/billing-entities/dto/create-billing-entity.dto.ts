import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBillingEntityDto {
  @ApiProperty() @IsString()
  name: string;

  @ApiProperty() @IsString()
  code: string;

  @ApiProperty({ description: 'Type: DIRECTION, BU, DELEGATION, SITE, SERVICE, OTHER' })
  @IsString()
  type: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ required: false }) @IsBoolean() @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  divisionId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  delegationId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  siteId?: string;
}

export class UpdateBillingEntityDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional()
  name?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  code?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  type?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  description?: string;

  @ApiProperty({ required: false }) @IsBoolean() @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  divisionId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  delegationId?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional()
  siteId?: string;
}
