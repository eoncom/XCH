-- =============================================================================
-- 1_post_push_constraints — defense-in-depth CHECK constraints (ADR-014).
--
-- These three constraints used to live in backend/prisma/post-push.sql and were
-- replayed idempotently on every API boot. With versioned migrations (ADR-017)
-- they belong in the schema history. The app service layer also enforces these
-- invariants — these are the last line of defense at the database level.
-- =============================================================================

-- monitor_checks polymorphic-target invariant: exactly ONE of (siteId, assetId,
-- linkId) must be non-null.
ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_target_exclusive"
  CHECK (num_nonnulls("siteId", "assetId", "linkId") = 1);

-- TCP probes must have a port; non-TCP probes must NOT have one.
ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_tcp_port_required"
  CHECK (
    (kind = 'TCP'  AND "targetPort" IS NOT NULL) OR
    (kind <> 'TCP' AND "targetPort" IS NULL)
  );

-- intervalSec sanity bounds: 60s .. 3600s.
ALTER TABLE "monitor_checks"
  ADD CONSTRAINT "monitor_checks_interval_bounds"
  CHECK ("intervalSec" >= 60 AND "intervalSec" <= 3600);
