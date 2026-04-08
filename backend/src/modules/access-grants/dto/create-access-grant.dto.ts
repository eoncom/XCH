import { IsString, IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResourcePermissions } from '../../site-access/dto/grant-site-access.dto';

export enum AccessScopeDto {
  ALL_SITES = 'ALL_SITES',
  DELEGATION = 'DELEGATION',
  SITE = 'SITE',
}

export class CreateAccessGrantDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: AccessScopeDto, description: 'Grant scope' })
  @IsEnum(AccessScopeDto)
  scope: AccessScopeDto;

  @ApiProperty({ description: 'Scope target ID (null for ALL_SITES)', required: false })
  @IsString()
  @IsOptional()
  scopeId?: string;

  @ApiProperty({ description: 'Per-resource permissions (ADDITIVE only)', type: Object })
  @IsObject()
  resourcePermissions: ResourcePermissions;

  @ApiProperty({ description: 'Label for this grant', required: false })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ description: 'Expiration date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateAccessGrantDto {
  @ApiProperty({ description: 'Per-resource permissions (ADDITIVE only)', type: Object, required: false })
  @IsObject()
  @IsOptional()
  resourcePermissions?: ResourcePermissions;

  @ApiProperty({ description: 'Label for this grant', required: false })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ description: 'Expiration date (ISO string)', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
