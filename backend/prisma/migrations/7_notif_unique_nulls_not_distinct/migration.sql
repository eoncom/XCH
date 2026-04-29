-- =============================================================================
-- 7_notif_unique_nulls_not_distinct — ADR-020 §C
--
-- Trou d'intégrité comblé : @@unique([tenantId, delegationId, kind]) (et
-- idem pour eventType) avec delegationId nullable ne protégeait PAS les
-- rows globales. PostgreSQL traite NULL ≠ NULL dans les UNIQUE par défaut,
-- donc deux rows (tenantA, NULL, EMAIL) pouvaient coexister.
--
-- Approche retenue : partial UNIQUE INDEX en complément du @@unique Prisma
-- existant. Plus robuste que l'option `nulls: "not distinct"` qui n'est
-- pas supportée par Prisma 5.22 (le validator rejette le preview flag
-- `nullsNotDistinct`). Le partial index PG est universel (PG 7+), zéro
-- dépendance preview feature, et il ne touche pas au key généré par
-- Prisma → pas de drift au prochain migrate diff.
--
-- Couverture combinée :
--   - delegationId IS NOT NULL : @@unique Prisma (NULLS DISTINCT default)
--   - delegationId IS NULL    : partial unique index ci-dessous
--
-- À partir de cette migration, une 2ᵉ tentative d'INSERT
-- (tenantA, NULL, EMAIL) lève une violation `unique constraint`.
-- =============================================================================

-- 1. notification_channels — partial unique sur le scope global ---------------

CREATE UNIQUE INDEX "notification_channels_global_uniq"
  ON "notification_channels" ("tenantId", "kind")
  WHERE "delegationId" IS NULL;

-- 2. notification_rules — partial unique sur le scope global ------------------

CREATE UNIQUE INDEX "notification_rules_global_uniq"
  ON "notification_rules" ("tenantId", "eventType")
  WHERE "delegationId" IS NULL;
