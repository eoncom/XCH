/**
 * SSRF-safe network primitives (ADR-016).
 *
 * Use these for ANY operator-supplied target URL / hostname / IP that the
 * server will subsequently connect to (monitor probes, outbound webhooks,
 * future integrations). Validate at CRUD time AND let the safe-lookup hook
 * re-validate at connect time — defense in depth, no single point of trust.
 */

export { isPrivateOrLoopback } from './private-ip';
export { validateHost, type HostValidationResult } from './host-validator';
export { validateUrl, type UrlValidationResult } from './url-validator';
export { makeSafeLookup } from './safe-lookup';
export { makeSafeAgents, makeSafeAxios, type SafeAxiosOptions } from './safe-http';
