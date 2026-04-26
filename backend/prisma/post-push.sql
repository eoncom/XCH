-- =============================================================================
-- post-push.sql — SQL constraints applied AFTER `prisma db push`.
-- Idempotent: safe to run repeatedly. Run via `npm run db:sync`.
-- =============================================================================
-- Native monitoring (ADR-014) — enforce polymorphic-target invariant on
-- monitor_checks: exactly ONE of (siteId, assetId, linkId) must be non-null.
-- Prisma 5.x has no native @@check support, so we apply this directly.
-- The app-service-layer also validates this, so this is defense in depth.
-- =============================================================================

ALTER TABLE "monitor_checks"
  DROP CONSTRAINT IF EXISTS "monitor_checks_target_exclusive";

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_target_exclusive"
  CHECK (num_nonnulls("siteId", "assetId", "linkId") = 1);

-- TCP probes must have a port; non-TCP probes must NOT have one.
-- Keeps target semantics tight without leaking parsing into the app layer.
ALTER TABLE "monitor_checks"
  DROP CONSTRAINT IF EXISTS "monitor_checks_tcp_port_required";

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_tcp_port_required"
  CHECK (
    (kind = 'TCP'  AND "targetPort" IS NOT NULL) OR
    (kind <> 'TCP' AND "targetPort" IS NULL)
  );

-- intervalSec sanity bounds: 60s .. 3600s.
ALTER TABLE "monitor_checks"
  DROP CONSTRAINT IF EXISTS "monitor_checks_interval_bounds";

ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_interval_bounds"
  CHECK ("intervalSec" >= 60 AND "intervalSec" <= 3600);
