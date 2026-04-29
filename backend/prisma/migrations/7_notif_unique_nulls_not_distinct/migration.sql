-- =============================================================================
-- 7_notif_unique_nulls_not_distinct — ADR-020 §C
--
-- Le @@unique([tenantId, delegationId, kind]) (et idem pour eventType) ne
-- protégeait PAS les rows globales (delegationId IS NULL). PostgreSQL traite
-- NULL ≠ NULL dans les UNIQUE constraints par défaut, donc deux rows
--   (tenantA, NULL, EMAIL)
-- pouvaient coexister sans violation — trou d'intégrité de la résolution
-- d'inheritance NotificationSettingsService (delegation > global > defaults).
--
-- Fix : drop les 2 INDEX UNIQUE et les recréer avec NULLS NOT DISTINCT
-- (PG 15+, confirmé sur xch-deploy 15.8). À partir de cette migration,
-- une 2ᵉ row globale du même (tenantId, kind) ou (tenantId, eventType)
-- échoue côté DB avec violation de contrainte.
--
-- Le findFirst+update/create côté NotificationSettingsService devient une
-- décision éclairée (bug Prisma compound unique nullable côté TS), pas un
-- workaround d'intégrité.
-- =============================================================================

-- 1. notification_channels ----------------------------------------------------

DROP INDEX "notification_channels_tenantId_delegationId_kind_key";

CREATE UNIQUE INDEX "notification_channels_tenantId_delegationId_kind_key"
  ON "notification_channels" ("tenantId", "delegationId", "kind") NULLS NOT DISTINCT;

-- 2. notification_rules -------------------------------------------------------

DROP INDEX "notification_rules_tenantId_delegationId_eventType_key";

CREATE UNIQUE INDEX "notification_rules_tenantId_delegationId_eventType_key"
  ON "notification_rules" ("tenantId", "delegationId", "eventType") NULLS NOT DISTINCT;
