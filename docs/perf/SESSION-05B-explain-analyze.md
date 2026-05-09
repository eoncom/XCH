# Session 5b — EXPLAIN plans des refactors SQL

**PRs concernées :** S5b PR1 (`reportByMonth` + `projection`), S5b PR2 (`reportByBearer` + `reportByTarget`).
**Branche worktree :** `claude/elated-mclaren-f80c7c`.
**Mesures effectuées sur :** `xch-deploy` (pilote prod) — `docker exec xch-postgres psql -U xch_user -d xch_dev`.
**Date :** 2026-05-09.
**Tag cible :** `v2.1.1`.

## Pourquoi pas de timings ni de `BUFFERS`

Volume pilote actuel = 1 expense unique (`MONTHLY` Orange Business, 890 €).
PostgreSQL choisit Seq Scan partout, ce qui est correct sur ce volume — les
chiffres `Buffers: shared hit` et `Execution Time` qu'on capturerait avec
`EXPLAIN (ANALYZE, BUFFERS)` mesureraient un cas où il n'y a pas de
bottleneck, sans valeur prédictive pour les volumes cible.

Décision (alignée [SESSION-05-explain-analyze.md](SESSION-05-explain-analyze.md)) :
documenter qualitativement la **structure du plan** et les **prédicats
réellement push-down sur le seq scan** pour chacune des 4 cibles. À
ré-exécuter avec `(ANALYZE, BUFFERS)` quand un pilote dépasse ~1k
expenses (cf. caveat S5 PR3 doc, déjà inscrit dans le pattern XCH).

## Ce qu'on cherche à montrer

Pour chaque cible :

1. **Le bon nombre de queries** (1 query DB côté nouveau code, vs 1 findMany + N JS-side iterations côté ancien — équivalent en queries DB mais N+1 en data fetch + memory pressure Node). Le gain est moins le nombre de queries que l'élimination de la boucle JS et la projection en une seule passe SQL.
2. **Que les filtres tenant + date sont push-down sur le seq scan** (Filter sur `expenses` directement). À volume cible (~50k expenses, index `(tenantId, delegationId, dateIncurred DESC)` créé en S5 PR3), Postgres bascule en Index Scan sur cette ligne — c'est le tipping point qu'on attend.
3. **Que la sémantique des filtres ne change pas** (iso-functionality strict). Les conditions de filtre AVANT et APRÈS doivent être identiques — sinon le refactor introduirait un bug silencieux.

---

## Cible 1 — `reportByMonth()`

### AVANT (S5 — `findMany` + JS expansion loop)

Query générée par Prisma :
```sql
SELECT *
FROM expenses
WHERE "tenantId" = $1
  AND "dateIncurred" >= $2
  AND "dateIncurred" <= $3;
```

Plan capturé :
```
Seq Scan on expenses  (cost=0.00..1.02 rows=1 width=1564)
  Filter: (("dateIncurred" >= '2026-01-01 00:00:00') AND
           ("dateIncurred" <= '2026-12-31 00:00:00') AND
           ("tenantId" = 'cmojd5f1w0000p1e1qi7trjmv'))
```

Fetch : 1 row (sur 1 expense présente). Puis itération JS qui éclate la
récurrente sur 12 mois et agrège dans une `Map<monthKey, …>`.

### APRÈS (S5b PR1 — single `$queryRaw`)

```sql
WITH months AS (
  SELECT generate_series(date_trunc('month', $1::timestamp),
                         date_trunc('month', $2::timestamp),
                         '1 month'::interval) AS month_start
),
contributions AS (
  SELECT m.month_start,
         CASE e."frequency"
           WHEN 'ONE_TIME'  THEN e."totalAmount"
           WHEN 'MONTHLY'   THEN e."totalAmount"
           WHEN 'QUARTERLY' THEN e."totalAmount" / 3.0
           WHEN 'YEARLY'    THEN e."totalAmount" / 12.0
           ELSE 0
         END AS amount,
         e.id AS expense_id
  FROM months m
  JOIN expenses e ON
    (e."frequency" = 'ONE_TIME'
       AND date_trunc('month', e."dateIncurred") = m.month_start)
    OR
    (e."frequency" <> 'ONE_TIME'
       AND m.month_start >= GREATEST(
             date_trunc('month', COALESCE(e."dateStart", e."dateIncurred")),
             date_trunc('month', $1::timestamp))
       AND m.month_start <= LEAST(
             date_trunc('month', COALESCE(e."dateEnd", '9999-12-31'::timestamp)),
             date_trunc('month', $2::timestamp)))
  WHERE e."tenantId" = $3
    AND e."dateIncurred" >= $1
    AND e."dateIncurred" <= $2
)
SELECT to_char(month_start, 'YYYY-MM') AS month,
       ROUND(SUM(amount)::numeric, 2)::float8 AS total,
       COUNT(expense_id)::int AS count
FROM contributions
GROUP BY month_start
HAVING SUM(amount) > 0
ORDER BY month_start;
```

Plan capturé :
```
GroupAggregate  (cost=51.09..51.31 rows=2 width=52)
  Group Key: (generate_series(…, '1 mon'::interval))
  Filter: (sum(CASE …) > 0)
  ->  Sort  (cost=51.09..51.11 rows=5 width=52)
        Sort Key: (generate_series(…))
        ->  Nested Loop  (cost=0.00..51.03 rows=5 width=52)
              Join Filter: …(per-month contribution check)…
              ->  Seq Scan on expenses e  (cost=0.00..1.02 rows=1 width=68)
                    Filter: (("dateIncurred" >= '2026-01-01 00:00:00') AND
                             ("dateIncurred" <= '2026-12-31 00:00:00') AND
                             ("tenantId" = 'cmojd5f1w0000p1e1qi7trjmv'))
              ->  ProjectSet  (cost=0.00..5.02 rows=1000 width=8)
                    ->  Result
```

**Observations** :
- Le seq scan filter sur `expenses` est **strictement identique** à AVANT (`tenantId + dateIncurred BETWEEN`). À volume cible (~50k expenses), l'index `expenses_tenantId_delegationId_dateIncurred_idx` (S5 PR3) sera utilisé.
- L'expansion par mois passe par un `Nested Loop` : pour chaque expense matchée par le seq scan, le planner génère la série de mois et applique le `Join Filter` qui vérifie la contribution de l'expense à chaque mois. C'est ce qui remplace la boucle JS.
- Le `HAVING SUM(amount) > 0` est appliqué post-`GroupAggregate`, garantissant le wire-shape compact (mois sans contribution absent du résultat — iso AVANT).
- La query Postgres est plus complexe en plan tree (4 noeuds vs 1 AVANT) mais **toute l'expansion + agrégation se fait en 1 round-trip DB**. Avant : 1 round-trip + N itérations JS (avec construction d'une Map et conversion finale en array, mémoire Node proportionnelle au nombre d'expenses × mois actifs).

### À volume réel attendu

À ~50k expenses sur 12 mois de fenêtre :
- AVANT : seq scan fetch potentiellement 50k rows (avec push-down sur `dateIncurred`, on filtrera côté serveur ; toutes les expenses récurrentes actives passeront néanmoins). Transfert en mémoire Node + boucle d'expansion → `Map` avec ~600k contributions au pire (expense × 12 mois). GC pressure non négligeable.
- APRÈS : seq scan filtre identique côté Postgres, puis Nested Loop + GroupAggregate restent en RAM Postgres. Le serveur Node ne reçoit que ~12 rows (1 par mois, après HAVING). **Économie mémoire Node + 1 ordre de magnitude moins de données sur le wire DB→Node**.

---

## Cible 2 — `projection()`

### AVANT (S5 — `findMany` + JS expansion loop)

Query :
```sql
SELECT *
FROM expenses
WHERE "tenantId" = $1
  AND (
    ("frequency" = 'ONE_TIME'
       AND "dateIncurred" >= $2 AND "dateIncurred" <= $3)
    OR
    ("frequency" <> 'ONE_TIME'
       AND "dateStart" <= $3
       AND ("dateEnd" IS NULL OR "dateEnd" >= $2))
  );
```

Plan :
```
Seq Scan on expenses  (cost=0.00..1.03 rows=1 width=1564)
  Filter: (("tenantId" = …) AND
           (((frequency = 'ONE_TIME') AND ("dateIncurred" >= $2) AND ("dateIncurred" <= $3))
            OR ((frequency <> 'ONE_TIME') AND ("dateStart" <= $3)
                AND (("dateEnd" IS NULL) OR ("dateEnd" >= $2)))))
```

Fetch : 1 row. JS expansion + agrégation multi-axes (byMonth, byType, byDelegation, bySite) dans 4 dictionnaires.

### APRÈS (S5b PR1 — single `$queryRaw`)

```sql
WITH months AS (...),
contributions AS (
  SELECT m.month_start,
         COALESCE(e."type"::text, 'OTHER') AS type,
         COALESCE(e."delegationId", 'none') AS delegation_id,
         COALESCE(e."siteId", 'none') AS site_id,
         CASE e."frequency" … END AS amount
  FROM months m
  JOIN expenses e ON
    (e."frequency" = 'ONE_TIME'
       AND date_trunc('month', e."dateIncurred") = m.month_start)
    OR
    (e."frequency" <> 'ONE_TIME'
       AND m.month_start BETWEEN GREATEST(date_trunc('month', COALESCE(...)), …)
                             AND LEAST(date_trunc('month', COALESCE(...)), …))
  WHERE e."tenantId" = $1
    AND (
      (e."frequency" = 'ONE_TIME'
         AND e."dateIncurred" >= $2 AND e."dateIncurred" <= $3)
      OR
      (e."frequency" <> 'ONE_TIME'
         AND e."dateStart" <= $3
         AND (e."dateEnd" IS NULL OR e."dateEnd" >= $2))
    )
)
SELECT to_char(month_start, 'YYYY-MM') AS month,
       type, delegation_id, site_id,
       SUM(amount)::float8 AS total
FROM contributions
GROUP BY month_start, type, delegation_id, site_id
ORDER BY month_start;
```

Plan :
```
GroupAggregate  (cost=51.13..51.37 rows=5 width=144)
  Group Key: (generate_series(…)),
             (COALESCE((e.type)::text, 'OTHER')),
             (COALESCE(e."delegationId", 'none')),
             (COALESCE(e."siteId", 'none'))
  ->  Sort  (cost=51.13..51.14 rows=5 width=116)
        Sort Key: …same…
        ->  Nested Loop  (cost=0.00..51.07 rows=5 width=116)
              Join Filter: …(per-month contribution check)…
              ->  Seq Scan on expenses e  (cost=0.00..1.03 rows=1 width=104)
                    Filter: (("tenantId" = …) AND
                             (((frequency = 'ONE_TIME') AND ("dateIncurred" >= $2) AND ("dateIncurred" <= $3))
                              OR ((frequency <> 'ONE_TIME') AND ("dateStart" <= $3)
                                  AND (("dateEnd" IS NULL) OR ("dateEnd" >= $2)))))
              ->  ProjectSet
                    ->  Result
```

**Observations** :
- Le seq scan filter sur `expenses` est **strictement identique** à AVANT — c'est un point de vérification d'iso-functionality. Le pre-filter `WHERE` (mirroir de la legacy `findMany` `OR`) garantit que Postgres pré-filtre la table avant le Nested Loop, conservant l'usage des indexes existants. Sans ce pre-filter, le seq scan ramènerait toutes les expenses récurrentes (sans filtre date) et le filtrage se ferait dans le Nested Loop — perf regression à scale.
- Le post-fetch JS reshape 1-pass (linéaire sur les rows retournées) reconstruit la structure `{totals: {...}, byMonth: [...]}`. Le `byMonth` initialise tous les mois à 0 (préserve le contrat actuel — projection() retourne la fenêtre exhaustive même quand vide).
- À volume cible : SUM agrégé en RAM Postgres, transfert wire = `mois × types × délégations × sites` rows distincts (typiquement ~60 × 6 × 10 × 100 = 360k au pire ; en pratique << car peu de combinaisons existent réellement).

### À volume réel attendu

À ~50k expenses sur 12 mois × 6 types × 10 délégations × 100 sites :
- AVANT : 50k rows fetchées, 4 dictionnaires JS construits (byMonth, byType, byDelegation, bySite) avec ~600k incrémentations cumulées (50k × 12 mois pour les récurrentes).
- APRÈS : ~quelques milliers de rows agrégées par Postgres, post-fetch réduit à 1 passe linéaire pour reconstruire la structure. **Charge mémoire Node passée de O(expenses × mois) à O(rows agrégées) ≈ O(combinaisons distinctes).**

---

## Cibles 3 & 4 — `reportByBearer` + `reportByTarget`

🔮 **À documenter en S5b PR2.** Le format et le protocole de capture sont
identiques à PR1 (4 plans : avant `findMany + reduce JS` × après
`$queryRaw + LEFT JOIN LATERAL`).

---

## Comment ré-exécuter

```bash
# Sur xch-deploy (ou tout host avec Postgres + données pilote)
ssh xch-deploy
docker exec -i xch-postgres psql -U xch_user -d xch_dev <<'EOF'
EXPLAIN (FORMAT TEXT)
-- Coller la query (cf. sections AVANT/APRÈS ci-dessus, en remplaçant les
-- $N par les valeurs souhaitées : tenantId, dateFrom, dateTo).
;
EOF
```

À ré-exécuter avec `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` quand un
tenant pilote dépasse ~1k expenses pour mesurer les Buffers/Execution Time
(cf. caveat introduction).
