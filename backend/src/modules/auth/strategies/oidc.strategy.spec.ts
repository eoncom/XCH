import { normalizeRight } from './oidc.strategy';

/**
 * S4 — Pure-helper test for normalizeRight().
 *
 * The OidcStrategy class itself can't be instantiated in isolation here
 * (passport-openidconnect needs an issuer/clientID at constructor time and
 * requires HTTP discovery); we only assert the role-mapping helper since
 * it's the piece carrying business logic.
 */
describe('OidcStrategy.normalizeRight', () => {
  it('maps legacy ADMIN/MANAGER → MANAGE', () => {
    expect(normalizeRight('ADMIN')).toBe('MANAGE');
    expect(normalizeRight('MANAGER')).toBe('MANAGE');
    expect(normalizeRight('admin')).toBe('MANAGE');
    expect(normalizeRight('Manager')).toBe('MANAGE');
  });

  it('maps legacy TECHNICIEN/TECHNICIAN → WRITE', () => {
    expect(normalizeRight('TECHNICIEN')).toBe('WRITE');
    expect(normalizeRight('TECHNICIAN')).toBe('WRITE');
    expect(normalizeRight('technicien')).toBe('WRITE');
  });

  it('maps legacy VIEWER → READ', () => {
    expect(normalizeRight('VIEWER')).toBe('READ');
    expect(normalizeRight('viewer')).toBe('READ');
  });

  it('passes through new MANAGE/WRITE/READ unchanged', () => {
    expect(normalizeRight('MANAGE')).toBe('MANAGE');
    expect(normalizeRight('WRITE')).toBe('WRITE');
    expect(normalizeRight('READ')).toBe('READ');
  });

  it('falls back to READ on unknown values', () => {
    expect(normalizeRight('SUPERHERO')).toBe('READ');
    expect(normalizeRight('')).toBe('READ');
    expect(normalizeRight(undefined)).toBe('READ');
  });

  it('is case-insensitive', () => {
    expect(normalizeRight('manage')).toBe('MANAGE');
    expect(normalizeRight('Write')).toBe('WRITE');
    expect(normalizeRight('rEaD')).toBe('READ');
  });
});
