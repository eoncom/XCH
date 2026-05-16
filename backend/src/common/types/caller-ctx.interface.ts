import { Logger } from '@nestjs/common';

/**
 * ADR-021 — uniform request-scoped authorization context.
 *
 * Built by `@CallerCtx()` param decorator from `req.user`,
 * `req.delegationId` and `req.localRole`. Passed to every service
 * method that touches tenant-scoped data. The service then delegates
 * row-level filtering to `PermissionService.getReadable*Ids` /
 * `assertCanRead/Write*` helpers.
 *
 * Replaces the historical pattern of pre-resolving an `accessibleSiteIds`
 * array at the controller and passing it down — that pattern was easy
 * to forget (cf. Contact bug, 4-year regression).
 */
export interface CallerCtx {
  userId: string;
  isSuperAdmin: boolean;
  tenantId: string;
  /** Active delegation from the `X-Delegation-Id` header, null on @SkipDelegation routes. */
  activeDelegationId: string | null;
  /** Local role inside `activeDelegationId`, set by `DelegationGuard`. */
  activeRight: 'MANAGE' | 'WRITE' | 'READ' | null;
  /**
   * Set ONLY when the context comes from `SYSTEM_CTX(reason, …)`.
   * Lets services and audit log distinguish a real user action from a
   * cron / BullMQ / seed bypass.
   */
  systemReason?: string;
  /**
   * Source IP captured from `req.ip` (IPv4-mapped IPv6 like `::ffff:1.2.3.4`
   * is normalized to `1.2.3.4`). Populated by `@CallerCtxParam()` for HTTP
   * requests, `null` for `SYSTEM_CTX` (cron/BullMQ/seed).
   *
   * ADR-028 §B.1 — capture systémique pour audit forensique air-gap.
   */
  ipAddress?: string | null;
  /**
   * Source User-Agent captured from `req.headers['user-agent']`. Populated by
   * `@CallerCtxParam()` for HTTP requests, `null` for `SYSTEM_CTX`.
   *
   * ADR-028 §B.1.
   */
  userAgent?: string | null;
}

/**
 * Build a system-level CallerCtx for cron jobs, BullMQ processors and
 * seeders. **Each call is logged** at INFO via the dedicated
 * `AuditSystemCtx` channel so that authz bypasses are auditable
 * (grep `[SYSTEM_CTX]` in production logs to see the full list).
 *
 * Convention : pass a stable string identifying the caller, e.g.
 *   - `SYSTEM_CTX('cron-warranty-expiring', tenantId)`
 *   - `SYSTEM_CTX('bullmq-notification-dispatch', payload.tenantId)`
 *   - `SYSTEM_CTX('seed-demo-tenant', tenantId)`
 */
const auditLogger = new Logger('AuditSystemCtx');

export function SYSTEM_CTX(reason: string, tenantId: string): CallerCtx {
  if (!reason || !tenantId) {
    // Fail-fast in dev — every system bypass MUST identify itself.
    throw new Error('SYSTEM_CTX requires a non-empty reason and tenantId');
  }
  auditLogger.log(`[SYSTEM_CTX] used by ${reason} on tenant=${tenantId}`);
  return {
    userId: 'system',
    isSuperAdmin: true,
    tenantId,
    activeDelegationId: null,
    activeRight: 'MANAGE',
    systemReason: reason,
    // ADR-028 §B.0 — SYSTEM_CTX forces null per Nullability taxonomy
    // (cron/BullMQ/seed = legitimate null on audit_log.delegationId)
    ipAddress: null,
    userAgent: null,
  };
}
