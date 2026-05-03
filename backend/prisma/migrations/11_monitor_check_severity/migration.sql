-- =============================================================================
-- 11_monitor_check_severity — Aggregation refonte (ADR-022)
--
-- Ajoute le champ `severity` sur MonitorCheck pour piloter explicitement
-- l'agrégation `Site.healthStatus` au lieu des heuristiques implicites
-- du code (linkImpact totalLinks<=1, assetImpact toujours warning, etc.).
--
-- Sémantique cible (cf XCH_HEALTH_AGGREGATION_SEMANTICS + ADR-022) :
--   CRITICAL : un check DOWN escalade le site en CRITICAL
--              (PRIMARY link, asset mission-critique, override admin)
--   WARNING  : un check DOWN escalade en WARNING uniquement
--              (BACKUP link, asset générique, site-level monitoring)
--   INFO     : un check DOWN n'impacte pas la santé site
--              (forward-compat — soft signals, non utilisé v1.x)
--
-- Backfill stratégique :
--   * Liens role=PRIMARY → CRITICAL (perte service nominal = critical)
--   * Liens role=BACKUP → WARNING (default — dégradation mais nominal couvre)
--   * Liens role=OTHER → WARNING (default — overridable par admin via UI)
--   * Assets / site-level / firewalls SD-WAN → WARNING (default)
--
-- Note SD-WAN : la règle "tous firewalls DOWN → CRITICAL" reste pilotée par
-- l'aggregator (non pas par flag individuel) — chaque MonitorCheck attaché
-- à un firewall garde severity=WARNING (default) ; la promotion CRITICAL
-- arrive au moment de l'agrégation quand la totalité du SD-WAN est DOWN.
-- Cela laisse l'admin libre de mark un firewall individuel en CRITICAL via
-- override sans casser la sémantique "all-down" globale.
-- =============================================================================

-- 1. Création de l'enum SeverityLevel ----------------------------------------
CREATE TYPE "SeverityLevel" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- 2. Ajout colonne severity avec default WARNING -----------------------------
-- ADD COLUMN ... DEFAULT 'WARNING' renseigne automatiquement les rows
-- existantes (Postgres rewrite). Les rows nouvelles héritent du default.
ALTER TABLE "monitor_checks"
  ADD COLUMN "severity" "SeverityLevel" NOT NULL DEFAULT 'WARNING';

-- 3. Backfill PRIMARY links → CRITICAL ---------------------------------------
-- Les checks attachés à un lien PRIMARY portent la criticité du service
-- nominal — un PRIMARY DOWN doit alerter même si BACKUP couvre.
UPDATE "monitor_checks" mc
SET "severity" = 'CRITICAL'
FROM "connectivity_links" cl
WHERE mc."linkId" = cl."id" AND cl."role" = 'PRIMARY';
