import { isIP } from 'net';
import { URL } from 'url';
import { isPrivateOrLoopback } from './private-ip';

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
  /** Hostname extracted from the URL (IPv6 brackets stripped). */
  host?: string;
}

const DEFAULT_SCHEMES = new Set(['http', 'https']);

/**
 * Validate a full URL before persisting it (ADR-016). Used by:
 *  - Native HTTP monitors (target is a URL).
 *  - Notification webhooks (Teams incoming-webhook URL).
 *  - Any future outbound HTTP integration where the URL is operator-supplied.
 *
 * Checks: parseable URL, scheme in allowlist (default http/https), hostname
 * present, and — when the hostname is an IP literal — not in private/loopback
 * ranges unless `allowInternal=true`. Hostnames pass at this stage; their
 * resolved IP is re-checked at connect time via `safe-lookup.ts`.
 */
export function validateUrl(
  url: string,
  allowInternal: boolean,
  allowedSchemes: Set<string> = DEFAULT_SCHEMES,
): UrlValidationResult {
  if (!url || url.trim() !== url) {
    return { ok: false, reason: 'url empty or has surrounding whitespace' };
  }
  if (url.length > 2048) {
    return { ok: false, reason: 'url too long (>2048 chars)' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  const scheme = parsed.protocol.replace(':', '');
  if (!allowedSchemes.has(scheme)) {
    return { ok: false, reason: `scheme not allowed: ${scheme}` };
  }
  const rawHost = parsed.hostname;
  if (!rawHost) return { ok: false, reason: 'URL has no hostname' };
  // Strip IPv6 brackets that URL preserves on .hostname for v6 hosts.
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
  if (isIP(host) && isPrivateOrLoopback(host, allowInternal)) {
    return { ok: false, reason: `host IP ${host} is private/loopback (SSRF blocked)` };
  }
  return { ok: true, host };
}
