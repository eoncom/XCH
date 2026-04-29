import { HashService } from './hash.service';

describe('HashService', () => {
  const svc = new HashService();

  it('produces a 64-char hex SHA-256', () => {
    const out = svc.sha256('hello');
    expect(out).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input → same hash', () => {
    expect(svc.sha256('token-abc')).toBe(svc.sha256('token-abc'));
  });

  it('different inputs produce different hashes', () => {
    expect(svc.sha256('a')).not.toBe(svc.sha256('b'));
  });

  it('matches the canonical SHA-256("hello") test vector', () => {
    expect(svc.sha256('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('safeEquals returns true for identical hashes', () => {
    const h = svc.sha256('x');
    expect(svc.safeEquals(h, h)).toBe(true);
  });

  it('safeEquals returns false for different lengths', () => {
    expect(svc.safeEquals('abc', 'abcd')).toBe(false);
  });

  it('safeEquals returns false for different equal-length strings', () => {
    const a = svc.sha256('a');
    const b = svc.sha256('b');
    expect(svc.safeEquals(a, b)).toBe(false);
  });
});
