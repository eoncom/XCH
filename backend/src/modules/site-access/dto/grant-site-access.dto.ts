import { IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SiteAccessLevel {
  READ = 'READ',
  WRITE = 'WRITE',
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
  accessLevel: SiteAccessLevel;
}
