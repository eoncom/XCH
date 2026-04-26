import { isIP } from 'net';

/**
 * SSRF defense — IP range classification (ADR-016).
 *
 * Returns true if the IP literal falls in a private / loopback / link-local
 * range we want to block by default. With `allowInternal=true`, RFC1918
 * (and IPv6 unique-local) are unblocked but loopback / link-local /
 * multicast / "this-network" stay blocked regardless.
 *
 * Used at CRUD time (validating user-supplied targets) AND at probe time via
 * the `safe-lookup.ts` DNS hook to defeat DNS rebinding.
 *
 * Accepts IPv4 dotted quads and IPv6 textual addresses. Returns false for
 * inputs that aren't valid IP literals — those should be checked separately
 * as hostnames before resolution.
 */
export function isPrivateOrLoopback(ip: string, allowInternal: boolean): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateOrLoopbackV4(ip, allowInternal);
  if (family === 6) return isPrivateOrLoopbackV6(ip, allowInternal);
  return false;
}

function isPrivateOrLoopbackV4(ip: string, allowInternal: boolean): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;

  // Always blocked (even with allowInternal):
  if (a === 127) return true;                       // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;          // 169.254.0.0/16 link-local
  if (a === 0) return true;                         // 0.0.0.0/8 "this network"
  if (a >= 224) return true;                        // 224/4 multicast + 240/4 reserved

  if (allowInternal) return false;

  // Conditionally blocked (unblocked when allowInternal=true):
  if (a === 10) return true;                        // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;          // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 carrier-grade NAT

  return false;
}

function isPrivateOrLoopbackV6(ip: string, allowInternal: boolean): boolean {
  const lower = ip.toLowerCase();

  // Always blocked:
  if (lower === '::' || lower === '::1') return true;       // unspecified + loopback
  if (lower.startsWith('fe80:')) return true;               // link-local fe80::/10
  if (lower.startsWith('ff')) return true;                  // multicast ff00::/8

  // IPv4-mapped (::ffff:x.x.x.x) — unwrap and re-check the v4 part.
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateOrLoopbackV4(v4Mapped[1], allowInternal);

  if (allowInternal) return false;

  // Unique-local fc00::/7 → first byte 0xfc or 0xfd → starts with "fc" or "fd".
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  return false;
}
