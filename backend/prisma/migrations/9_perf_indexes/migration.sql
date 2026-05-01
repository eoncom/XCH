-- =============================================================================
-- 9_perf_indexes — Session 5 PR3
--
-- Ajout de 2 compound indexes sur les hot endpoints identifiés Phase 1 :
--
--   1. tasks(tenantId, status, dueDate)
--      Hot path : Kanban dashboard (WHERE tenantId AND status ORDER BY dueDate)
--      + bannières "tasks due soon" / "overdue".
--      Avant : index séparés (tenantId,status) + (tenantId,dueDate) → multi-
--      index OR scan (tenantId,status) + tri en mémoire sur dueDate.
--      Après : Index Range Scan unique sur le compound, ordering free.
--
--   2. expenses(tenantId, delegationId, dateIncurred DESC)
--      Hot path : budget threshold check (computeCdcSpent dans
--      budgets.service) + filtres standards expenses par délégation +
--      période. Pattern :
--      `WHERE tenantId AND delegationId AND dateIncurred BETWEEN $a AND $b`.
--      Avant : index (tenantId,delegationId) → range scan sur la délégation
--      puis filter dateIncurred en mémoire (scan tous les expenses de la
--      déleg).
--      Après : Index Range Scan tri-colonne, ordering DESC alignée sur les
--      requêtes "recent expenses first".
--
-- Note : MonitorCheck a déjà l'index (tenantId, enabled, nextCheckAt)
-- qui couvre le scheduler hot path — pas d'ajout nécessaire malgré la
-- mention dans le plan v2 initial. Vérifié sur le schéma main HEAD.
--
-- EXPLAIN ANALYZE avant/après documenté dans
-- docs/perf/SESSION-05-explain-analyze.md.
-- =============================================================================

CREATE INDEX "tasks_tenantId_status_dueDate_idx"
  ON "tasks" ("tenantId", "status", "dueDate");

CREATE INDEX "expenses_tenantId_delegationId_dateIncurred_idx"
  ON "expenses" ("tenantId", "delegationId", "dateIncurred" DESC);
