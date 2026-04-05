import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AssetType, AssetStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterAssetDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ enum: AssetType, required: false })
  @IsEnum(AssetType)
  @IsOptional()
  type?: AssetType;

  @ApiProperty({ enum: AssetStatus, required: false })
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

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
