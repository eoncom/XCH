import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Response for `POST /assets/:id/qr-code` — single asset QR generation.
 */
export class AssetQRCodeResponseDto {
  @ApiProperty()
  @Expose()
  assetId!: string;

  @ApiProperty({ description: 'Base64 data URL of the QR PNG' })
  @Expose()
  qrCodeUrl!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  qrCodeToken?: string | null;
}

/**
 * Response for `POST /assets/qrcodes/bulk`. Per-asset entries.
 */
export class AssetBulkQRCodeResponseDto {
  @ApiProperty({ type: () => [AssetQRCodeResponseDto] })
  @Expose()
  @Type(() => AssetQRCodeResponseDto)
  qrcodes!: AssetQRCodeResponseDto[];
}
