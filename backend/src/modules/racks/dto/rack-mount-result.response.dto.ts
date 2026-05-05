import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
/**
 * Compact asset reference returned by mount / unmount endpoints. Subset of
 * the full Asset DTO (created in PR #12 assets cascade) — for now this PR
 * exposes only the fields the controller actually uses for the UI confirm
 * toast.
 */
export class RackMountedAssetRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty({ description: 'Asset type label' })
  @Expose()
  type!: string;

  @ApiProperty({ description: 'Dynamic asset status label (EnumLabel)' })
  @Expose()
  status!: string;

  @ApiProperty({ nullable: true })
  @Expose()
  siteId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  rackId!: string | null;

  @ApiProperty({ nullable: true })
  @Expose()
  rackPositionU!: number | null;

  @ApiProperty({ nullable: true })
  @Expose()
  rackHeightU!: number | null;
}

/**
 * Response for `POST /racks/:id/mount` and
 * `DELETE /racks/:id/unmount/:assetId` — same shape, distinct messages.
 *
 * Cas C composite (message + nested asset ref).
 */
export class RackMountResultResponseDto {
  @ApiProperty({ description: 'Localised confirmation message' })
  @Expose()
  message!: string;

  @ApiProperty({ type: () => RackMountedAssetRefResponseDto })
  @Expose()
  @Type(() => RackMountedAssetRefResponseDto)
  asset!: RackMountedAssetRefResponseDto;
}
