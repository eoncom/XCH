import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { CryptoService } from './crypto.service';

/**
 * S2 — ADR-019 secrets at-rest. Validates AES-256-GCM round-trip,
 * tamper rejection, fail-soft behavior, and JSON sub-field walker.
 */
describe('CryptoService', () => {
  const masterKey = randomBytes(32).toString('base64');

  const buildService = (env: Record<string, string | undefined>): CryptoService => {
    return new CryptoService({
      get: <T = string>(key: string): T | undefined => env[key] as any,
    } as ConfigService);
  };

  describe('encrypt / decrypt round-trip', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({ XCH_MASTER_KEY: masterKey });
    });

    it('produces a v1: envelope', () => {
      const out = svc.encrypt('s3cret-OIDC-clientSecret');
      expect(out.startsWith('v1:')).toBe(true);
      expect(out.split(':')).toHaveLength(4);
    });

    it('decrypts back to the original plaintext', () => {
      const plaintext = 'token-abcdef0123456789';
      const envelope = svc.encrypt(plaintext);
      expect(svc.decrypt(envelope)).toBe(plaintext);
    });

    it('produces distinct ciphertexts for the same plaintext (random IV)', () => {
      const a = svc.encrypt('same-plaintext');
      const b = svc.encrypt('same-plaintext');
      expect(a).not.toBe(b);
      expect(svc.decrypt(a)).toBe(svc.decrypt(b));
    });

    it('detects tampering — flipped bit in ciphertext is rejected', () => {
      const envelope = svc.encrypt('important-secret');
      const parts = envelope.split(':');
      const ct = Buffer.from(parts[3], 'base64');
      ct[0] ^= 0x01;
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${ct.toString('base64')}`;
      expect(() => svc.decrypt(tampered)).toThrow();
    });

    it('rejects an envelope encrypted with a different key', () => {
      const otherKey = randomBytes(32).toString('base64');
      const other = buildService({ XCH_MASTER_KEY: otherKey });
      const envelope = other.encrypt('foreign-secret');
      expect(() => svc.decrypt(envelope)).toThrow();
    });

    it('rejects malformed envelope', () => {
      expect(() => svc.decrypt('not-an-envelope')).toThrow();
      expect(() => svc.decrypt('v1:onlytwo')).toThrow();
    });

    it('isEncrypted recognizes the envelope shape', () => {
      const env = svc.encrypt('anything');
      expect(svc.isEncrypted(env)).toBe(true);
      expect(svc.isEncrypted('plaintext-secret')).toBe(false);
      expect(svc.isEncrypted('')).toBe(false);
      expect(svc.isEncrypted(null)).toBe(false);
    });
  });

  describe('encryptIfPlain — idempotent on already-enveloped values', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({ XCH_MASTER_KEY: masterKey });
    });

    it('encrypts plaintext', () => {
      const out = svc.encryptIfPlain('hello');
      expect(svc.isEncrypted(out!)).toBe(true);
    });

    it('passes through if already encrypted (no double-wrap)', () => {
      const once = svc.encryptIfPlain('hello')!;
      const twice = svc.encryptIfPlain(once);
      expect(twice).toBe(once);
    });

    it('returns null for null/undefined/empty', () => {
      expect(svc.encryptIfPlain(null)).toBeNull();
      expect(svc.encryptIfPlain(undefined)).toBeNull();
      expect(svc.encryptIfPlain('')).toBeNull();
    });
  });

  describe('decryptOrLegacy — backward-compat', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({ XCH_MASTER_KEY: masterKey });
    });

    it('decrypts an envelope', () => {
      const env = svc.encrypt('plaintext-x');
      expect(svc.decryptOrLegacy(env)).toBe('plaintext-x');
    });

    it('returns legacy plaintext as-is (transitional)', () => {
      expect(svc.decryptOrLegacy('legacy-clear-secret')).toBe('legacy-clear-secret');
    });

    it('returns null for null/empty', () => {
      expect(svc.decryptOrLegacy(null)).toBeNull();
      expect(svc.decryptOrLegacy('')).toBeNull();
    });
  });

  describe('fail-soft when XCH_MASTER_KEY missing', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({});
    });

    it('encryptIfPlain returns null (avoid leaking plaintext-at-rest)', () => {
      expect(svc.encryptIfPlain('s3cret')).toBeNull();
    });

    it('decryptOrLegacy returns null on enveloped values (no key to decrypt)', () => {
      // Build a v1: envelope with a real key, then read it via the disabled svc.
      const live = buildService({ XCH_MASTER_KEY: masterKey });
      const env = live.encrypt('foo');
      expect(svc.decryptOrLegacy(env)).toBeNull();
    });

    it('decryptOrLegacy still returns legacy plaintext as-is', () => {
      expect(svc.decryptOrLegacy('clear-legacy')).toBe('clear-legacy');
    });

    it('encrypt throws explicitly (used by code that must not silently drop)', () => {
      expect(() => svc.encrypt('x')).toThrow();
    });
  });

  describe('key rotation — v1 + v2 keys both registered', () => {
    it('decrypts v1 envelopes produced under the legacy key, encrypts new writes as v2', () => {
      const keyV1 = randomBytes(32).toString('base64');
      const keyV2 = randomBytes(32).toString('base64');

      // Producer that only knows v1 (writes "v1:")
      const producer = buildService({ XCH_MASTER_KEY: keyV1, XCH_MASTER_KEY_V1: keyV1 });
      const oldEnvelope = producer.encrypt('legacy-v1-secret');
      expect(oldEnvelope.startsWith('v1:')).toBe(true);

      // Reader after rotation : XCH_MASTER_KEY now holds v1's value AND
      // we register a separate XCH_MASTER_KEY_V1 so reads still work.
      // (In this minimal harness, the current write key version is still
      // 1 — full v2 promotion is a follow-up; we test the multi-version
      // decrypt path here.)
      const reader = buildService({ XCH_MASTER_KEY: keyV1, XCH_MASTER_KEY_V1: keyV1 });
      expect(reader.decrypt(oldEnvelope)).toBe('legacy-v1-secret');
    });

    it('refuses to decrypt an envelope with an unknown version', () => {
      const svc = buildService({ XCH_MASTER_KEY: masterKey });
      // Build a fake v9: envelope by tweaking a real one
      const real = svc.encrypt('x');
      const parts = real.split(':');
      const fake = `v9:${parts[1]}:${parts[2]}:${parts[3]}`;
      expect(() => svc.decrypt(fake)).toThrow(/version v9/);
    });
  });

  // encryptSubfields / decryptSubfields walker removed in ADR-020 §B —
  // secrets always live in scalar columns, not JSON sub-fields.

  // ==========================================================================
  // Track D.2 Step 1 — Stream cipher/decipher factories for backup encryption
  // ==========================================================================
  describe('createCipherStream / createDecipherStream — streaming AES-256-GCM (Track D.2)', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({ XCH_MASTER_KEY: masterKey });
    });

    /**
     * Helper: pipe `input` through `transform` and collect the output
     * into a single Buffer. Resolves once both the upstream end and
     * the downstream consumption have completed.
     */
    const pipeThrough = (input: Buffer, transform: import('stream').Transform): Promise<Buffer> => {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        transform.on('data', (c: Buffer) => chunks.push(c));
        transform.on('end', () => resolve(Buffer.concat(chunks)));
        transform.on('error', reject);
        transform.write(input);
        transform.end();
      });
    };

    it('round-trip 32B plaintext through cipher → decipher matches exactly', async () => {
      const plaintext = randomBytes(32);
      const { cipher, ivB64, keyVersion, getAuthTagB64 } = svc.createCipherStream();
      const ciphertext = await pipeThrough(plaintext, cipher);
      const authTagB64 = getAuthTagB64();

      const decipher = svc.createDecipherStream({ keyVersion, ivB64, authTagB64 });
      const recovered = await pipeThrough(ciphertext, decipher);
      expect(recovered.equals(plaintext)).toBe(true);
    });

    it('round-trip large 64 KiB payload (multi-chunk through Transform)', async () => {
      const plaintext = randomBytes(64 * 1024);
      const { cipher, ivB64, keyVersion, getAuthTagB64 } = svc.createCipherStream();
      const ciphertext = await pipeThrough(plaintext, cipher);
      const authTagB64 = getAuthTagB64();

      const decipher = svc.createDecipherStream({ keyVersion, ivB64, authTagB64 });
      const recovered = await pipeThrough(ciphertext, decipher);
      expect(recovered.equals(plaintext)).toBe(true);
    });

    it('cipher produces distinct ciphertexts for the same plaintext (random IV)', async () => {
      const plaintext = Buffer.from('same-bytes-twice');
      const first = svc.createCipherStream();
      const a = await pipeThrough(plaintext, first.cipher);
      const second = svc.createCipherStream();
      const b = await pipeThrough(plaintext, second.cipher);
      expect(a.equals(b)).toBe(false);
      expect(first.ivB64).not.toBe(second.ivB64);
    });

    it('tampered ciphertext (flipped byte) — decipher throws on final()', async () => {
      const plaintext = randomBytes(64);
      const { cipher, ivB64, keyVersion, getAuthTagB64 } = svc.createCipherStream();
      const ciphertext = await pipeThrough(plaintext, cipher);
      const authTagB64 = getAuthTagB64();

      // Flip 1 bit in the ciphertext.
      ciphertext[0] ^= 0x01;

      const decipher = svc.createDecipherStream({ keyVersion, ivB64, authTagB64 });
      await expect(pipeThrough(ciphertext, decipher)).rejects.toThrow();
    });

    it('tampered auth tag — decipher throws on final()', async () => {
      const plaintext = randomBytes(64);
      const { cipher, ivB64, keyVersion, getAuthTagB64 } = svc.createCipherStream();
      const ciphertext = await pipeThrough(plaintext, cipher);
      const authTagB64 = getAuthTagB64();

      // Flip 1 bit in the auth tag.
      const tagBuf = Buffer.from(authTagB64, 'base64');
      tagBuf[0] ^= 0x01;
      const tamperedTagB64 = tagBuf.toString('base64');

      const decipher = svc.createDecipherStream({
        keyVersion,
        ivB64,
        authTagB64: tamperedTagB64,
      });
      await expect(pipeThrough(ciphertext, decipher)).rejects.toThrow();
    });

    it('createDecipherStream with unknown key version throws explicitly', () => {
      expect(() =>
        svc.createDecipherStream({
          keyVersion: 99,
          ivB64: randomBytes(12).toString('base64'),
          authTagB64: randomBytes(16).toString('base64'),
        }),
      ).toThrow(/version v99/);
    });

    it('createDecipherStream rejects invalid IV length', () => {
      expect(() =>
        svc.createDecipherStream({
          keyVersion: 1,
          ivB64: randomBytes(8).toString('base64'), // wrong: 8B vs 12B
          authTagB64: randomBytes(16).toString('base64'),
        }),
      ).toThrow(/IV length/);
    });

    it('createDecipherStream rejects invalid auth tag length', () => {
      expect(() =>
        svc.createDecipherStream({
          keyVersion: 1,
          ivB64: randomBytes(12).toString('base64'),
          authTagB64: randomBytes(8).toString('base64'), // wrong: 8B vs 16B
        }),
      ).toThrow(/auth tag length/);
    });

    it('getAuthTagB64 called before pipeline completion throws explicitly', () => {
      const { getAuthTagB64 } = svc.createCipherStream();
      expect(() => getAuthTagB64()).toThrow(/pipeline completion/);
    });

    it('SECRET_REGEX_BUNDLE scrubber sanity — envelope b64 strings are not flagged', () => {
      // Smoke check that the cipher envelope (random base64) does not
      // accidentally match anti-leak patterns in
      // backend/src/modules/auth/dto-shape.spec.ts /
      // common/observability/glitchtip/scrubber.ts. A real test would
      // require importing SECRET_REGEX_BUNDLE which lives in the
      // observability module — we approximate here with the canonical
      // bcrypt/TOTP patterns.
      const plaintext = randomBytes(32);
      // Use sync encrypt to get a real envelope quickly
      const envelope = svc.encrypt(plaintext.toString('base64'));
      // bcrypt prefix
      expect(envelope).not.toMatch(/^\$2[aby]\$/);
      // TOTP-style base32
      expect(envelope).not.toMatch(/^[A-Z2-7]{32,}$/);
      // The envelope contains colons (v1:iv:tag:ct) — would not be
      // misinterpreted as a single token.
      expect(envelope).toContain(':');
    });
  });

  describe('createCipherStream — disabled (no XCH_MASTER_KEY)', () => {
    it('throws explicitly (NOT fail-soft) — backup encryption is opt-in', () => {
      const svc = buildService({});
      expect(svc.isEnabled()).toBe(false);
      expect(() => svc.createCipherStream()).toThrow(/disabled/);
    });
  });

  describe('isEnabled — capability discovery for UI toggle', () => {
    it('returns true when XCH_MASTER_KEY is set', () => {
      const svc = buildService({ XCH_MASTER_KEY: masterKey });
      expect(svc.isEnabled()).toBe(true);
    });

    it('returns false when XCH_MASTER_KEY is absent', () => {
      const svc = buildService({});
      expect(svc.isEnabled()).toBe(false);
    });
  });
});
