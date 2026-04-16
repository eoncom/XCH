import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterAssetDto extends PaginationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false, description: 'Asset type (dynamic via EnumLabel)' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ required: false, description: 'Asset status (dynamic via EnumLabel)' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  siteId?: string;

  @ApiProperty({ required: false, description: 'Filter assets by delegation (covers all sites of the delegation)' })
  @IsString()
  @IsOptional()
  delegationId?: string;

  @ApiProperty({ required: false, description: 'When set to "true", only return unassigned assets (no site, no delegation)' })
  @IsString()
  @IsOptional()
  unassigned?: string;

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
