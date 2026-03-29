import { IsString, IsEnum, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SiteAccessLevel {
  READ = 'READ',
  WRITE = 'WRITE',
}

export enum ResourcePermissionLevel {
  NONE = 'NONE',
  READ = 'READ',
  WRITE = 'WRITE',
}

export interface ResourcePermissions {
  sites?: ResourcePermissionLevel;
  assets?: ResourcePermissionLevel;
  racks?: ResourcePermissionLevel;
  tasks?: ResourcePermissionLevel;
  floorPlans?: ResourcePermissionLevel;
  contacts?: ResourcePermissionLevel;
  monitoring?: ResourcePermissionLevel;
  netbox?: ResourcePermissionLevel;
}

export class GrantSiteAccessDto {
  @ApiProperty({ description: 'User ID to grant access to' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Site ID to grant access to' })
  @IsString()
  siteId: string;

  @ApiProperty({ enum: SiteAccessLevel, default: SiteAccessLevel.READ })
  @IsEnum(SiteAccessLevel)
  @IsOptional()
  accessLevel?: SiteAccessLevel;

  @ApiProperty({ description: 'Per-resource permission overrides (JSON)', required: false })
  @IsObject()
  @IsOptional()
  resourcePermissions?: ResourcePermissions;
}

export class BulkGrantSiteAccessDto {
  @ApiProperty({ description: 'User IDs to grant access to', type: [String] })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ description: 'Site ID to grant access to' })
  @IsString()
  siteId: string;

  @ApiProperty({ enum: SiteAccessLevel, default: SiteAccessLevel.READ })
  @IsEnum(SiteAccessLevel)
  @IsOptional()
  accessLevel?: SiteAccessLevel;
}

export class UpdateSiteAccessDto {
  @ApiProperty({ enum: SiteAccessLevel })
  @IsEnum(SiteAccessLevel)
  @IsOptional()
  accessLevel?: SiteAccessLevel;

  @ApiProperty({ description: 'Per-resource permission overrides (JSON)', required: false })
  @IsObject()
  @IsOptional()
  resourcePermissions?: ResourcePermissions;
}
