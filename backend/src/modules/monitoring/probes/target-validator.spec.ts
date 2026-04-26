import { MonitorKind } from '@prisma/client';
import { isPrivateOrLoopback, validateTarget } from './target-validator';

describe('target-validator — isPrivateOrLoopback (IPv4)', () => {
  describe('always blocked (regardless of allowInternal)', () => {
    it.each([
      ['127.0.0.1', 'loopback /8'],
      ['127.255.255.254', 'loopback edge'],
      ['169.254.10.20', 'link-local /16'],
      ['0.0.0.0', '"this network" /8'],
      ['224.0.0.1', 'multicast'],
      ['239.255.255.255', 'multicast edge'],
      ['255.255.255.255', 'broadcast / reserved'],
    ])('%s (%s) is blocked even with allowInternal=true', (ip) => {
      expect(isPrivateOrLoopback(ip, true)).toBe(true);
      expect(isPrivateOrLoopback(ip, false)).toBe(true);
    });
  });

  describe('conditionally blocked (RFC1918 — gated by allowInternal)', () => {
    it.each([
      ['10.0.0.1', '10/8'],
      ['10.255.255.254', '10/8 edge'],
      ['172.16.0.1', '172.16/12 start'],
      ['172.31.255.254', '172.16/12 end'],
      ['192.168.1.1', '192.168/16'],
      ['100.64.0.1', 'CG-NAT 100.64/10'],
    ])('%s (%s) blocked when allowInternal=false, allowed when true', (ip) => {
      expect(isPrivateOrLoopback(ip, false)).toBe(true);
      expect(isPrivateOrLoopback(ip, true)).toBe(false);
    });

    it('172.15.x and 172.32.x are NOT in 172.16/12 (boundary check)', () => {
      expect(isPrivateOrLoopback('172.15.0.1', false)).toBe(false);
      expect(isPrivateOrLoopback('172.32.0.1', false)).toBe(false);
    });
  });

  describe('public addresses', () => {
    it.each(['8.8.8.8', '1.1.1.1', '142.250.46.46'])('%s is allowed', (ip) => {
      expect(isPrivateOrLoopback(ip, false)).toBe(false);
      expect(isPrivateOrLoopback(ip, true)).toBe(false);
    });
  });
});

describe('target-validator — isPrivateOrLoopback (IPv6)', () => {
  it('::1 is always blocked', () => {
    expect(isPrivateOrLoopback('::1', true)).toBe(true);
    expect(isPrivateOrLoopback('::1', false)).toBe(true);
  });

  it('link-local fe80::/10 is always blocked', () => {
    expect(isPrivateOrLoopback('fe80::1', true)).toBe(true);
  });

  it('multicast ff00::/8 is always blocked', () => {
    expect(isPrivateOrLoopback('ff02::1', true)).toBe(true);
  });

  it('unique-local fc00::/7 is gated by allowInternal', () => {
    expect(isPrivateOrLoopback('fc00::1', false)).toBe(true);
    expect(isPrivateOrLoopback('fd00::1', false)).toBe(true);
    expect(isPrivateOrLoopback('fc00::1', true)).toBe(false);
  });

  it('IPv4-mapped ::ffff:127.0.0.1 unwraps and blocks loopback', () => {
    expect(isPrivateOrLoopback('::ffff:127.0.0.1', true)).toBe(true);
  });

  it('IPv4-mapped ::ffff:10.0.0.1 unwraps and respects allowInternal', () => {
    expect(isPrivateOrLoopback('::ffff:10.0.0.1', false)).toBe(true);
    expect(isPrivateOrLoopback('::ffff:10.0.0.1', true)).toBe(false);
  });

  it('global IPv6 (2001:db8::1) is allowed', () => {
    // Note: 2001:db8::/32 is documentation-only but our validator only
    // blocks the well-known private/multicast/link-local prefixes.
    expect(isPrivateOrLoopback('2001:db8::1', false)).toBe(false);
  });
});

describe('target-validator — validateTarget HTTP', () => {
  it('accepts a public https URL', () => {
    const r = validateTarget('https://example.com/health', MonitorKind.HTTP, false);
    expect(r.ok).toBe(true);
    expect(r.host).toBe('example.com');
  });

  it('rejects file:// scheme', () => {
    const r = validateTarget('file:///etc/passwd', MonitorKind.HTTP, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/scheme/);
  });

  it('rejects ftp:// scheme', () => {
    const r = validateTarget('ftp://example.com', MonitorKind.HTTP, false);
    expect(r.ok).toBe(false);
  });

  it('rejects an http URL pointing at localhost (loopback)', () => {
    const r = validateTarget('http://127.0.0.1:8080/admin', MonitorKind.HTTP, true);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/SSRF|private|loopback/i);
  });

  it('accepts http://10.0.0.1 only when allowInternal=true', () => {
    expect(validateTarget('http://10.0.0.1/', MonitorKind.HTTP, false).ok).toBe(false);
    expect(validateTarget('http://10.0.0.1/', MonitorKind.HTTP, true).ok).toBe(true);
  });

  it('rejects malformed URL', () => {
    const r = validateTarget('not a url', MonitorKind.HTTP, false);
    expect(r.ok).toBe(false);
  });
});

describe('target-validator — validateTarget TCP/ICMP', () => {
  it('accepts a hostname for ICMP', () => {
    const r = validateTarget('example.com', MonitorKind.ICMP, false);
    expect(r.ok).toBe(true);
    expect(r.host).toBe('example.com');
  });

  it('accepts a public IP for TCP', () => {
    const r = validateTarget('8.8.8.8', MonitorKind.TCP, false);
    expect(r.ok).toBe(true);
  });

  it('rejects 127.0.0.1 for ICMP even with allowInternal', () => {
    const r = validateTarget('127.0.0.1', MonitorKind.ICMP, true);
    expect(r.ok).toBe(false);
  });

  it('rejects a URL given as ICMP target', () => {
    const r = validateTarget('https://example.com', MonitorKind.ICMP, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/scheme/);
  });

  it('rejects path/query for TCP target', () => {
    expect(validateTarget('host/path', MonitorKind.TCP, false).ok).toBe(false);
    expect(validateTarget('host?q=1', MonitorKind.TCP, false).ok).toBe(false);
  });

  it('rejects host:port appended (port must be in targetPort)', () => {
    const r = validateTarget('example.com:8080', MonitorKind.TCP, false);
    expect(r.ok).toBe(false);
  });

  it('rejects empty / whitespace / oversized targets', () => {
    expect(validateTarget('', MonitorKind.TCP, false).ok).toBe(false);
    expect(validateTarget(' example.com ', MonitorKind.TCP, false).ok).toBe(false);
    expect(validateTarget('a'.repeat(2049), MonitorKind.TCP, false).ok).toBe(false);
  });
});
