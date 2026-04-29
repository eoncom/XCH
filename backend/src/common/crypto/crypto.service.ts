import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

/**
 * AES-256-GCM secret encryption-at-rest service (ADR-019).
 *
 * Stored format: `v<n>:<iv-b64>:<tag-b64>:<ct-b64>`
 *   - v<n> versions the master key — rotation produces v2, ancien `v1`
 *     reste décryptable via XCH_MASTER_KEY_V1.
 *   - iv : 12 bytes random per encrypt (GCM standard).
 *   - tag : 16 bytes auth tag, vérifié au decrypt (rejette tamper).
 *
 * Pas de KMS externe pour la phase pilote — le service est l'interface
 * qu'on remplacera en v2.0+ si besoin.
 *
 * Fail-soft : si XCH_MASTER_KEY est absente, encrypt/decrypt logguent
 * un warn et retournent null. Le boot ne bloque pas (pour ne pas casser
 * dev/CI/smoke). Cf. décision §4 ADR-019.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly authTagLength = 16;
  private readonly currentVersion = 1;

  // Map version → 32-byte key buffer. Lookup at decrypt-time, single key
  // at encrypt-time (currentVersion).
  private readonly keys = new Map<number, Buffer>();
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const v1 = this.loadKey('XCH_MASTER_KEY');
    if (v1) this.keys.set(1, v1);

    // Forward-compat for rotation: XCH_MASTER_KEY_V1, _V2, etc. let the
    // service decrypt legacy values after a key bump while
    // XCH_MASTER_KEY itself becomes the new (v2+) write key.
    for (let n = 1; n <= 5; n++) {
      const k = this.loadKey(`XCH_MASTER_KEY_V${n}`);
      if (k) this.keys.set(n, k);
    }

    this.enabled = this.keys.has(this.currentVersion);
    if (!this.enabled) {
      this.logger.warn(
        'XCH_MASTER_KEY missing — secret read/write will fail-soft. ' +
          'Set XCH_MASTER_KEY (32-byte base64) to enable at-rest encryption.',
      );
    }
  }

  /** True if the value is in the encrypted envelope format `v<n>:...`. */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^v\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value);
  }

  /**
   * Encrypt a plaintext string. Returns the envelope or throws if the
   * service is disabled (caller should usually use `encryptIfPlain`).
   */
  encrypt(plaintext: string): string {
    if (!this.enabled) {
      throw new Error(
        'CryptoService disabled (XCH_MASTER_KEY missing) — cannot encrypt',
      );
    }
    const key = this.keys.get(this.currentVersion)!;
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v${this.currentVersion}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  /**
   * Decrypt an envelope. Throws if format invalid, key version unknown
   * or auth tag mismatched (tamper detected).
   */
  decrypt(envelope: string): string {
    const match = /^v(\d+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/.exec(
      envelope,
    );
    if (!match) {
      throw new Error('Invalid encrypted envelope format');
    }
    const version = Number(match[1]);
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(
        `No master key registered for version v${version} (set XCH_MASTER_KEY_V${version})`,
      );
    }
    const iv = Buffer.from(match[2], 'base64');
    const tag = Buffer.from(match[3], 'base64');
    const ciphertext = Buffer.from(match[4], 'base64');
    const decipher = createDecipheriv(this.algorithm, key, iv, {
      authTagLength: this.authTagLength,
    });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  /**
   * Encrypt only if the value is plaintext (not already enveloped).
   * No-op (returns the value as-is) if already encrypted, null/undefined
   * passthrough. Returns null if the service is disabled — the caller
   * persists null instead of leaking plaintext into the DB.
   */
  encryptIfPlain(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    if (this.isEncrypted(value)) return value;
    if (!this.enabled) {
      this.logger.warn(
        'encryptIfPlain called with crypto disabled — dropping value to avoid plaintext-at-rest',
      );
      return null;
    }
    return this.encrypt(value);
  }

  /**
   * Decrypt if enveloped, otherwise return the value as-is and log a
   * warning. Lets us roll out encryption without forcing an immediate
   * reset of every existing row — the next write will re-encrypt.
   */
  decryptOrLegacy(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    if (!this.isEncrypted(value)) {
      // Don't warn for empty-ish or obviously-fresh formats; only when
      // we have something that looks like a real legacy plaintext.
      this.logger.warn(
        'Legacy plaintext secret detected — will be encrypted on next write',
      );
      return value;
    }
    if (!this.enabled) {
      this.logger.warn(
        'decryptOrLegacy called with crypto disabled — returning null',
      );
      return null;
    }
    try {
      return this.decrypt(value);
    } catch (err: any) {
      this.logger.error(
        `Decrypt failed (${err?.message}) — returning null to avoid leaking ciphertext`,
      );
      return null;
    }
  }

  /** Constant-time string compare — kept here so callers don't reach for crypto directly. */
  safeEquals(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  private loadKey(envName: string): Buffer | null {
    const raw = this.configService.get<string>(envName);
    if (!raw) return null;
    let key: Buffer;
    try {
      key = Buffer.from(raw, 'base64');
    } catch {
      this.logger.error(`${envName}: not valid base64 — ignored`);
      return null;
    }
    if (key.length !== 32) {
      this.logger.error(
        `${envName}: must decode to 32 bytes, got ${key.length} — ignored`,
      );
      return null;
    }
    return key;
  }
}
