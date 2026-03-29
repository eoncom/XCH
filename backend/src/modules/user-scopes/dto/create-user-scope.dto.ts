import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ScopeTypeDto {
  TENANT = 'TENANT',
  DIVISION = 'DIVISION',
  DELEGATION = 'DELEGATION',
  SITE = 'SITE',
}

export class CreateUserScopeDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: ScopeTypeDto, description: 'Scope type' })
  @IsEnum(ScopeTypeDto)
  scopeType: ScopeTypeDto;

  @ApiProperty({ description: 'Scope target ID (null for TENANT)', required: false })
  @IsString()
  @IsOptional()
  scopeId?: string;
}

export class BulkSetUserScopesDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'List of scopes to set', type: [Object] })
  scopes: { scopeType: ScopeTypeDto; scopeId?: string }[];
}
