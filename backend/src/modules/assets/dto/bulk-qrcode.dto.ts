import { IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkQRCodeDto {
  @ApiProperty({ type: [String], example: ['asset_id_1', 'asset_id_2'] })
  @IsArray()
  @ArrayMinSize(1)
  assetIds: string[];
}
