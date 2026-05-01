-- =============================================================================
-- 8_fk_ondelete_and_checks — Session 5 PR2
--
-- Intégrité référentielle (XCH_ENGINEERING_PRINCIPLES — pas de dette
-- silencieuse) :
--
-- 1. Durcissement de 5 FK existantes de SET NULL → RESTRICT pour les
--    relations organisationnelles structurelles (Asset/BillingEntity/Budget
--    vers Delegation et Site). Une délégation ou un site avec des assets,
--    des CdC ou des budgets attachés doit forcer le réassignement explicite
--    avant suppression — pas de NULL silencieux qui orphelinise les
--    coûts/équipements.
--
--    Pattern aligné sur les FKs déjà Restrict : Site.delegationId
--    (préexistant), Budget.billingEntityId, Budget.parentId.
--
-- 2. 3 CHECK constraints sur les invariants déjà validés en service mais
--    non protégés en base :
--    - racks.heightU > 0 (taille de baie strictement positive)
--    - assets.dutyCyclePercent ∈ [0, 100]
--    - assets.rackPositionU > 0 (si non NULL)
--
-- Données existantes : aucune contrainte CHECK n'est violée par le seed
-- démo (vérifié avant migration : heightU=24/42, dutyCyclePercent=100,
-- rackPositionU≥1). Conformité validée en CI via prisma migrate deploy
-- + jest integration tests.
--
-- Pas de drop/re-add pour les 3 FK déjà SET NULL (Asset.assetModelId,
-- Contact.delegationId, Contact.siteId) — leur déclaration onDelete:
-- explicite dans schema.prisma documente l'intention sans changer la DB.
-- =============================================================================

-- 1. FK Restrict harmonisation -----------------------------------------------

-- Asset → Delegation : suppression d'une délégation refusée si elle a des assets
ALTER TABLE "assets" DROP CONSTRAINT "assets_delegationId_fkey";
ALTER TABLE "assets" ADD CONSTRAINT "assets_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- BillingEntity → Delegation : CdC organisationnel ne s'évanouit pas
ALTER TABLE "billing_entities" DROP CONSTRAINT "billing_entities_delegationId_fkey";
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- BillingEntity → Site : idem, force la migration explicite avant delete
ALTER TABLE "billing_entities" DROP CONSTRAINT "billing_entities_siteId_fkey";
ALTER TABLE "billing_entities" ADD CONSTRAINT "billing_entities_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Budget → Delegation : cohérent avec Budget.billingEntityId / Budget.parentId Restrict
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_delegationId_fkey";
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_delegationId_fkey"
  FOREIGN KEY ("delegationId") REFERENCES "delegations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Budget → Site : idem
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_siteId_fkey";
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. CHECK constraints sur invariants service-level --------------------------

-- Rack height : toujours > 0 (un rack 0U n'a pas de sens)
ALTER TABLE "racks" ADD CONSTRAINT "racks_height_u_positive"
  CHECK ("heightU" > 0);

-- Asset duty cycle : pourcentage valide [0, 100]
ALTER TABLE "assets" ADD CONSTRAINT "assets_duty_cycle_bounds"
  CHECK ("dutyCyclePercent" BETWEEN 0 AND 100);

-- Asset rack position : strictement positive si renseignée (NULL = non monté)
ALTER TABLE "assets" ADD CONSTRAINT "assets_rack_position_positive"
  CHECK ("rackPositionU" IS NULL OR "rackPositionU" > 0);
