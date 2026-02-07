import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterAssetDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: ['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'ROUTER', 'WIFI_AP', 'ACCESS_POINT', 'TEAMS_ROOM', 'WEBCAM', 'DISPLAY', 'CAMERA', 'SERVER', 'CABLE', 'PATCH_PANEL', 'PDU', 'BOX_5G', 'OTHER'], required: false })
  @IsEnum(['PRINTER', 'IPAD', 'TABLET', 'SWITCH', 'FIREWALL', 'ROUTER', 'WIFI_AP', 'ACCESS_POINT', 'TEAMS_ROOM', 'WEBCAM', 'DISPLAY', 'CAMERA', 'SERVER', 'CABLE', 'PATCH_PANEL', 'PDU', 'BOX_5G', 'OTHER'])
  @IsOptional()
  type?: string;

  @ApiProperty({ enum: ['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED'], required: false })
  @IsEnum(['IN_SERVICE', 'OUT_OF_SERVICE', 'IN_TRANSIT', 'STOCK', 'RETIRED'])
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rackId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  withoutSerialNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  withoutLocation?: string;
}
