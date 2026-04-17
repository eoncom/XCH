import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

@Injectable()
export class QRCodeService {
  async generateQRCode(data: string): Promise<string> {
    try {
      // Generate QR code as Data URL (base64)
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  async generateQRCodeBuffer(data: string): Promise<Buffer> {
    try {
      const buffer = await QRCode.toBuffer(data, {
        errorCorrectionLevel: 'M',
        type: 'png',
        width: 300,
        margin: 1,
      });
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code buffer: ${error.message}`);
    }
  }

  generateAssetQRUrl(baseUrl: string, assetId: string, token: string): string {
    return `${baseUrl}/dashboard/assets/${assetId}?qr=${token}`;
  }

  generateSecureToken(): string {
    // 24 bytes → 32 chars base64url — cryptographically secure
    return randomBytes(24).toString('base64url');
  }
}
