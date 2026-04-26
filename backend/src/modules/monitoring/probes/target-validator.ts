import { isIP } from 'net';
import { URL } from 'url';
import { MonitorKind } from '@prisma/client';

/**
 * SSRF defense (ADR-014 §6).
 *
 * `validateTarget` is called at CRUD time (create/update of a MonitorCheck)
 * AND `isPrivateOrLoopback` is also called at probe time via the `lookup`
 * hook (`safe-lookup.ts`) to defeat DNS rebinding.
 *
 * Loopback (127.0.0.0/8, ::1) and link-local (169.254.0.0/16) are ALWAYS
 * blocked, even when the tenant has `allowInternalMonitorTargets = true`.
 * The toggle only unlocks RFC1918 (10/8, 172.16/12, 192.168/16) and IPv6
 * unique-local (fc00::/7).
 */

export interface TargetValidationResult {
  ok: boolean;
  reason?: string;
  /** Hostname (or IP) extracted from the target — useful for logging/UI. */
  host?: string;
}

const ALLOWED_HTTP_SCHEMES = new Set(['http', 'https']);

/**
 * Returns true if the IP literal falls in a private / loopback / link-local
 * range we want to block by default. With `allowInternal=true`, RFC1918 and
 * IPv6 unique-local are unblocked but loopback/link-local stay blocked.
 *
 * Accepts IPv4 dotted quads and IPv6 textual addresses. Returns false (= not
 * blocked) for inputs that aren't valid IP literals — those should be checked
 * separately as hostnames before resolution.
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

/**
 * Validate a CRUD target before insertion. Per kind:
 *  - ICMP / TCP : target must be a hostname or IP literal (no scheme).
 *  - HTTP       : target must be a parseable URL with http/https scheme.
 *
 * For IP literals, applies the private/loopback policy immediately. For
 * hostnames, the actual IP check happens at probe time via the safe-lookup
 * hook (DNS-rebinding-proof).
 */
export function validateTarget(
  target: string,
  kind: MonitorKind,
  allowInternal: boolean,
): TargetValidationResult {
  if (!target || target.trim() !== target) {
    return { ok: false, reason: 'target empty or has surrounding whitespace' };
  }
  if (target.length > 2048) {
    return { ok: false, reason: 'target too long (>2048 chars)' };
  }

  if (kind === MonitorKind.HTTP) {
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return { ok: false, reason: 'invalid URL' };
    }
    const scheme = url.protocol.replace(':', '');
    if (!ALLOWED_HTTP_SCHEMES.has(scheme)) {
      return { ok: false, reason: `scheme not allowed: ${scheme}` };
    }
    const host = url.hostname;
    if (!host) return { ok: false, reason: 'URL has no hostname' };
    // Strip IPv6 brackets that URL preserves on .hostname for v6 hosts.
    const cleanHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
    if (isIP(cleanHost) && isPrivateOrLoopback(cleanHost, allowInternal)) {
      return { ok: false, reason: `target IP ${cleanHost} is private/loopback (SSRF blocked)` };
    }
    return { ok: true, host: cleanHost };
  }

  // ICMP / TCP — bare hostname or IP literal, no scheme expected.
  if (target.includes('://')) {
    return { ok: false, reason: 'scheme not allowed for ICMP/TCP target (use hostname or IP only)' };
  }
  if (target.includes('/') || target.includes('?') || target.includes('#')) {
    return { ok: false, reason: 'path/query not allowed for ICMP/TCP target' };
  }
  if (target.includes(':') && isIP(target) === 0) {
    // Could be an IPv6 literal — but those should be wrapped in [] only for
    // URLs; bare v6 is fine. If isIP() rejects it, it's a malformed target.
    return { ok: false, reason: 'invalid host (port must be set via targetPort, not appended)' };
  }
  if (isIP(target) && isPrivateOrLoopback(target, allowInternal)) {
    return { ok: false, reason: `target IP ${target} is private/loopback (SSRF blocked)` };
  }
  return { ok: true, host: target };
}
