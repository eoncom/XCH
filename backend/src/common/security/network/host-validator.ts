import { isIP } from 'net';
import { isPrivateOrLoopback } from './private-ip';

export interface HostValidationResult {
  ok: boolean;
  reason?: string;
  /** Cleaned host (input with whitespace stripped) — useful for logging. */
  host?: string;
}

/**
 * Validate a bare hostname or IP literal target before persistence (ADR-016).
 *
 * Rejects: schemes (`://`), paths/queries, embedded ports (use a separate
 * port field), invalid IPv6, and IP literals in private/loopback ranges
 * unless `allowInternal=true` (loopback/link-local always blocked).
 *
 * Hostnames are accepted at this layer; their resolution is checked again
 * at connect time via `safe-lookup.ts` (defeats DNS rebinding).
 */
export function validateHost(host: string, allowInternal: boolean): HostValidationResult {
  if (!host || host.trim() !== host) {
    return { ok: false, reason: 'host empty or has surrounding whitespace' };
  }
  if (host.length > 2048) {
    return { ok: false, reason: 'host too long (>2048 chars)' };
  }
  if (host.includes('://')) {
    return { ok: false, reason: 'scheme not allowed (provide bare hostname or IP)' };
  }
  if (host.includes('/') || host.includes('?') || host.includes('#')) {
    return { ok: false, reason: 'path/query not allowed in host' };
  }
  if (host.includes(':') && isIP(host) === 0) {
    // ":" appears only in IPv6 literals (handled by isIP) or in `host:port`
    // accidental input — port must be passed separately, not appended here.
    return { ok: false, reason: 'invalid host (port must be set separately, not appended)' };
  }
  if (isIP(host) && isPrivateOrLoopback(host, allowInternal)) {
    return { ok: false, reason: `host IP ${host} is private/loopback (SSRF blocked)` };
  }
  return { ok: true, host };
}
