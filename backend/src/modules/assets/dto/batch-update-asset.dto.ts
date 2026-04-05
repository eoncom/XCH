import { IsArray, IsString, IsOptional, IsEnum } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class BatchUpdateAssetsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  siteId?: string;
}
