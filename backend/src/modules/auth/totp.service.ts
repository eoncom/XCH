import { Injectable } from '@nestjs/common';
import { generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class TotpService {
  generateSecret(email: string): { secret: string; otpAuthUrl: string } {
    const secret = otpGenerateSecret();
    const otpAuthUrl = generateURI({
      issuer: 'XCH',
      label: email,
      secret,
    });
    return { secret, otpAuthUrl };
  }

  async generateQRCodeDataUrl(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  verifyToken(secret: string, token: string): boolean {
    const result = verifySync({ secret, token, epochTolerance: 30 });
    return result.valid;
  }

  async generateBackupCodes(): Promise<{ codes: string[]; hashedCodes: string[] }> {
    const codes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
      const hashed = await bcrypt.hash(code, 10);
      hashedCodes.push(hashed);
    }

    return { codes, hashedCodes };
  }

  async verifyBackupCode(
    code: string,
    hashedCodes: string[],
  ): Promise<{ valid: boolean; remainingCodes: string[] }> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await bcrypt.compare(code.toUpperCase(), hashedCodes[i]);
      if (match) {
        const remainingCodes = [...hashedCodes];
        remainingCodes.splice(i, 1);
        return { valid: true, remainingCodes };
      }
    }
    return { valid: false, remainingCodes: hashedCodes };
  }
}
