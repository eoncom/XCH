import { MonitorKind } from '@prisma/client';
import {
  validateHost,
  validateUrl,
  type HostValidationResult,
  type UrlValidationResult,
} from '../../../common/security/network';

/**
 * Monitoring-specific dispatcher (ADR-016) — kind-aware validation that
 * delegates to the generic `common/security/network` primitives.
 *
 * For HTTP probes the target is a full URL; for ICMP/TCP it's a bare host
 * or IP literal (the port lives in MonitorCheck.targetPort, never appended).
 */

export type TargetValidationResult = HostValidationResult | UrlValidationResult;

export function validateTarget(
  target: string,
  kind: MonitorKind,
  allowInternal: boolean,
): TargetValidationResult {
  if (kind === MonitorKind.HTTP) {
    return validateUrl(target, allowInternal);
  }
  return validateHost(target, allowInternal);
}

// Backwards-compatible re-exports so existing probe code can keep its imports.
export { isPrivateOrLoopback } from '../../../common/security/network';
