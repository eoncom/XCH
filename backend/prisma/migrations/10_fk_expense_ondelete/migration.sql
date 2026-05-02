-- =============================================================================
-- 10_fk_expense_ondelete — Session 7 PR0
--
-- Dette d'intégrité FK Expense découverte pendant l'audit S5 PR2 mais sortie
-- du scope d'alors (cf XCH_PLAN_V2_FINALIZATION 2026-05-02). Les 3 FK
-- structurelles Expense (delegationId, siteId, bearerId) étaient déclarées
-- sans onDelete: explicite dans schema.prisma.
--
-- Conséquence : Prisma 5 générait ON DELETE SET NULL silencieux pour les
-- relations optionnelles (siteId) et NoAction pour les NOT NULL
-- (delegationId, bearerId). Aucune protection contre la suppression d'une
-- délégation ou d'un BillingEntity ayant des dépenses attachées.
--
-- Pattern cohérent avec migration 8_fk_ondelete_and_checks (S5 PR2) :
--   - delegationId NOT NULL → RESTRICT (force réassignement avant delete)
--   - bearerId    NOT NULL → RESTRICT (idem ; un CdC porteur de dépenses
--                            ne s'évanouit pas)
--   - siteId      nullable → SetNull explicite no-op DB (déjà comportement
--                            par défaut Prisma) — annotation schema.prisma
--                            documente l'intention anti-drift, pas de SQL
--                            ici (voir migration 8 même pattern pour
--                            assetModelId/Contact.delegationId/siteId).
--
-- Données existantes : aucune contrainte FK existante n'est violée par le
-- changement RESTRICT (les seeds démo n'orphelinisent jamais de dépenses
-- via delete delegation/bearer). Conformité validée en CI via
-- prisma migrate deploy + jest integration tests.
-- =============================================================================

-- 1. Expense → Delegation : suppression d'une délégation refusée si elle a
--    des dépenses attachées
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_delegationId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Expense → BillingEntity (bearer) : un CdC porteur de dépenses ne
--    s'évanouit pas — force la migration explicite des dépenses avant delete
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_bearerId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bearerId_fkey"
  FOREIGN KEY ("bearerId") REFERENCES "billing_entities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
