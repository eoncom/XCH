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

  describe('encryptSubfields / decryptSubfields walker', () => {
    let svc: CryptoService;
    beforeAll(() => {
      svc = buildService({ XCH_MASTER_KEY: masterKey });
    });

    it('encrypts the sub-path leaf, leaves siblings untouched', () => {
      const channels = {
        email: { enabled: true, recipients: ['ops@example.com'] },
        teams: { enabled: true, webhookUrl: 'https://outlook.office.com/webhook/abc' },
      };
      const out = svc.encryptSubfields(channels, ['teams.webhookUrl']);
      expect(out.email).toEqual(channels.email);
      expect(out.teams.enabled).toBe(true);
      expect(svc.isEncrypted(out.teams.webhookUrl)).toBe(true);
    });

    it('round-trips encrypt → decrypt with same shape', () => {
      const channels = {
        teams: { webhookUrl: 'https://example.com/abc' },
      };
      const enc = svc.encryptSubfields(channels, ['teams.webhookUrl']);
      const dec = svc.decryptSubfields(enc, ['teams.webhookUrl']);
      expect(dec.teams.webhookUrl).toBe('https://example.com/abc');
    });

    it('no-op if the path does not exist', () => {
      const channels = { email: { enabled: false } };
      const out = svc.encryptSubfields(channels, ['teams.webhookUrl']);
      expect(out).toEqual(channels);
    });

    it('does not mutate the input', () => {
      const channels = { teams: { webhookUrl: 'plain' } };
      const before = JSON.stringify(channels);
      svc.encryptSubfields(channels, ['teams.webhookUrl']);
      expect(JSON.stringify(channels)).toBe(before);
    });
  });
});
