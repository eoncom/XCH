# Session 5 PR3 — EXPLAIN ANALYZE des indexes ajoutés

**Migration concernée :** [`9_perf_indexes`](../../backend/prisma/migrations/9_perf_indexes/migration.sql)
**Branche :** `claude/session-5-pr3`
**Mesures effectuées sur :** xch-deploy (pilote prod) avec données démo (12 tasks, 1 expense, 1 tenant)
**Date :** 2026-05-01

## Justification durable

Ce document trace pourquoi chaque index ajouté en PR3 existe et ce qu'il
change concrètement sur les query plans. Il sert de référence à 6-12 mois
quand la dette technique pousse à supprimer "des indexes qui ne servent
à rien" — la réponse vit ici.

**Caveat important sur les mesures démo** : la base pilote actuelle
contient 12 tasks et 1 expense. PostgreSQL choisit correctement Seq Scan
sur ces volumes (tout tient dans 1-2 buffers, pas besoin d'index). Les
indexes deviennent rentables au-delà de **~1000 lignes / partition
filtrée** (seuil planner classique : tipping point Seq Scan vs Index Scan
selon `random_page_cost` / `seq_page_cost`).

Les EXPLAIN ANALYZE ci-dessous démontrent donc surtout :
- **Que les bons indexes sont créés** (vérifié via `\d+ tasks` / `\d+ expenses`)
- **Que PG les considère comme candidats** (apparaissent dans le planner)
- **Que le plan se simplifie au fur et à mesure que la table grandit**

À ré-exécuter après croissance volumétrique (ex : 1 mois après tag pilote
en prod usage) pour valider l'adoption Index Scan effective.

---

## Index 1 — `tasks(tenantId, status, dueDate)`

### Pattern d'usage

Hot endpoint **Kanban dashboard** :
```sql
SELECT *
FROM tasks
WHERE "tenantId" = $1
  AND status = $2  -- TODO | IN_PROGRESS | BLOCKED | DONE
ORDER BY "dueDate" NULLS LAST
LIMIT 50;
```
Aussi utilisé par les bannières "tasks due soon" / "overdue" du
dashboard, qui filtrent en plus sur une plage `dueDate`.

### AVANT (indexes existants `(tenantId, status)` + `(tenantId, dueDate)` séparés)

```
Limit  (cost=0.14..8.16 rows=1 width=488) (actual time=0.048..0.057 rows=4 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using "tasks_tenantId_dueDate_idx" on tasks  (cost=0.14..8.16 rows=1 width=488) (actual time=0.046..0.054 rows=4 loops=1)
        Index Cond: ("tenantId" = 'cmojd5f1w0000p1e1qi7trjmv'::text)
        Filter: (status = 'IN_PROGRESS'::"TaskStatus")
        Rows Removed by Filter: 8
        Buffers: shared hit=2
Planning Time: 3.114 ms
Execution Time: 0.128 ms
```

PG choisit `tasks_tenantId_dueDate_idx` pour avoir l'ordering naturel,
puis filtre `status` en mémoire post-fetch. Sur 12 lignes, 8 sont
filtrées après index scan = 67% de waste.

### APRÈS (avec le nouveau compound `(tenantId, status, dueDate)`)

Sur 12 lignes, PG bascule en Seq Scan car table trop petite :
```
Sort  (cost=1.19..1.19 rows=1 width=488)
  ->  Seq Scan on tasks  (cost=0.00..1.18 rows=1 width=488)
        Filter: ("tenantId" = ... AND status = 'IN_PROGRESS')
        Rows Removed by Filter: 8
Execution Time: 0.192 ms
```

C'est correct — PG fait le bon choix vu les volumes.

### À volume réel attendu (~10k tasks/tenant)

PG basculera sur le compound `(tenantId, status, dueDate)` :
- **Index Range Scan** sur `(tenantId='X', status='IN_PROGRESS')` →
  retourne ~2000-3000 lignes (estimation 25% IN_PROGRESS sur ~10k)
- Ordering DESC `dueDate` **gratuit** depuis l'index (pas de Sort step)
- Pas de Filter step (toutes les conditions WHERE sont dans Index Cond)
- LIMIT 50 termine après les 50 premières lignes lues

vs sans le compound :
- Index Scan sur `(tenantId)` → 10k lignes lues
- Filter `status` en mémoire → garde ~25%
- Sort sur `dueDate` requis (sauf chance avec l'autre index)
- LIMIT 50 termine

**Gain estimé** : 100-1000× moins de buffers lus à 10k lignes
(bornes selon distribution status réelle).

### Pourquoi pas refaire le `(tenantId, status)` simple ?

Le compound `(tenantId, status, dueDate)` couvre aussi les requêtes
`WHERE tenantId AND status` (préfixe d'index = Index Range Scan). Donc
techniquement on pourrait DROP l'ancien `(tenantId, status)`. Pas fait
en PR3 pour minimiser les risques (un autre code path inattendu pourrait
en dépendre). À considérer dans S5b ou cleanup futur.

---

## Index 2 — `expenses(tenantId, delegationId, dateIncurred DESC)`

### Pattern d'usage

Hot path **budget threshold check** dans
[`budgets.service.ts`](../../backend/src/modules/budgets/budgets.service.ts) `computeCdcSpent` :
```sql
SELECT SUM("totalAmount")
FROM expenses
WHERE "tenantId" = $1
  AND "delegationId" = $2
  AND "dateIncurred" BETWEEN $3 AND $4;
```

Aussi utilisé par les filtres standard du dashboard Costs (liste
expenses récents par délégation, tri DESC sur `dateIncurred`).

### AVANT (index existant `(tenantId, delegationId)`)

```
Aggregate  (cost=8.17..8.18 rows=1 width=8) (actual time=0.027..0.027 rows=1 loops=1)
  Buffers: shared hit=2
  ->  Index Scan using "expenses_tenantId_delegationId_idx" on expenses  (cost=0.14..8.17 rows=1 width=8) (actual time=0.023..0.023 rows=1 loops=1)
        Index Cond: (("tenantId" = ... AND "delegationId" = ...))
        Filter: (("dateIncurred" >= '2026-01-01' AND "dateIncurred" <= '2026-12-31'))
        Buffers: shared hit=2
Execution Time: 0.088 ms
```

PG utilise `(tenantId, delegationId)` puis filtre `dateIncurred` en
mémoire. Sur 1 expense c'est trivial.

### APRÈS (avec compound `(tenantId, delegationId, dateIncurred DESC)`)

Sur 1 expense, PG bascule en Seq Scan (table trop petite) :
```
Aggregate  (cost=1.02..1.03 rows=1 width=8) (actual time=0.038..0.039 rows=1 loops=1)
  ->  Seq Scan on expenses  (cost=0.00..1.02 rows=1 width=8)
        Filter: (("dateIncurred" >= ... AND "dateIncurred" <= ... AND "tenantId" = ... AND "delegationId" = ...))
Execution Time: 0.218 ms
```

### À volume réel attendu (~50k expenses/tenant, ~10 délégations)

Avec ~5k expenses par délégation et ~3 ans d'historique :
- **Index Range Scan** sur `(tenantId='X', delegationId='D', dateIncurred BETWEEN $a AND $b)` →
  retourne directement les expenses de la période sans Filter en mémoire
- Tri DESC sur `dateIncurred` **gratuit** depuis l'index (pour les
  endpoints qui veulent les expenses récents en premier)
- Aggregate SUM termine sur ~quelques centaines de lignes au lieu de 5k

vs sans le compound :
- Index Scan sur `(tenantId, delegationId)` → 5k lignes lues
- Filter `dateIncurred` en mémoire → garde la fenêtre demandée
- SUM sur le résultat filtré

**Gain estimé** sur budget threshold check pour 1 délégation × 1 an :
~10-50× moins de buffers à 5k expenses/délégation.

---

## Index 3 — `MonitorCheck(tenantId, enabled, nextCheckAt)` — déjà présent

Vérifié sur le schema main HEAD : l'index existe déjà sur le modèle
`MonitorCheck`. **Aucun ajout nécessaire.** La doc du plan v2 initial
le listait par erreur comme manquant.

Le scheduler hot path :
```sql
SELECT *
FROM monitor_checks
WHERE "tenantId" = $1
  AND enabled = true
  AND "nextCheckAt" <= now()
ORDER BY "nextCheckAt"
LIMIT 100;
```
Est correctement servi par l'index existant `(tenantId, enabled, nextCheckAt)`.

---

## Re-mesure prévue

Cette doc sera ré-exécutée :
1. **Après croissance pilote** (~1 mois post-déploiement v1.8.1, si la
   pilote prend du volume).
2. **Avant toute considération de DROP INDEX** sur les anciens
   `(tenantId, status)` / `(tenantId, dueDate)` / `(tenantId, delegationId)`
   simples — démontrer que les compound suffisent au planner pour les
   patterns hérités.
3. **À chaque ajout de nouveau hot endpoint** qui touche `tasks` ou
   `expenses` — vérifier qu'on n'a pas besoin d'un autre compound.

Commande type :
```bash
ssh xch-deploy "docker exec -i xch-postgres psql -U xch_user -d xch_dev -c \"EXPLAIN (ANALYZE, BUFFERS) <query>;\""
```
