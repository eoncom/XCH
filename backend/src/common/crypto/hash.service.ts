import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * SHA-256 one-way hashing for short-lived auth tokens (ADR-019 §6).
 *
 * Used for User.inviteToken and User.resetToken — tokens issued in the
 * clear (sent by email), looked up by hash. Pas de chiffrement (la
 * clé de chiffrement rotable casserait les tokens en cours de validité)
 * et pas de bcrypt (overkill pour un secret 128-bit aléatoire à durée
 * de vie ≤ 24h).
 */
@Injectable()
export class HashService {
  /** SHA-256 hex digest of the input. */
  sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /** Constant-time hex digest comparison. */
  safeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  }
}
