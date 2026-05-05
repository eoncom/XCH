import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Single available U-slot in a rack returned by
 * `GET /racks/:id/available-spaces?heightU=N`.
 */
export class RackAvailableSpaceResponseDto {
  @ApiProperty({ description: 'Bottom-most U position of the slot (1-based)' })
  @Expose()
  positionU!: number;

  @ApiProperty({ description: 'Top-most U position of the slot' })
  @Expose()
  endPositionU!: number;

  @ApiProperty({ description: 'Slot height in U (= requested heightU)' })
  @Expose()
  heightU!: number;
}

/**
 * Composite response for `GET /racks/:id/available-spaces`.
 * Cas C composite (rack info + available slots array).
 */
export class RackAvailableSpacesResponseDto {
  @ApiProperty()
  @Expose()
  rackId!: string;

  @ApiProperty()
  @Expose()
  rackName!: string;

  @ApiProperty({ description: 'Total rack height in U' })
  @Expose()
  totalU!: number;

  @ApiProperty({ description: 'Required height in U for the search' })
  @Expose()
  requiredU!: number;

  @ApiProperty({ type: () => [RackAvailableSpaceResponseDto] })
  @Expose()
  @Type(() => RackAvailableSpaceResponseDto)
  availableSpaces!: RackAvailableSpaceResponseDto[];
}
