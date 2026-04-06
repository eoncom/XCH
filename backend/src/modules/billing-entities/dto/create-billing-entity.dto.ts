import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Scope type: DIVISION, DELEGATION, SITE (or null for tenant-wide)' })
  @IsOptional()
  @IsIn(['DIVISION', 'DELEGATION', 'SITE'])
  scopeType?: string;

  @ApiPropertyOptional({ description: 'ID of the scoped entity (divisionId, delegationId or siteId)' })
  @IsOptional()
  @IsString()
  scopeId?: string;

  // DEPRECATED — kept for backward compatibility
  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
  divisionId?: string;

  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
  delegationId?: string;

  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
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

  @ApiPropertyOptional({ description: 'Scope type: DIVISION, DELEGATION, SITE (or null to clear)' })
  @IsOptional()
  @IsIn(['DIVISION', 'DELEGATION', 'SITE'])
  scopeType?: string | null;

  @ApiPropertyOptional({ description: 'ID of the scoped entity' })
  @IsOptional()
  @IsString()
  scopeId?: string | null;

  // DEPRECATED
  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
  divisionId?: string;

  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
  delegationId?: string;

  @ApiPropertyOptional({ deprecated: true }) @IsString() @IsOptional()
  siteId?: string;
}
