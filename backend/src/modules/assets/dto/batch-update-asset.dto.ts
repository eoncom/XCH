import { IsArray, IsString, IsOptional } from 'class-validator';

export class BatchUpdateAssetsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  siteId?: string;
}
