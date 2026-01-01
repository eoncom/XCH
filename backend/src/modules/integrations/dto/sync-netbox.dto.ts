import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncNetBoxSitesDto {
  @ApiProperty({ required: false, description: 'Auto-create missing sites in XCH' })
  @IsBoolean()
  @IsOptional()
  autoCreate?: boolean;

  @ApiProperty({ required: false, description: 'Update existing sites metadata' })
  @IsBoolean()
  @IsOptional()
  updateExisting?: boolean;
}

export class SyncNetBoxDevicesDto {
  @ApiProperty({ description: 'XCH Site ID to sync devices for' })
  @IsString()
  siteId: string;

  @ApiProperty({ required: false, description: 'NetBox site ID' })
  @IsString()
  @IsOptional()
  netboxSiteId?: string;

  @ApiProperty({ required: false, description: 'Auto-create missing assets in XCH' })
  @IsBoolean()
  @IsOptional()
  autoCreate?: boolean;
}

export class MapAssetToNetBoxDto {
  @ApiProperty({ description: 'XCH Asset ID' })
  @IsString()
  assetId: string;

  @ApiProperty({ required: false, description: 'NetBox device ID to map to' })
  @IsString()
  @IsOptional()
  netboxDeviceId?: string;
}
