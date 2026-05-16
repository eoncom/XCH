-- =============================================================================
-- 12_audit_log_delegation_id — AuditLog enrichment (ADR-028 partie B)
--
-- Track E.4 PR1 Pass 1 partie B.2 — ajout de la colonne `delegationId` sur
-- `audit_logs` pour capture traçabilité forensique délégation active.
--
-- Discipline figée (sub-pass 1.B.-1 audit ADR 5-niveaux, verdict A.5) :
--   - Cat 1 super-admin / Cat 2 pre-delegation / Cat 5 dev-test / SYSTEM_CTX
--     → `delegationId` NULL légitime
--   - Cat 3 self-scoped (notif me/*, user-notification, user-delegations me)
--     + Cat 4 catalog (asset-models) → Option A actée : capture
--     `ctx.activeDelegationId` (peut être NULL si user sans délégation active)
--   - Endpoints délégation-scoped (6 services ADR-021 §1 : sites, assets,
--     racks, tasks, expenses, contacts, etc.) → NON-NULL obligatoire
--     (test integration §B.0.3)
--
-- onDelete SET NULL : préserve audit trail si délégation supprimée. La perte
-- de référence FK est acceptable (label/code délégation préservés dans
-- changes JSON si nécessaire). Pas de CASCADE (perte audit trail interdite),
-- pas de RESTRICT (lourd opérationnel pour cleanup).
--
-- Pas de backfill (per XCH_DEMO_DATA_PRINCIPLE 2026-04-29 — reset+seed
-- autorisé sur xch-deploy ; pilote prod employeur greenfield Track E.3
-- cutover post-v2.4.0, pas de rows historiques à enrichir).
--
-- Index composite (tenantId, delegationId, timestamp) pour query
-- `GET /audit?delegationId=…` filtré + observabilité bug détectable
-- (§B.0.1 — alerte si entityType délégation-scoped + delegationId NULL).
-- =============================================================================

-- 1. Ajout colonne delegationId nullable --------------------------------------
ALTER TABLE "audit_logs"
  ADD COLUMN "delegationId" TEXT NULL;

-- 2. Foreign key vers delegations (SET NULL on delete) -----------------------
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 3. Index composite (tenant, delegation, timestamp) -------------------------
-- Supporte les queries `GET /audit` filtrées par délégation + tri timestamp
-- ainsi que l'observabilité Track F (alerte GlitchTip si entityType
-- délégation-scoped + delegationId IS NULL).
CREATE INDEX "audit_logs_tenantId_delegationId_timestamp_idx"
  ON "audit_logs" ("tenantId", "delegationId", "timestamp");
