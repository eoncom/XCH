import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MountEquipmentDto {
  @ApiProperty()
  @IsString()
  assetId: string;

  @ApiProperty({ description: 'Starting U position (1-based)' })
  @IsNumber()
  @Min(1)
  positionU: number;

  @ApiProperty({ description: 'Height in U units' })
  @IsNumber()
  @Min(1)
  heightU: number;
}
