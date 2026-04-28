-- =============================================================================
-- 4_site_health_snapshot — ADR-018 Décision C
--
-- Site.metadata.healthBreakdown JSON cache extracted to a typed 1:0..1 table.
-- componentsJson stays JSONB on the table — it's a cache rewritten every ~30s
-- (see ADR-018 Décision E justification).
-- =============================================================================

CREATE TABLE "site_health_snapshots" (
  "siteId"         TEXT NOT NULL PRIMARY KEY,
  "overall"        "HealthStatus" NOT NULL,
  "componentsJson" JSONB NOT NULL,
  "computedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_health_snapshots_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "site_health_snapshots_overall_idx" ON "site_health_snapshots"("overall");

-- Migrate existing breakdown payloads from Site.metadata.healthBreakdown.
INSERT INTO "site_health_snapshots" ("siteId", "overall", "componentsJson", "computedAt")
SELECT
  id,
  COALESCE((metadata -> 'healthBreakdown' ->> 'overall')::"HealthStatus", "healthStatus"),
  COALESCE(metadata -> 'healthBreakdown' -> 'components', '[]'::jsonb),
  COALESCE((metadata -> 'healthBreakdown' ->> 'timestamp')::timestamp, "lastHealthCheck", NOW())
FROM "sites"
WHERE metadata -> 'healthBreakdown' IS NOT NULL;

-- Strip healthBreakdown from metadata, keep serverInfo until cible D.
UPDATE "sites" SET "metadata" = "metadata" - 'healthBreakdown'
WHERE "metadata" ? 'healthBreakdown';
