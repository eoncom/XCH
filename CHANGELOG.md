# Changelog XCH

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.4] - 2026-05-12 — Chore : nettoyage Gatus vestigial + retrait legacy `docker-compose.prod.yml`

Chore release post-v2.1.3 supprimant les références vestigiales à Gatus
(retiré runtime en v1.10.0 / ADR-016) et le couple legacy `docker-compose.prod.yml`
+ `scripts/deploy-prod.sh` (frozen `image: xch-backend:v1.1.1`, désynchronisé depuis
v1.4.x). Aucun changement comportemental — le standard `docker compose`
(sans `-f`) reste le canonical workflow (cf MCP `DEPLOY_WORKFLOW`).

### Removed

- **`docker-compose.prod.yml`** : fichier legacy avec `image: xch-backend:v1.1.1` hardcodé (frozen v1.4.x, ignoré en pratique depuis xch-deploy utilise `docker-compose.yml` direct). Bombe à retardement levée — plus de risque de drift si quelqu'un lance `-f docker-compose.prod.yml`. Cf MCP `XCH_DOCKER_IMAGE_DISCIPLINE`.
- **`scripts/deploy-prod.sh`** : wrapper de `-f docker-compose.prod.yml`, désynchronisé. Remplacé par `scripts/deploy-auto.sh` (canonical) ou `docker compose build && up -d` direct.

### Changed

- **Gatus vestigial code** — 7 fichiers code (3 backend src + 3 frontend src + `prisma/schema.prisma`) : comments JSDoc historiques épurés des mentions Gatus/Kuma actives. Runtime monitoring inchangé (native ADR-014/016 via `xch-backend-worker`).
- **Config files** — `.env.production.example` + `backend/.env.example` : retrait `GATUS_PORT` + `GATUS_WEBHOOK_SECRET` + section "Gatus Monitoring".
- **`scripts/rotate-secrets.sh`** Phase A : retrait WEBHOOK_SECRET synchronisé Gatus + container gatus restart + smoke webhook (~50 lignes). Phase A reste fonctionnelle sur JWT + MinIO.
- **`scripts/install-airgap.sh` + `scripts/package-release.sh`** : dormants depuis v1.0.0-rc1 (predates 8 ADRs). Retrait copy/install Gatus assets + image `twinproduction/gatus` + ajout WARNING header "Legacy script, airgap workflow needs rework for v2.x". Conservés comme référence pour future revival.
- **`scripts/generate-ssl.sh`** : echo `restart nginx` sans `-f docker-compose.prod.yml`.
- **`README.md` + `README-DEPLOY.md`** : sections "Deploiement air-gapped" retirées du flow nominal. Commandes deploy migrées sur `docker compose` standard. Architecture diagram backend-worker au lieu de Gatus :8080.
- **`docs/architecture/tech-stack.md` + `docs/00-INDEX.md` + `docs/status/PROJECT_STATUS.md`** : références Gatus/Kuma retirées des descriptions actives ; ADRs historiques 012/013/014/015/016 préservés inchangés.
- **`docs/KUMA_V2_CONTEXT.md` + `docs/guides/MONITORING_CONVENTION.md`** : remplacés par stubs redirige ADR-014/016 (architecture pré-ADR-016 obsolète, contenu historique retiré).
- **`docker-compose.yml`** : retrait commentaire historique Gatus removed (redondant post-cleanup).

### Internal

- ADRs `adr-012-gatus-bidirectional.md` + `adr-013` à `adr-016` préservés comme archive décisionnelle (mention historique de Gatus dans le contexte décisionnel).
- Reports `phase*-audit-*` + `docs/prompts/archive/*` + `DEVELOPMENT_LOG.md` historique préservés sans modification.

### MCP audit trail

- `XCH_PROD_PORTS` ← observation append-only confirmant runtime v2.1.3 actuel sur xch-deploy (image SHA `41a733de8c09`, build 2026-05-10) + le hardcode v1.1.1 était ignoré, pas une régression.
- `XCH_DOCKER_IMAGE_DISCIPLINE` (engineering_pattern, créé 2026-05-10) ← pattern d'hygiène images Docker : ne jamais hardcoder de tag de version dans compose files, vérifier image SHA backend == backend-worker, code synchronisé ≠ image runtime synchronisée.

---

## [2.1.3] - 2026-05-10 — Bugs secondaires Track C : floor plans + backup completeness + dette TS

Patch release post-v2.1.2 fermant la liste Track C des bugs secondaires
identifiés au test global production 2026-05-09 (cf MCP `XCH_BUGS_SECONDARY`).
Une session, un PR squash, validé prod via rebuild `--no-cache` complet et
backup test à 161 KB / 19 data files.

### Fixed

- **B3** : floor plans page affichait *« 0 plan(s) »* + grille vide + footer pagination *« 1-6 sur 6 »*. Cause racine = **DTO broken** : `FloorPlanResponseDto` exposait `name`/`floor`/`building`/`tenantId`/`createdAt`/`updatedAt` qui n'existent pas dans le schéma Prisma, et n'exposait PAS `title`/`site`/`planGroupId` qui existent. `class-transformer` (avec `excludeExtraneousValues: true`) droppait les vrais champs et émettait `undefined` pour les noms légacy → le filtre frontend `plan.title?.toLowerCase().includes('')` retournait `undefined` pour tous les plans → rejet total. `meta.total` restait correct côté pagination, d'où la contradiction visible. ([#67](https://github.com/eoncom/XCH/pull/67))
- **B3 (suite)** : dedup poussé serveur via raw SQL CTE (`COALESCE("planGroupId", id)` + `MAX(version)` + `COUNT(*) AS total_versions`) — `meta.total` désormais cohérent avec la grille, badge *« X versions »* lit `plan.totalVersions` (un champ par row dans la réponse). Le frontend a perdu `getLatestVersions` / `getVersionCounts` (helpers client supprimés). ([#67](https://github.com/eoncom/XCH/pull/67))
- **B10** : `POST /api/backup/full` produisait un ZIP de 101 KB avec **9 tables silencieusement exclues** — Expense (240 records dans le seed test), Budget (18), BillingEntity, CostAllocation, Photo, AssetMovement, ConnectivityLink, SiteHealthSnapshot, TaskComment. Restaurer un backup d'un tenant peuplé en dépenses/budgets aurait perdu tout l'écosystème coûts sans erreur visible. `exportAllTenantData()` étendu avec les 9 tables ; `restoreFullBackup()` symétrique avec FK ordering strict + Budget hierarchy 2-pass + `contactIdMap` ajouté pour remap `Expense.vendorId`. Validation prod : ZIP passe à 161 KB, 19 data files, metadata.counts liste les 9 nouvelles tables. ([#67](https://github.com/eoncom/XCH/pull/67))
- **B10 (UI)** : libellé du backup remplacé. *« Base de données + fichiers MinIO »* → *« Toutes les données métier (sites, équipements, baies, plans, tâches, dépenses, budgets) + fichiers référencés (plans, pièces jointes, photos) »* avec caveat italique sur les fichiers orphelins du stockage objet (renvoyés à Track D). ([#67](https://github.com/eoncom/XCH/pull/67))

### Removed

- **`// @ts-nocheck`** retiré de [`frontend/src/app/dashboard/costs/reports/page.tsx`](frontend/src/app/dashboard/costs/reports/page.tsx) (résidu de la PR4 abandonnée du Track A). Dry-run grep préalable confirmait des types `BearerReport` / `TargetReport` propres, pas de `any`/cast légacy. ([#67](https://github.com/eoncom/XCH/pull/67))

### Out of scope — figé pour Track D Backup v2

Le backup contient toujours uniquement les **fichiers MinIO référencés en base** (`fileUrl` / `path` FK). Pas de snapshot complet du bucket, pas de fichiers orphelins, pas de checksums SHA-256, pas de dry-run preview restore. Une session dédiée *Track D Backup v2* couvrira ce périmètre (scope figé dans MCP `XCH_TRACK_D_BACKUP_V2_SCOPE`).

### MCP audit trail

- `XCH_TRACK_C_BUGS_SECONDARY_2026_05_10` — session tracking complète (root cause B3 découvert pendant l'investigation, audit pattern restore B10 avant édition, validation prod step-by-step)
- `XCH_BUGS_SECONDARY` — B3 + B10 + ts-nocheck marqués ✅
- `XCH_TRACK_D_BACKUP_V2_SCOPE` — scope figé pour future session
- `XCH_PROD_PORTS` — caveat ports xch-deploy (backend host:3002 → 3000, grafana monopolise host:3000) + caveat rebuild backend-worker en même temps que backend (image SHA partagé mais tag séparé)

---

## [2.1.2] - 2026-05-10 — Bug fixes prod-bloquants + UI/UX professionnalisation

Release post-test global production 2026-05-09 (cf MCP `XCH_PROD_TEST_REPORT_2026_05_09`).
Deux sessions parallèles coordonnées via MCP `XCH_TRACK_AB_COORDINATION` :

- **Track A** — 6 bugs prod-bloquants en 3 PRs cascade (B1+B2+B4+B6+B7+B9)
- **Track B** — 7 findings UI/UX en 1 PR + 1 fixup CI (U1+U2+U3+U4+U5+U7+B8)

**0 collision** entre les 2 tracks malgré zones partagées (`budgets/page.tsx`
lignes 379-380 + banner). Le protocole de locks MCP a fait son travail.

### Fixed (Track A)

- **B1** : dashboard counters now read `meta.total` instead of `array.length` ([#64](https://github.com/eoncom/XCH/pull/64))
- **B2** : tasks Kanban shows all statuses with native pagination per column via `useInfiniteQuery` ([#64](https://github.com/eoncom/XCH/pull/64))
- **B4** : costs page total + count + search now coherent via new `/api/expenses/summary` endpoint ([#64](https://github.com/eoncom/XCH/pull/64))
- **B6** : user theme persists via `/api/users/me/appearance` (PUT) ([#62](https://github.com/eoncom/XCH/pull/62))
- **B7** : `AppearanceProvider` 29-fetch loop killed (`setTheme` stabilized via `useRef`, retiré du dep array `useCallback`) ([#62](https://github.com/eoncom/XCH/pull/62))
- **B9** : budgets over-threshold counter excludes sub-budgets (`rootBudgets.filter`), banner reformulé en 2 lignes autonomes ("Sous-budgets cumulés" + "Dépenses propres au budget") ([#63](https://github.com/eoncom/XCH/pull/63))

### Improved — UI/UX (Track B)

- **U1** : Import CSV — 17 strings sans accents corrigés + 2 refinements UX (em dash sélecteur site, parenthèse preview limit) ([#65](https://github.com/eoncom/XCH/pull/65))
- **U2** : Contacts — tagline reformulée *"Annuaire : fournisseurs, internes, partenaires, équipes techniques et d'urgence"* + 4 accents + scope label *"Délégation X"* (forme pleine, fin du *"Del. X"* cryptique) ([#65](https://github.com/eoncom/XCH/pull/65))
- **U3** : Monitoring — tagline sans jargon *"worker XCH"* → *"Surveillance temps réel : disponibilité des liens, équipements et services."* + sweep cross-pages confirmé propre (sonde gardé = terme métier réseau valide) ([#65](https://github.com/eoncom/XCH/pull/65))
- **U4** : Avatars — nouveau composant partagé `<UserAvatar size=sm/md/lg name email image />` + utilitaire `getInitials` (strip annotations `[…]`/`(…)` + 2-letter init) + refactor 3 call sites ([#65](https://github.com/eoncom/XCH/pull/65))
- **U5 + B8** : Budgets — hiérarchie spatiale forte (parent full-width + sub-grid responsive 1/2/3 cols imbriquée + bordure rouge propagée tint sur bloc parent over-budget) + tag *"Sous-budget de [parent]"* supprimé (contexte spatial fait le job) + skeleton loading ([#65](https://github.com/eoncom/XCH/pull/65))
- **U7** : Settings — 10 skeleton loading states cohérents (Apparence + Tenant + SSO + Électricité + Modules + Types + Modèles + 2 sub-cards Apparence) remplaçant les `<p>Chargement...</p>` plain text ([#65](https://github.com/eoncom/XCH/pull/65))

### Added — Backend

- `GET /api/expenses/summary` endpoint (totalAmount, totalAllocated, count, byType) pour le fix B4 ([#64](https://github.com/eoncom/XCH/pull/64))

### Resolved indirectly

- **B5** : freeze "Par cible" tab — résolu par fix B7. La boucle 29-fetch était le blocker du JS thread (pas le SQL backend). `reportByTarget` mesuré à 35ms post-fix.

### MCP audit trail

- `XCH_PROD_TEST_REPORT_2026_05_09` — rapport initial source des findings (preserved as historic snapshot)
- `XCH_BUGS_PROD_BLOCKERS` — Track A statuts par bug
- `XCH_UIUX_FINDINGS` — Track B statuts par finding
- `XCH_TRACK_AB_COORDINATION` — timeline complète locks/signals/seed handoffs entre les 2 tracks

---

## [2.1.1] - 2026-05-09 — S5b Heavy SQL refactors

Patch de performance interne post-v2.1.0. Refactor des 4 endpoints
agrégat lourds du module `expenses` extraits volontairement de S5 PR4
pour ne pas étendre un PR approuvé. **Wire shape API strictement
inchangée** (bump patch). Plans `EXPLAIN (FORMAT TEXT)` consolidés sur
`xch-deploy` dans [`docs/perf/SESSION-05B-explain-analyze.md`](docs/perf/SESSION-05B-explain-analyze.md).

Clôture la séquence S5b du plan v2 finalization avant la mini-session
typecheck cleanup pré-tag final.

### Internal — pas de changement de contrat API

- **`projection()` + `reportByMonth()` SQL natif** ([backend/src/modules/
  expenses/expenses.service.ts](backend/src/modules/expenses/expenses.service.ts)) :
  l'éclatement MONTHLY/QUARTERLY/YEARLY sur buckets mensuels passe d'une
  boucle JS (`Map<monthKey, …>` après `findMany`) à une CTE SQL unique
  `GENERATE_SERIES(start, end, '1 month'::interval) JOIN expenses` avec
  contribution check par mois. 1 query au lieu de N (12-60 selon plage).
  Sémantique d'amortissement préservée à l'identique : `QUARTERLY =
  totalAmount/3` chaque mois actif, `YEARLY = totalAmount/12` chaque
  mois actif (pas modulo). `reportByMonth` filtre `HAVING SUM > 0` pour
  préserver la wire-shape compacte (mois sans contribution absent).
  `projection` matérialise tous les mois de la fenêtre côté JS reshape
  (1 passe linéaire post-fetch). Le cap 10k expenses (guard JS-side
  memory du `findMany`) est retiré : avec l'aggregation SQL natif, la
  mémoire Node n'est plus exposée.

- **`reportByBearer()` + `reportByTarget()` group-by SQL natif** : passage
  de `findMany + reduce JS` à `$queryRaw` avec `LEFT JOIN LATERAL` pour
  `reportByBearer` (somme des `cost_allocations.amount` par expense, sans
  row-multiplication). 1 query au lieu de 1 findMany + N JS-side
  iterations. `netBorne = totalBorne - totalRefactured` calculé
  post-fetch (~10 rows max).

- **24+ tests query-count** ajoutés (pattern S5 PR4 R2 — `expect(prisma.
  $queryRaw).toHaveBeenCalledTimes(1)`, `expect(prisma.expense.findMany)
  .not.toHaveBeenCalled()`). Garantit qu'un futur refactor qui
  régresserait à un pattern findMany + boucle JS échouerait au build CI.
- **24 tests d'intégration** sur vraie Postgres (`backend/test/integration/
  expenses/projection.spec.ts` + `reports.spec.ts`) — 12 cas projection
  (8 scenarios originaux + 4 cas bordure neufs : MONTHLY dateEnd
  antérieur, YEARLY mid-window, ONE_TIME bordure haute, fenêtre vide) +
  12 cas reports (LATERAL aggregation, multi-bearer/target, tenant
  isolation cross-leak, type-smoke `typeof === 'number'`).

- Type fix dans le legacy `reportByTarget`: `name: true` → `name: string`
  dans le type littéral interne (était une regression silencieuse, jamais
  exercée par le compilateur).

### Documentation

- **`docs/perf/SESSION-05B-explain-analyze.md`** — 8 plans EXPLAIN
  AVANT/APRÈS pour les 4 cibles (1 par endpoint avant + 1 après =
  8 plans), capturés sur xch-deploy avec `EXPLAIN (FORMAT TEXT)`. Pas
  de timings/buffers : volume pilote (1 expense présente) → Seq Scan
  partout, mesures sans valeur prédictive. À ré-exécuter avec
  `(ANALYZE, BUFFERS)` quand un pilote dépasse ~1k expenses (caveat
  reproduit du pattern S5 PR3 doc).

### Plan v2 finalization — état après tag

- ✅ S5b livrée. Cible 3 audit `enrichWithEntityLabels` retirée du scope
  S5b et **reportée S6 perf vague 2** : l'audit n'est pas un vrai N+1
  par log mais déjà 6 queries fixes batchées par type (cf. analyse plan
  + scan code 2026-05-09). ROI faible (-5 roundtrips, ~5-15ms par GET
  /audit), à reconsidérer quand un autre type d'optim entrera en scope.
- 🔮 Reste pour clôture officielle plan v2 : mini-session typecheck
  cleanup pré-tag final (résidu post-S9 : TS7006 implicit any +
  TS2769 + TS2322).

### PRs incluses dans ce tag

- #59 `feat(s5b-pr1): refactor projection() + reportByMonth() in single SQL query`
- #YY `feat(s5b-pr2): reportByBearer + reportByTarget — single SQL group-by + bundle release v2.1.1`

---

## [2.1.0] - 2026-05-09 — S8 GlitchTip self-hosted observability (air-gap)

Tag de feature observabilité, **post-v2.0.0**. Aucune surface utilisateur
visible : pur ajout d'une stack GlitchTip self-hosted (compose dédié,
cycle de vie indépendant) plus l'instrumentation `@sentry/node` + `@sentry/nextjs`
côté backend (api+worker) et frontend (browser+ssr+edge). Architecturé
explicitement air-gap : zéro forwarding externe vers Sentry SaaS, DSN
internes Docker pour les processus serveur, DSN public via NPM Let's
Encrypt seulement pour le browser (qui ne peut pas joindre le réseau
Docker). Décision design + procédure deploy détaillées dans
[ADR-024 GlitchTip air-gap observability](docs/decisions/adr-024-glitchtip-air-gap-observability.md).

### Internal

- **Compose stack `docker-compose.glitchtip.yml`** — postgres + redis +
  glitchtip-web + glitchtip-worker + glitchtip-admin-seed (idempotent).
  Réseaux : `glitchtip-internal` privé + `xch-network` external avec
  alias DNS `glitchtip` pour que NPM puisse pointer
  `proxy_pass http://glitchtip:8000`. Image pinnée
  `glitchtip/glitchtip:v4.1`. Rétention events 90j (`GLITCHTIP_MAX_EVENT_LIFE_DAYS`),
  signup public désactivé (`ENABLE_USER_REGISTRATION=false`), admin
  auto-seedé via `createsuperuser` Django.

- **Outils ops `glitchtip/scripts/`** :
  - `gen-secrets.sh` : génère `glitchtip/.env` avec SECRET_KEY (64 hex) +
    POSTGRES_PASSWORD (64 hex) + ADMIN_PASSWORD (48 hex) via openssl.
    Atomic write mode 600. `--force`, `--stdout`.
  - `gen-dsn.sh` + `_gen_dsn.py` : bootstrap idempotent via Django ORM
    (`docker exec ... manage.py shell`) — création org `xch` + team +
    3 projets (`xch-backend`, `xch-worker`, `xch-frontend`) + association
    super-admin comme Owner + member. Génère 3 DSN différenciés par
    audience : interne pour backend/worker (`http://...@glitchtip-web:8000/<id>`),
    public pour frontend (`https://...@glitch.eoncom.io/<id>`). Modes
    `--dry-run` (rollback transaction côté Python), `--json`. Audit
    log GET/CREATE/ENSURE par ressource. python3 stdlib (pas de jq).

- **Backend `@sentry/node`** init via `backend/src/main.ts` (side-effect
  import en TOUT premier, avant `@nestjs/core`, pour que les async
  hooks Sentry s'attachent avant les libs instrumentées). Module
  `backend/src/common/observability/glitchtip/`  :
  - `init.ts` : `Sentry.init` no-op si `GLITCHTIP_DSN_BACKEND` vide,
    `tracesSampleRate=0`, `sendDefaultPii=false`, scope tag
    `mode=api|worker` set via probe argv `--worker` ou `XCH_MODE=worker`.
  - `scrubber.ts` : exporte `SECRET_REGEX_BUNDLE` (single source of
    truth, déplacé depuis `dto-shape.spec.ts` S9 PR #15) +
    `scrubEvent` `beforeSend` qui drop l'event entier si match (filet
    fail-closed) + drop `user.email` (garde uniquement `user.id` UUID)
    + drop `request.cookies` / `Authorization` / `Cookie` /
    `X-CSRF-Token` / body.

- **`AllExceptionsFilter`** (`backend/src/common/filters/`) : sur la
  branche `else` (unhandled exceptions seulement, PAS HttpException ni
  Prisma known errors qui sont du business expected),
  `Sentry.captureException(err, { tags: {method, route}, extra:
  {status_code, path}, user: {id} })`. Signal/bruit propre côté UI
  GlitchTip.

- **Worker** `WorkerEventLogger.jobFailed()` (`backend/src/common/
  observability/`) : après l'`emit('error')` JSON pour Loki, appelle
  `Sentry.captureException` avec tags bas-cardinalité `queue + jobName +
  errorCode` (extrait du SCREAMING_SNAKE prefix) et extras
  haute-cardinalité `jobId + attempts`. Couvre tous les processors BullMQ
  actuels et futurs (un seul chemin de capture).

- **Frontend `@sentry/nextjs`** ^8.55.2 via `instrumentation.ts` racine
  (Next 15.1.3) + `sentry.{server,edge}.config.ts` + `sentry.client.config.ts`.
  **Pas de `withSentryConfig`** : le webpack plugin Sentry entre en
  conflit avec `config.externals['canvas'] = 'canvas'` requis par Konva
  SSR ; bypass total du wrapper. Conséquence : source maps pas auto-
  uploadées en prod (backlog `@sentry/cli` standalone si besoin).
  Scrubber partagé `frontend/src/lib/observability/glitchtip-scrubber.ts`
  filtre les erreurs LÉGITIMES (`AbortError`, `ChunkLoadError`,
  `Loading chunk N failed`, HTTP 401/403/404 RBAC fail-closed +
  deep-link).

- **CSP** (`frontend/src/lib/csp.ts`) : helper `glitchtipIngestOrigin()`
  parse `URL(NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND).origin` pour autoriser
  dynamiquement l'origin GlitchTip dans `connect-src` — single source,
  pas d'env var dédiée à maintenir. Try/catch fallback si DSN absent
  ou malformé.

- **Endpoints synthèses `_test-error`** (item 6 du handoff) : double
  gating `ENABLE_TEST_ERROR_ENDPOINTS=true` env (désactivé par défaut)
  ET super-admin RBAC. Si flag OFF → 404 (pas d'info-leak sur
  l'existence de la route).
  - `GET /api/_test-error/backend` → unhandled exception (route via
    AllExceptionsFilter else)
  - `POST /api/_test-error/worker` → enqueue job qui throw côté processor
  - `/dashboard/test-error` (page) → bouton qui throw, capturé par
    `dashboard/error.tsx` (modifiée pour appeler `Sentry.captureException`,
    couvre désormais TOUTES les erreurs unhandled de `/dashboard/*`).

- **`scripts/audit-egress.sh`** (item 7) : 4 assertions runtime
  validant l'air-gap.
  - 1 : `node` HTTP probe vers https://sentry.io depuis xch-backend doit
    échouer (mode `--strict`) ou warner sinon. Pas de curl (absent du
    container Node).
  - 2 : `getent hosts sentry.io` NXDOMAIN si DNS bloqué OS-level.
  - 3 : `node` probe vers `http://glitchtip-web:8000/api/0/` doit
    répondre (preuve réseau interne fonctionne).
  - 4 : `grep sentry.io backend/src + frontend/src` = 0 match (preuve
    code source clean).
  - Modes `--strict` (prod air-gap, 1+2 bloquantes) / défaut (dev/test,
    1+2 informationnelles, 3+4 toujours bloquantes).

- **Bug pré-existant fix** : `frontend/Dockerfile` n'avait pas d'`ARG
  NEXT_PUBLIC_*` et `.dockerignore` exclut volontairement `.env*` →
  toutes les vars `NEXT_PUBLIC_*` étaient bundlées vides en build. Fix :
  `ARG` + `ENV` dans Dockerfile + `build.args:` dans
  `docker-compose.yml`. Procédure deploy ajustée (`set -a; source
  frontend/.env; set +a; docker compose build frontend`). Le bug
  marchait par accident sur v2.0.0 parce que toutes les valeurs
  fallback à vide étaient acceptables (`NEXT_PUBLIC_API_URL=''` →
  relatif via nginx).

### Décisions design verrouillées (cf ADR-024)

- **Drop `user.email` entièrement** côté events Sentry — garde
  uniquement `user.id` (UUID Prisma). Pas de hash email, pas de PII
  même hashée.
- **3 projets GlitchTip pour 4 runtimes** — backend api/worker partage
  le projet `xch-backend` distingué par tag `mode` ; frontend a son
  propre `xch-frontend` distingué par tag `runtime=browser/ssr/edge`.
  Le projet `xch-worker` est créé par `gen-dsn.sh` mais inutilisé
  (architecture historique conservée pour rollback futur si on veut
  séparer). À nettoyer si pas réutilisé d'ici v2.2.
- **Rétention 90j** events GlitchTip via `GLITCHTIP_MAX_EVENT_LIFE_DAYS=90`,
  purge auto via Celery beat `cleanup_old_events`.
- **Manual SDK init** côté frontend (no `withSentryConfig`) : compromis
  source maps auto-upload contre robustesse Konva externals.

### Limitations connues / backlog

- Pas de tracing (`tracesSampleRate=0`) ni de session replay. Volume
  GlitchTip réduit, pas de visibilité fine sur les requêtes/transactions.
  À reconsidérer si besoin diagnostic perf pointu.
- Pas de profiling (`profilesSampleRate=0`).
- Source maps pas uploadées auto en prod côté frontend → stack traces
  browser minifiées dans la UI GlitchTip. Acceptable pour identifier
  l'erreur ; pour debug fin, utiliser `glitchtip-cli` standalone au
  build step (backlog).
- **Coupling `apps.organizations_ext` / `apps.teams` / `apps.projects`**
  dans `glitchtip/scripts/_gen_dsn.py` : valable pour image v4.1 pinnée.
  Si bump GlitchTip un jour, vérifier les imports avant deploy
  (le helper lèvera `error` field explicite côté audit JSON si un
  import échoue).

### Commits inclus depuis v2.0.0 (ordre chronologique sur S8)

- `6095a88` chore(s8): docker-compose.glitchtip.yml stack dédiée (PR0 handoff)
- `5dc7d7c` feat(s8): glitchtip bootstrap ops + 3 compose fixes (item 1)
- `d3f7253` feat(s8): backend GlitchTip wiring — init + scrubber + AllExceptionsFilter (item 2)
- `2802dfa` feat(s8): worker GlitchTip capture in WorkerEventLogger.jobFailed (item 3)
- `ea2d301` feat(s8): frontend GlitchTip via @sentry/nextjs (item 4 — manual init)
- `b5dca9a` feat(s8): CSP connect-src — autorise l'ingest GlitchTip parsé du DSN (item 5)
- `d0fc1e7` feat(s8): test-error endpoints + validation handoff (item 6)
- `ac74f70` feat(s8): scripts/audit-egress.sh — air-gap GlitchTip 4 assertions (item 7)
- `6faabdc` fix(s8): NEXT_PUBLIC_* via build.args — bug pré-existant + bloquant item 6
- `c0d9823` fix(s8): wire sentry.client.config via Providers — bug bloquant item 6
- `e70bee2` fix(s8): audit-egress.sh — node-based probe + relaxed/strict modes
- `13e0e53` fix(s8): gen-dsn.sh — associer admin comme OrganizationOwner + Team member

### Validation runtime (xch-deploy pilote)

- 3 events visuellement validés dans GlitchTip UI (1 par projet `xch-backend` mode=api,
  `xch-backend` mode=worker, `xch-frontend` runtime=browser).
- `bash scripts/audit-egress.sh` (relaxed) : 2/4 PASS bloquantes + 2/4 WARN
  réseau (xch-deploy = dev/test internet-ouvert, attendu).
- Critère acceptance v2.1.0 atteint.

### Reste pour bascule vraie prod air-gap (post-v2.1.0)

- Mettre en place le firewall outbound bloquant sur l'host prod final
  (ou DNS-block sentry.io) → puis re-run `bash scripts/audit-egress.sh
  --strict` doit retourner 4/4 PASS.

---

## [2.0.0] - 2026-05-06 — S9 Hardening tail FINAL : 100% DTO coverage + CSP strict

Tag majeur clôturant le plan v2 finalization (chantier S9 — Hardening tail).
Les 5 PRs vague C (#49 → #54 GitHub, s9-pr12 → s9-pr17) ont été livrées en
~36 h, tag aligné sur le merge de PR #54 (s9-pr17 CSP nonce). À partir
d'ici la baseline `dto-coverage-baseline.json` est **vide** (`exempted_files: []`)
et le garde-fou CI affiche `Baseline is empty → guard is fully strict.
ADR-023 cascade complete.`

### Changed (BREAKING)

- **100% DTO coverage backend** — toutes les responses HTTP sont désormais
  des Response DTOs structurés, plus aucune entité Prisma brute. Le wire
  shape de tous les endpoints est garanti par class-transformer
  `excludeExtraneousValues: true` + tests dto-shape avec runtime smoke
  `instanceToPlain → JSON.stringify` anti-leak. Affecte 274 endpoints
  répartis sur 32 controllers. Côté wire, les changements observables
  par d'éventuels consumers externes sont limités à :
  - Disparition systématique de tout champ Prisma non explicitement
    `@Expose()'d` (`passwordHash`, `totpSecret`, `totpBackupCodes`,
    `inviteToken`/`resetToken` hashés, `failedLoginAttempts`,
    `lockedUntil`, `externalId` OIDC sub).
  - `Budget.amount` (et `Budget.parent.amount`) désormais sérialisé en
    `number` (vs `string|number` legacy) — `Decimal.valueOf()` route
    par défaut. Frontend XCH déjà compatible (`String(amount)` marche
    pour les deux). À vérifier sur tout consumer externe scriptant
    `/api/budgets/*` qui dépendrait du type string explicite.
  - Audit log enrichi d'un champ `entityLabel: string | null` synthétisé
    par `enrichWithEntityLabels` (passthrough — pas un nouveau champ
    DB).
- **CSP strict côté frontend** — élimination définitive de
  `'unsafe-inline'` du Content-Security-Policy. Nonce dynamique généré
  par `frontend/src/middleware.ts` (Web Crypto Edge runtime,
  `crypto.randomUUID()`), propagé via header `x-nonce` vers le root
  layout, et appliqué aux directives `script-src` et `style-src`.
  `next.config.mjs` ne sert plus de CSP statique — single source of
  truth = middleware. `'unsafe-eval'` reste actif uniquement en dev
  (HMR Next.js). Les tile providers (OSM / CartoDB Dark Matter) +
  Nominatim restent whitelistés dans `img-src` / `connect-src`.

### Added

- **Pattern S9 ADR-023 finalisé** (cf
  `backend/src/common/dto/response/README.md`) : 3 cas mapping
  (A `plainToInstance` direct, B helper manuel
  `to<X>ResponseDto(input, ctx?)`, C `plainToInstance + @Type()`),
  arbre de décision en 3 questions, conventions de nommage, pièges
  connus (`Record<string,T>`, `@Transform({obj})` pour Prisma JSON,
  Decimal `string|number` → `number`).
- `frontend/src/lib/csp.ts` — helper `buildCsp(nonce)` réutilisable.
- 33 nouveaux tests dto-shape `auth/dto-shape.spec.ts` (anti-leak
  credentials + 3 wire shapes du LoginResponseDto + 2 tests défensifs
  cross-shape contamination).
- 20 nouveaux tests dto-shape `__tests__/reliquats-dto-shape.spec.ts`
  (8 modules markers + 5 modules non-triviaux avec runtime smoke
  Decimal/Record/agrégat/tree).

### Internal

- **DTO discipline cascade S9 vague C** — 6 PRs livrées sur main
  post-v1.11.0 :
  - **#49 (s9-pr12)** assets — Prisma raw leak type A (~20 endpoints).
  - **#50 (s9-pr13)** asset-models — vendor catalog (~12 endpoints,
    2 binary streams).
  - **#51 (s9-pr14)** expenses + billing-entities groupés (~17
    endpoints, 1 binary stream CSV export).
  - **#52 (s9-pr15)** auth — module sensible MFA/2FA/refresh (20
    endpoints, 11 Response DTOs avec hardening anti-leak credentials).
  - **#53 (s9-pr16)** reliquats groupés — 13 modules (~58 endpoints) :
    access-overrides, admin, audit, budgets, consumption, contact-types,
    contacts, organization, sdwan, search, seed, setup, user-delegations.
    Découverte runtime critique gravée : `Prisma.Decimal` sur champ
    typé `string | number` est dropé en `{}` par
    `enableImplicitConversion`; fix → typage `number` direct.
  - **#54 (s9-pr17)** CSP nonce dynamique frontend.
- **Garde-fou CI `dto-coverage` à 0 module exempté** —
  `backend/scripts/dto-coverage-baseline.json` `exempted_files: []`.
  Toute future régression (endpoint ajouté sans `@ApiResponse({ type })`)
  fait échouer le check.
- **Tests dto-shape sur 100% des modules** — assertions inclusion
  explicites + runtime smoke anti-leak via helper `wireShape()` qui
  parse `JSON.parse(JSON.stringify(instanceToPlain(dto)))` (drop des
  `undefined` props comme le vrai HTTP wire).
- **Backend Jest 300 → 386** (+86 tests vague C : 23 assets + 8
  asset-models + 9 expenses + billing + 33 auth + 20 reliquats).
- **Cleanup baseline cascade** — entrées `assets` et `asset-models`
  retirées en PR #16 (n'avaient pas été nettoyées en PR #49 / #50
  malgré la couverture effective).
- **Layout root passé en async** (Next 15 — `headers()` retourne
  `Promise<ReadonlyHeaders>`) pour permettre la lecture du nonce.

### PRs incluses depuis v1.11.0

- #49 assets · #50 asset-models · #51 expenses+billing-entities
- #52 auth · #53 reliquats · #54 CSP nonce

### Plan v2 finalization — état après tag

Plan v2 (validé 2026-04-29) clos officiellement. Reste hors scope plan
v2 mais identifié dette résiduelle :
- S8 Sentry / error tracking — prérequis pilotes externes non bloquant
  pour v2.0.0, à programmer selon contraintes pilotes.
- S5b Heavy SQL refactors — performance, optionnel.

---

## [1.11.0] - 2026-05-06 — DTO discipline cascade S9 vague A+B (12 modules)

Tag intermédiaire S9 — Hardening tail (plan v2 finalization). Pure refonte
interne anti-leak Prisma : aucune surface utilisateur visible. Cascade
post-baseline ADR-023 sur 12 modules en quelques heures (critère Q4 v1.11.0
< 4 jours ouvrés très largement validé).

### Changed

- Aucune surface utilisateur visible (refonte interne anti-leak Prisma).

### Internal

- **DTO discipline cascade S9 vague A+B** — 12 modules migrés au pattern
  ADR-023 (Response DTO co-localisé + `@ApiResponse({ type })` Swagger +
  `class-transformer` whitelist `excludeExtraneousValues: true`) :
  monitoring (baseline) · connectivity · notifications · backup · racks ·
  sites · tenants · users · floor-plans · integrations · tasks.
- **126/274 endpoints HTTP couverts (46%)** par Response DTO + garde-fou
  CI `dto-coverage` actif (`backend/scripts/check-dto-coverage.ts`).
  Baseline `backend/scripts/dto-coverage-baseline.json` : 28 → 16
  controllers exemptés.
- **Backend Jest 193 → 300** (+107 tests dto-shape par module : assertions
  d'inclusion explicites `toHaveProperty` + `not.toHaveProperty` sur
  champs sensibles + runtime smoke `instanceToPlain` → JSON).
- **ADR-023 dto-discipline.md** — pattern figé : (Cas A) `plainToInstance`
  pur ; (Cas B) helper manuel `to<X>ResponseDto(input, ctx?)` pour shapes
  composites / `Record<string, T>` ; (Cas C) `plainToInstance` + `@Type()`
  pour relations imbriquées. README opérationnel
  (`backend/src/common/dto/response/README.md`) + signature canonique
  `ResponseMappingCtx` exportée.
- **Patterns transversaux gravés** :
  - `@Transform(({obj}) => obj.field)` pour Prisma JSON / `Record<string,T>`
    embedded — bypass class-transformer instantiation pipeline.
  - `@Res()` binary streams (backup ZIP downloads, etc.) exemptés du
    `type:` requirement par le script CI (détection automatique via
    look-ahead méthode).
  - `ADJACENCY_WINDOW=20` dans le script CI pour couvrir
    `@Post + @UseInterceptors(FileInterceptor(...))` multi-line avant
    `@ApiOkResponse` (pattern file upload).
  - **Sensitive fields hardening** sur `User` (DTO whitelist exclut
    `passwordHash`/`totpSecret`/`totpBackupCodes`/`inviteToken`/
    `resetToken`/`failedLoginAttempts`/`lockedUntil` ; runtime smoke
    test regex matchers contre bcrypt prefix, TOTP base32, tokens).
- **`ClassSerializerInterceptor` global activé** dans `backend/src/main.ts`
  (`useGlobalInterceptors`).
- **`as any` cleanup** sur les modules touchés (where/data/expense
  payloads typés `Prisma.<Model>WhereInput` / `Prisma.<Model>UpdateInput`).

### PRs

- #37 — Baseline DTO discipline + monitoring pivot (ADR-023)
- #38 — connectivity Response DTOs
- #39 — notifications Response DTOs
- #40 — backup Response DTOs (binary streams + Record helpers)
- #41 — racks Response DTOs (Prisma JSON `@Transform({obj})` pattern)
- #42 — sites Response DTOs (vague B start)
- #43 — tenants Response DTOs (SSO secret-mask runtime smoke)
- #44 — users Response DTOs (sensitive fields hardening)
- #45 — floor-plans Response DTOs
- #46 — integrations Response DTOs (Swagger marker-only — NetBox upstream)
- #47 — tasks Response DTOs (Swagger marker-only — relations massives)

### Reste post-tag (vague C+D, avant v2.0.0)

- #12 assets (type A Prisma raw leak — le plus risqué, séquentiel seul)
- #13 asset-models · #14 expenses+billing-entities · #15 auth (sécurité)
- #16 reliquats groupés · #17 CSP nonce dynamique (frontend)

---

## [1.10.0] - 2026-05-04

### Added
- Sélecteur de criticité (filtre CRIT/WARNING/INFO/HEALTHY).
- Badge de criticité par site.

### Changed
- Agrégation basée sur le flag `severity` (voir ADR-022).
- Backfill `severity` sur l'historique.

### Internal
- BullMQ queue par site (debounce 300ms, dédup).
- Baseline typecheck frontend : 60/16 → 0/0.
- Backend Jest 193/193.

### PRs
- #34 — Aggregation refonte
- #35 — Typecheck cleanup

---

## [1.9.0] - 2026-05-03 — Refonte E2E Playwright + mini-dette traversale + validation E2E réelle (Sessions 7 + 7.5 du plan v2 finalization)

**Tag posé après validation S7.5 réelle.** Le smoke `@full-user-journey` 10/10 RÉELLEMENT vert sur conditions CI (docker-compose single-origin nginx, run [25263200317](https://github.com/eoncom/XCH/actions/runs/25263200317), 21s tests).

### Session 7 (PR0-PR5, 2026-05-02) = scaffolding + mini-dette traversale

Session 7 livrée en **5 PRs autonomes mergées sans incident** (PR0/1/2/3/4) + PR5 release. **30 specs E2E structurées par domaine + helpers + fixtures + ~210 tests scaffoldés**. Pattern merge autonome (`XCH_AUTONOMOUS_MERGE_PATTERN_S7`) validé sur 4 PRs consécutives.

Distinction critique gravée MCP (`XCH_E2E_SCAFFOLDING_VS_VALIDATION`) : **scaffolding ≠ testing**. Les specs PR1-PR4 ont été écrites en lisant le code, pas en validant visuellement l'app actuelle. Le tag v1.9.0 a été reporté de 12h pour livrer une vraie validation (S7.5).

### Session 7.5 (PR5d-PR5h, 2026-05-03) = validation E2E réelle

12 itérations PR5h pour faire passer le smoke 10/10 vraiment vert sur CI :

- **PR5d** (cherry-pick PR5c #21 fixes infra workflow + α testids login/sidebar/delegation + SELECTORS_STRATEGY.md hybride β/α) — 8 commits sur main
- **PR5e** (alignement specs RBAC sur AUTH_MODEL_V2 — 3 drifts conceptuels Casbin retiré : manager has MANAGE ≠ "lecture seule sites", tech/viewer ACCEDE settings tabs personnels ≠ "denied", admin demo data dans tab Tenant `?tab=tenant`)
- **PR5f** (sites-sections.spec.ts skip 4 mutations obsolètes wizard schema ADR-018, fix h1 selectors généralisés via `:has-text()`)
- **PR5g** (codemod button:has-text → a[href] sur 4 specs CTAs Next.js Link, env override polling `NEXT_PUBLIC_NOTIFICATION_POLL_INTERVAL=2000`)
- **PR5h** (smoke @full-user-journey activation 10/10 vert via 12 itérations diagnostiques) — voir détail ci-dessous

### PR5h — 12 itérations diagnostiques (retex anti-pattern important)

Cause racine progressive identifiée :
1. iter 1 : `describe.serial.skip` + `--grep @smoke` = exit 1 "no tests found" — fix par `test.skip()` individuels
2. iter 2-3 : status filter 200 vs 201 (login retourne 201 Created) — fix `>= 200 && < 300`
3. iter 4 : React 18 controlled component + `page.fill()` ne propage pas state → form submit avec values vides → no fetch — bypass via API direct `page.request.post('/api/auth/login')`
4. iter 5 : login API + isAuthenticated check pour éviter rate limit 429 sur 10 logins serial
5. iter 6 : cross-origin cookie workaround (re-set cookies sur frontend domain via context.addCookies)
6. iter 7 : pattern `test.beforeAll` + `test.beforeEach addCookies` (storageState partagé)
7. iter 8 : utiliser `context.cookies()` direct au lieu de parsing manuel Set-Cookie
8. iter 9 : `NEXT_PUBLIC_API_URL=''` + `BACKEND_INTERNAL_URL` Next.js rewrites
9. iter 10 : workflow ciblait xch.eoncom.io single-origin
10. iter 11 : diagnostic — GitHub Actions runner ne peut pas joindre xch.eoncom.io (firewall/WAF block)
11. iter 12 : **docker-compose.ci.yml single-origin nginx** dans le runner — 10/10 vert

3 patterns réutilisables gravés MCP pour S8/S9/S5b/futures sessions :
- **`XCH_E2E_AUTH_STORAGE_STATE_PATTERN`** — `test.beforeAll` + `test.beforeEach addCookies` pour partager storageState, évite rate limit + reproduit comportement utilisateur réel
- **`XCH_E2E_SMOKE_AUTHORITY_VALIDATION`** — workflow ACTIVÉ + EXÉCUTÉ + endpoints RÉELS (3 conditions cumulatives pour mériter "filet de sécurité CI")
- **`XCH_ITERATION_THRESHOLD_PRINCIPLE`** — au-delà de 3 itérations sur le même symptôme, agent ping user obligatoire avec options stratégiques (vs brute force scope creep). Le coût d'une réarchitecture posée vaut souvent moins que celui de N itérations.

### Added (Session 7 PR0 — mini-dette traversale + fondations E2E)

- **Migration `10_fk_expense_ondelete`** — 3 FK Expense (`delegationId`, `siteId`, `bearerId`) reçoivent `onDelete:` explicite (RESTRICT pour les NOT NULL, SetNull no-op DB pour `siteId` nullable). Cohérent avec migration 8 (S5 PR2).
- **Résolution Known Issue SSR/CSR cookies E2E** (Option A retenue par utilisateur) : [`frontend/e2e/fixtures/auth.fixture.ts`](frontend/e2e/fixtures/auth.fixture.ts) `Promise.all([waitForResponse, click])` garantit que le listener du POST /api/auth/login est armé AVANT le submit. + [`frontend/middleware.ts`](frontend/src/middleware.ts) fallback CSR si `referer=/login` (laisse passer la 1ʳᵉ navigation, Zustand `auth-store.checkSession()` valide côté client).
- **DB e2e isolée `xch_e2e`** — service `postgres-e2e` (port 5433) dans [`docker-compose.e2e.yml`](docker-compose.e2e.yml) + workflow [`e2e-tests.yml`](.github/workflows/e2e-tests.yml) renommé `xch_dev` → `xch_e2e`. Plus de pollution dev local.
- **Endpoints reset scoped par domaine** — `POST /api/seed/reset/:domain` (sites/assets/racks/expenses/monitors/notifications). Garde `TestEnvOnlyGuard` (refus si `NODE_ENV=production`). Permet aux specs E2E d'isoler leur domaine sans reset global.
- **Codemod `react/no-unescaped-entities`** — script Python conservé [`frontend/scripts/codemod-unescaped-entities.py`](frontend/scripts/codemod-unescaped-entities.py) avec fallback UTF-16 ESLint vs codepoint Python (emoji 💡 surrogate pair). 163 erreurs → **0**.
- **Lockfile régénéré** — `frontend/package-lock.json` (manquant depuis commit `0cc9211` antique). 569 packages résolus, restauration `npm ci` + cache deps dans tous les workflows.
- **Workflow baseline non-régression** — [`frontend-checks.yml`](.github/workflows/frontend-checks.yml) compare compteurs courants vs [`baselines/frontend-checks.json`](.github/baselines/frontend-checks.json) versionné. Fail explicite si régression OU CAPTURE INVALIDE (4 cas : stable / amélioration / régression / capture invalide). Validé par test négatif (run 25249322588 fail attendu, retour vert run 25249527769).
- **Lint custom ESLint useQuery isError** — règle `no-restricted-syntax` qui flag `ObjectPattern` destructurant `isLoading` SANS `isError` ni `error` (pattern S6 PR4). Mode warn baseline 38 warnings / 32 fichiers legacy acceptés.

### Added (Session 7.5 PR5d — bootstrap)

- **`frontend/e2e/SELECTORS_STRATEGY.md`** — décision hybride β/α gravée pour éviter dérive future
- **Zone α testids** : login form (`login-form|email|password|submit`), sidebar nav (16 testids `nav-{slug}` via helper déterministe), delegation switch (`delegation-switcher-card`, `delegation-option-{code}`)
- **Cherry-pick 5 commits PR5c** : drop MinIO + STORAGE_TYPE=filesystem, PORT=3002, wait-on tcp, seed via `/api/setup/initialize`, TEST_USERS @demo.fr alignés sur seed démo réel

### Added (Session 7.5 PR5h — smoke activation finale)

- **`docker-compose.ci.yml`** + **`docker/nginx/nginx.ci.conf`** — stack CI single-origin self-contained (nginx port 8080 + frontend + backend + postgres + redis + minio). Reproduit prod NPM sans dépendre de xch-deploy.
- **Workflow `e2e-tests.yml` refondu** — docker-compose CI avec build/wait/initialize/smoke run/logs dump/cleanup. ~6 min total CI.
- **Smoke spec activée** : `test.describe.serial` + `test.beforeAll` (login API one-shot) + `test.beforeEach` (addCookies sharedCookies) + 10 tests serial. Assertions sidebar nav-{X} testid (plus stable que h1 page heading qui varie selon copie FR + état seed).

### Métriques

- **30 specs E2E** structurées par domaine (auth/sites/assets/racks/tasks/expenses/monitor/notifications/qr/dashboard/rbac/settings/smoke/floorplans)
- **~210 tests** dont smoke `@full-user-journey` **10/10 réellement vert** sur CI
- **57 skip TODO** tracés exhaustivement dans `XCH_E2E_SKIP_TODO_TRACKING` (catégorisés Cat. 1-7 pour activation future)
- **Baseline non-régression frontend** stable 5/5 sur les 5 PRs Session 7
- **0 régression** introduite, **0 conflit non trivial** au rebase
- **PR5c #21 fermée** post-cherry-pick (mapping SHA original → nouveau documenté en commentaire de fermeture)

### Notes patterns gravés MCP (réutilisables S9/S8/S5b/futures sessions)

- `XCH_AUTONOMOUS_MERGE_PATTERN_S7` — 4 règles merge autonome (CI vert + baseline stable + pas de dette + pas modif schéma/ADR/architecture)
- `XCH_CI_SCRIPT_DEFENSIVE_PATTERNS` — 4 règles capture/validation/fail explicite/test négatif
- `XCH_E2E_SCAFFOLDING_VS_VALIDATION` — scaffolding ≠ testing, validation visuelle obligatoire avant tag
- `XCH_E2E_SMOKE_AUTHORITY_VALIDATION` — filet CI = workflow ACTIVÉ + EXÉCUTÉ + endpoints RÉELS
- `XCH_E2E_SKIP_TODO_TRACKING` — registre 57 skip catégorisés
- `XCH_LOCKFILE_DRIFT_PATTERN` — 2 incidents 2 sessions, check CI bloquant proposé S9
- `XCH_E2E_AUTH_STORAGE_STATE_PATTERN` — beforeAll + storageState partagé (NOUVEAU S7.5)
- `XCH_ITERATION_THRESHOLD_PRINCIPLE` — ping user après 3 itérations sur même symptôme (NOUVEAU S7.5)

### Added (PR0 — mini-dette traversale + fondations E2E)

- **Migration `10_fk_expense_ondelete`** — 3 FK Expense (`delegationId`, `siteId`, `bearerId`) reçoivent `onDelete:` explicite (RESTRICT pour les NOT NULL, SetNull no-op DB pour `siteId` nullable). Cohérent avec migration 8 (S5 PR2).
- **Résolution Known Issue SSR/CSR cookies E2E** (Option A retenue par utilisateur) : [`frontend/e2e/fixtures/auth.fixture.ts`](frontend/e2e/fixtures/auth.fixture.ts) `Promise.all([waitForResponse, click])` garantit que le listener du POST /api/auth/login est armé AVANT le submit. + [`frontend/middleware.ts`](frontend/src/middleware.ts) fallback CSR si `referer=/login` (laisse passer la 1ʳᵉ navigation, Zustand `auth-store.checkSession()` valide côté client).
- **DB e2e isolée `xch_e2e`** — service `postgres-e2e` (port 5433) dans [`docker-compose.e2e.yml`](docker-compose.e2e.yml) + workflow [`e2e-tests.yml`](.github/workflows/e2e-tests.yml) renommé `xch_dev` → `xch_e2e`. Plus de pollution dev local.
- **Endpoints reset scoped par domaine** — `POST /api/seed/reset/:domain` (sites/assets/racks/expenses/monitors/notifications). Garde `TestEnvOnlyGuard` (refus si `NODE_ENV=production`). Permet aux specs E2E d'isoler leur domaine sans reset global.
- **Codemod `react/no-unescaped-entities`** — script Python conservé [`frontend/scripts/codemod-unescaped-entities.py`](frontend/scripts/codemod-unescaped-entities.py) avec fallback UTF-16 ESLint vs codepoint Python (emoji 💡 surrogate pair). 163 erreurs → **0**.
- **Lockfile régénéré** — `frontend/package-lock.json` (manquant depuis commit `0cc9211` antique). 569 packages résolus, restauration `npm ci` + cache deps dans tous les workflows.
- **Workflow baseline non-régression** — [`frontend-checks.yml`](.github/workflows/frontend-checks.yml) compare compteurs courants vs [`baselines/frontend-checks.json`](.github/baselines/frontend-checks.json) versionné. Fail explicite si régression OU CAPTURE INVALIDE (4 cas : stable / amélioration / régression / capture invalide). Validé par test négatif (run 25249322588 fail attendu, retour vert run 25249527769).
- **Lint custom ESLint useQuery isError** — règle `no-restricted-syntax` qui flag `ObjectPattern` destructurant `isLoading` SANS `isError` ni `error` (pattern S6 PR4). Mode warn baseline 38 warnings / 32 fichiers legacy acceptés.

### Added (PR1 — auth + délégation foundations)

- **Split `rbac.spec.ts`** monolithique (27 tests) en **4 fichiers par rôle** : `rbac-{viewer,tech,manager,admin}.spec.ts`. Review par scope, exécution ciblée (`npx playwright test rbac/rbac-viewer`).
- **`delegation.fixture.ts`** — helpers `setActiveDelegation(context, id)` (via `addInitScript` localStorage), `switchActiveDelegationViaUI(page, code)`, `getDelegationIdByCode(page, code)`. Test fixture étend `authTest`.
- **`auth/oidc-simulated.spec.ts`** (1 actif + 4 skip TODO mock OIDC backend).
- **`auth/delegation-switch.spec.ts`** (2 actifs + 4 skip TODO sélecteurs UI badge délégation).

### Added (PR2 — CRUD entités sites/assets/racks)

- **`helpers/konva.ts`** — interactions Konva canvas via boundingBox + relX/relY (pas de coords pixel figées). Helpers : `getKonvaCanvas`, `clickKonvaAt`, `dragKonvaFromTo`, `uPositionToRelY`. Réutilisé en PR4.
- **`sites/sites-create-wizard.spec.ts`** (5 actifs + 1 skip) — wizard 2-step réel (vs "3-step" du brief original — découverte plan v2 à mettre à jour).
- **`sites/sites-edit-wizard.spec.ts`** (5 actifs + 2 skip) — édition 2-step + deeplink `?step=2`.
- **`sites/sites-sections.spec.ts`** : +2 tests délégation scope filter (header `X-Delegation-Id` vérifié sur `GET /api/sites`).
- **`assets/assets-edit-network.spec.ts`** (2 actifs + 3 skip) — validation S/N + WiFi/MAC/multi-tag.
- **`racks/racks-mount-konva.spec.ts`** (4 actifs + 3 skip) — Konva basics + canvas interactions.

### Added (PR3 — flows métier expenses/budgets/monitor)

- **`expenses/expenses-create.spec.ts`** (3 actifs + 4 skip) — création + bearer + validation montant + pièce jointe.
- **`expenses/budgets-threshold.spec.ts`** (3 actifs + 4 skip) — seuils 80% (`BUDGET_WARNING`) + 100% (`BUDGET_EXCEEDED`) + reset mensuel.
- **`monitor/probes-icmp.spec.ts`** (2 actifs + 4 skip) — lifecycle PENDING → SUCCESS via `run-now`.
- **`monitor/probes-http-tcp.spec.ts`** (1 actif + 6 skip) — HTTP status code + content match + TCP port + failure threshold + auto-disabled.

### Added (PR4 — UI complexes + smoke régression bloquante)

- **`smoke/full-user-journey.spec.ts`** — **10 tests actifs en mode `test.describe.serial`** + tag `@smoke`. Login → dashboard → 7 sections (sites/assets/racks/tasks/costs/monitoring/notifications) → API `/api/auth/me`. **Régression bloquante automatique sur toutes futures PR** (filet de sécurité).
- **`racks/racks-mount-konva-advanced.spec.ts`** (1 actif + 5 skip) — multi-mount stack + resize 1U → 4U + rotation + export PNG + drag&drop position U.
- **`tasks/tasks-kanban-rollback.spec.ts`** (1 actif + 4 skip) — validation S6 PR4 : `page.route()` mock backend 500 → optimistic rollback.
- **`qr/qr-generate-scan.spec.ts`** (2 actifs + 3 skip) — generate + scan webcam mock (helper getUserMedia ~2h différé).
- **`notifications/notifications-inbox.spec.ts`** (3 actifs + 4 skip) — cloche + page + endpoint `count-unread`.
- **`notifications/notifications-polling.spec.ts`** (1 actif + 4 skip) — polling check + de-dup + SSE fallback.

### Removed (PR4)

- **`common/status-badges.spec.ts`** (12 tests low value, pure styling).

### Changed

- **CHANGELOG, PROJECT_STATUS, ADR-007** mis à jour (cf PR5).
- **Backend + frontend** version bumps `1.8.2` → `1.9.0` (cohérence S6 gravée).

### Notes patterns gravés (mémoire MCP)

- **`XCH_AUTONOMOUS_MERGE_PATTERN_S7`** — 4 règles merge autonome validées par 4 PRs consécutives sans casse (CI vert + baseline stable + pas de dette + pas modif schéma/ADR/architecture). Ping obligatoire avant tag release.
- **`XCH_CI_SCRIPT_DEFENSIVE_PATTERNS`** — 4 règles capture/validation/fail explicite/test négatif. Bug évité : `grep -c PATTERN file || echo 0` corrompait `$GITHUB_OUTPUT` silencieusement quand compteur = 0 (cas amélioration spontanée). Détecté avant merge via observation logs réels — le check baseline serait passé "vert" avec compteurs vides.
- **`XCH_LOCKFILE_DRIFT_PATTERN`** — 2 incidents en 2 sessions (S5 PR0 backend + S7 PR0 frontend). Proposer check CI bloquant `lockfile-integrity.yml` en S9.
- **`XCH_E2E_SKIP_TODO_TRACKING`** — registre 57 skip TODO catégorisés (sélecteurs UI à confirmer / mock OIDC / Konva drag&drop / webcam mock / Kanban rollback mock / polling env override / floorplans pré-existants). Évite que les skip oubliés deviennent dette opaque.

### Métriques

- **~210 tests Playwright** (vs 152 à l'ouverture S7 et 57 documenté obsolète) répartis sur 19 fichiers spec actifs.
- **57 skip TODO** tracés exhaustivement dans `XCH_E2E_SKIP_TODO_TRACKING`.
- **Baseline non-régression frontend** stable 5/5 sur les 5 PRs (60 typecheck err / 16 fichiers / 0 lint err / 38 useQuery warnings / 32 fichiers).
- **0 régression** introduite, **0 conflit non trivial** au rebase (stratégie d'évitement parallèle PR0/PR1 validée).

---

## [1.8.2] - 2026-05-01 — UX dark canvas + erreurs réseau + tap targets (Session 6 du plan v2 finalization)

Cible utilisateur explicite : **laptop / iPad / tablette** (validée 2026-04-26 dans `XCH_TARGET_DEVICES`). Pas mobile-first téléphone. Tous les changements sont frontend, aucun changement backend (le bump version backend est cosmétique pour aligner le tag git sur l'état projet, pas un release backend séparé).

### Added (fondations erreurs réseau — PR1)

- **`ApiError.kind`** discriminator (`'http' | 'timeout' | 'network' | 'aborted' | 'unknown'`) sur [`frontend/src/lib/api-client.ts`](frontend/src/lib/api-client.ts). Backwards-compatible : `status`+`message` existants conservés, `kind` défaut `'http'`.
- **`AbortController` timeout** 30s sur `fetch()`, 120s sur `upload()`. `AbortError` → `kind:'timeout'`, `TypeError` (fetch network failure) → `kind:'network'`.
- **`mapApiErrorToFr(err)`** ([`frontend/src/lib/error-messages.ts`](frontend/src/lib/error-messages.ts)) — central FR helper. Trust server-provided messages (NestJS validation déjà FR), fallback sur HTTP code mapping (400/401/403/404/413/429/5xx), réécriture timeout/network en copy actionnable.
- **`useOnlineStatus()`** ([`frontend/src/hooks/useOnlineStatus.ts`](frontend/src/hooks/useOnlineStatus.ts)) wrap `navigator.onLine` avec **debounce 1s intégré dans le hook** pour absorber les flaps réseau de chantier sans spammer les consumers.
- **`<ErrorState>`** ([`frontend/src/components/ui/error-state.tsx`](frontend/src/components/ui/error-state.tsx)) — modèle `<EmptyState>`, props `{title, description, error, onRetry, variant}`. Lit `mapApiErrorToFr` si `error` fourni.
- **`<OfflineBanner>`** ([`frontend/src/components/layout/OfflineBanner.tsx`](frontend/src/components/layout/OfflineBanner.tsx)) sticky top dans `dashboard/layout.tsx`.
- **`app/error.tsx` + `app/dashboard/error.tsx`** — Next.js segment boundaries avec fallback FR.
- **TanStack Query retry strategy** kind-aware sur [`frontend/src/app/providers.tsx`](frontend/src/app/providers.tsx) : 5xx → 2 retries backoff exp 8s cap, network down → 1 retry, 4xx / timeout / aborted → no retry.

### Added (fondations dark canvas — PR2 + PR2b)

- **`useThemeColors()`** ([`frontend/src/hooks/useThemeColors.ts`](frontend/src/hooks/useThemeColors.ts)) — résout les CSS vars HSL shadcn (`--card`, `--muted`, `--border`, etc.) en hex pour Konva/Leaflet vanilla. Expose `theme: 'light' | 'dark'` pour `key={theme}` re-mount Konva sur switch.
- **`RackVisualization`** Konva — Stage frame, U slots, texte adaptés via tokens. Stage `key={colors.theme}` re-mount au switch.
- **`SitesMap`** Leaflet vanilla — tile layer dynamique : OSM en light, **CartoDB Dark Matter** en dark, swap via `useEffect` dépendant de `resolvedTheme`. Markers + popups + viewport persistent.
- **CSP `img-src`** (PR2b) — ajout de `https://*.basemaps.cartocdn.com` à la directive `img-src` dans [`frontend/next.config.mjs`](frontend/next.config.mjs). Sans ce patch, les tuiles dark étaient bloquées par CSP (bug observé en smoke prod, corrigé avant tag).

### Fixed (dark mode patches résiduels — PR3)

- `dashboard/page.tsx` : SitesMap loader/empty `bg-gray-50` → `bg-muted` (token thème-aware).
- `assets/[id]/page.tsx` QR container : `bg-white` conservé (scan caméra) + `dark:ring-1 dark:ring-border` pour démarquage en dark.
- `settings/page.tsx` logo preview : même pattern QR (white kept + ring dark).
- `settings/page.tsx` 3 swatches theme picker (Clair/Sombre/Système) : hardcodés conservés intentionnellement (preview du thème nommé) + commentaire `// intentional` pour le prochain reviewer.
- `sites/new/page.tsx` + `sites/[id]/edit/page.tsx` wizard step indicator (3-step + 6-step) : migration complète vers tokens semantic (`bg-card / border-border / text-muted-foreground / bg-border`) avec `dark:ring-blue-900` + `dark:text-blue-400` sur active state.

### Fixed (bugs critiques erreurs réseau — PR4)

- **`dashboard/notifications/page.tsx`** : était `useState`+`useEffect` avec `catch{ setItems([]) }` silent qui affichait "Aucune notification" même quand `/api/notifications/inbox` 500'd. Refactorisé `useQuery` + `<ErrorState>`. `markRead` / `markAll` / `remove` migrés en `useMutation` avec `onError → showToast.error(mapApiErrorToFr)`.
- **`NotificationInbox.tsx`** poll 2 min : émettait silence sur chaque erreur. Maintenant émet toast FR **une fois par outage** (`networkErrorActiveRef` de-dup), puis "Connexion rétablie" au refresh suivant. `useOnlineStatus` consommé pour refresh immédiat sur événement online OS (au lieu d'attendre la prochaine tick 2 min).
- **`tasks/page.tsx`** Kanban `updateStatusMutation` : était fire-and-forget invalidate-on-success. Ajouté `onMutate` optimistic patch sur **toutes les queries cached** (page/filter combos), `onError` rollback complet + toast FR, `onSettled` invalidate. La carte bouge immédiatement au drop et snap back si serveur 500.
- **`Attachments.tsx`** upload + delete `onError` : "Erreur lors de l'upload du fichier" générique → `mapApiErrorToFr(err)` qui distingue 413 ("Fichier trop volumineux"), timeout, network, messages serveur.
- **`consumption/page.tsx`** : `useState`+`useEffect` avec `.catch(setData(null))` silent → `useQuery` + `<ErrorState>`.

### Added (rollout `isError` pattern — PR4 top 10 pages)

Pattern `if (isError) return <ErrorState error={error} onRetry={refetch} />` ajouté juste après le `if (isLoading)` existant sur :

| Page | Note |
|---|---|
| `dashboard/page.tsx` | 4 useQuery agrégées (`sitesIsError \|\| ...`) + `refetchAll` |
| `sites/page.tsx` | sites principal query |
| `assets/page.tsx` | assets principal query (paginated) |
| `tasks/page.tsx` | tasks principal query (en plus du Kanban mutation rollback) |
| `racks/page.tsx` | racks principal query |
| `floor-plans/page.tsx` | plans principal query |
| `costs/page.tsx` | expenses principal query |
| `consumption/page.tsx` | refactor profond (cf. ci-dessus) |
| `notifications/page.tsx` | refactor profond (cf. ci-dessus) |
| `monitoring/page.tsx` | wrapper `<NativeMonitorsList/>` ; isError hors scope du wrapper |

### Changed (tap targets pour iPad/tablette — PR5)

Stratégie : **pas de bump des sizes par défaut** des primitives shadcn (sinon shift layouts desktop). Override hit-area via `@media (pointer: coarse)` dans [`frontend/src/app/globals.css`](frontend/src/app/globals.css). Laptop+souris (`pointer: fine`) → aucun changement visuel. Tablette / iPad / Surface en mode tactile (`pointer: coarse`) → 44pt+ effectif. Distinction Type A (override conditionnel, pixel-identique souris) vs Type B (bump direct assumé) gravée dans `XCH_UX_PRIMITIVE_CHANGE_TAXONOMY` pour réutilisation future.

**Type A (override conditionnel @media coarse, pixel-identique souris)** :
- `globals.css` bloc `@media (pointer: coarse)` : `min-height: 44px` sur button/role=button/role=tab/role=menuitem ; `min-height + min-width: 44px` sur `button[data-size="icon|sm"]` ; pseudo-element `::before inset: -14px` sur checkbox/switch pour étendre hit-area sans changer le visuel.
- `button.tsx` ajoute `data-size={size ?? 'default'}` pour cibler en CSS sans toucher cva.
- `FloorPlanViewer.tsx` Konva pins : `<Rect>` 44×44 transparent au début de chaque `<Group>` pour étendre la hit-area sans changer la pin visuelle.

**Type B (bump direct assumé, dette visuelle acceptée même en souris)** :
- `pagination.tsx` SelectTrigger + 4 nav icon buttons `h-8 → h-9`.
- `tabs.tsx` TabsList `h-10 → h-11`, TabsTrigger `py-1.5 → py-2`.
- `NotificationInbox.tsx` bell button `w-9 h-9 → w-10 h-10`.
- `FloorPlanViewer.tsx` 3 zoom buttons `w-9 h-9 → w-10 h-10`.
- `RackVisualization.tsx` `UNIT_HEIGHT 30 → 36`.

### Verification (smoke prod xch.eoncom.io)

- ✅ Carte Sites dark → CartoDB Dark Matter (bug CSP corrigé par PR2b)
- ✅ RackVisualization Konva dark theme-aware
- ✅ Wizard sites/new step indicator dark
- ✅ Assets QR ring dark (white preserved + dark:ring border)
- ✅ Theme picker swatches Apparence intentional hardcodé respecté
- ✅ Tabs Settings 12 onglets sans overflow (Type B alignement propre)
- ✅ Tap targets : `pointer: coarse = false` souris ; règle CSS `@media (pointer: coarse)` chargée mais inactive ; data-size attribute injecté → **promesse Type A tenue**
- ✅ ErrorState observé en vrai (dashboard "Invalid delegation" déclenche `<ErrorState>` propre + bouton Réessayer)
- ⚠️ Tests iPad-spécifiques (NotificationInbox de-dup airplane mode 2s, Kanban optimistic backend-down, vrai tap pointer-coarse) à valider sur device réel — non couverts via Chrome MCP

### Hors-scope explicite (à traiter Sessions futures)

- **~70 pages encore en pattern legacy `isLoading + data` sans `isError`** — top 10 critiques migrées dans PR4. Le reste est dette résiduelle. **Idée Session 7+** : lint custom ESLint qui vérifie que tout consommateur de `useQuery` extrait `isError` (pas juste `isLoading + data`). Force tout nouveau code à respecter le pattern et met une pression progressive sur l'héritage. Pattern équivalent au lint custom ts-morph noté pour `findOne` en Session 5.
- **Check CI frontend (typecheck + lint)** — actuellement le required check `Backend integration` passe trivialement sur tout PR frontend pur. À ajouter Session 7 pour catch les régressions TS/Tailwind avant merge.
- **WiFi heatmap physique-aware** — `WifiHeatmapLayer` actuel est générique, ne consomme pas les caractéristiques modèle équipement (standard WiFi, fréquences, MIMO, gain). Session indépendante dédiée notée dans MCP `XCH_WIFI_HEATMAP_PHYSICS_AWARE` (Log-Distance Path Loss, multi-bandes, hors-scope obstacles manuels / vision algorithmique / interférences). À déclencher quand la masse critique de catalogue est saisie.
- **Konva pins floor-plan radius bumped à 14 + hitStrokeWidth 20** : déféré de PR2 à PR5, finalement fait via Rect 44×44 invisible plus simple. Le bump radius pin natif reste hors scope.

### Infra (PR2b — patch CSP appliqué avant tag)

- `next.config.mjs` `img-src` whitelist élargie à `https://*.basemaps.cartocdn.com` pour autoriser les tuiles CartoDB Dark Matter. Comment-catalogue ajouté indiquant le rôle de chaque provider (OSM / CartoDB / unpkg / raw.githubusercontent) pour le prochain reviewer.

---

## [1.8.1] - 2026-05-01 — Performance & intégrité DB + UX deep-link 404 résiduelle (Session 5 du plan v2 finalization)

### Fixed (UX 404 deep-link résiduelle — PR1)

Clôture du chantier amorcé en S4/PR6 (4 pages alignées : sites/[id], assets/[id], tasks/[id], floor-plans/[id]). Les 2 pages restantes documentées comme tech debt mineure sont alignées sur le même pattern :

- **`/dashboard/monitoring/[id]`** : retry désactivé sur 403/404 (le scope ne change pas en cours de session) + garde inline « Sonde introuvable ou inaccessible » + bouton « Retour à la liste ».
- **`/dashboard/consumption/[siteId]`** : migration du pattern legacy `useState/useEffect` vers `useQuery` + retry + garde inline.

### Added (intégrité DB — PR2 + PR3)

**Migration `8_fk_ondelete_and_checks` :**
- 5 FK Restrict harmonisation : `assets.delegationId`, `billing_entities.delegationId/siteId`, `budgets.delegationId/siteId` passent de `SET NULL` (default Prisma 5 silencieux) à `RESTRICT`. Forcer le réassignement explicite avant suppression d'une délégation/site, plus de NULL silencieux qui orpheline assets/CdC/budgets.
- 3 schema.prisma `onDelete: SetNull` explicites (no-op DB) sur `Asset.assetModelId`, `Contact.delegationId/siteId` pour empêcher tout drift schema/db futur.
- 3 CHECK constraints SQL : `racks.heightU > 0`, `assets.dutyCyclePercent BETWEEN 0 AND 100`, `assets.rackPositionU > 0` si non NULL.

**Migration `9_perf_indexes` :**
- `tasks(tenantId, status, dueDate)` — Kanban dashboard hot path.
- `expenses(tenantId, delegationId, dateIncurred DESC)` — budget threshold + filtres récents par délégation.
- Documentation EXPLAIN ANALYZE avant/après dans [`docs/perf/SESSION-05-explain-analyze.md`](docs/perf/SESSION-05-explain-analyze.md) — capturé sur xch-deploy avec rationale "à volume réel attendu" pour traçabilité 6-12 mois.

### Changed (performance — PR4)

**Monitor history : pagination keyset (BREAKING interne API)**
- `GET /api/monitors/:id/history` : `offset` retiré, `cursor` ajouté (input). `total` retiré du retour, `nextCursor` + `hasNext` ajoutés (output).
- Frontend XCH unique consommateur documenté → pas de bump major nécessaire.
- Avant : `findMany skip:offset + count` séparés, scan inutile à page profonde, count = full scan. Après : 1 query Index Range Scan sur `(checkId, checkedAt DESC)`, O(limit) peu importe la profondeur.
- `monitoring/[id]/page.tsx` adapté (pile `cursorStack` pour Précédent/Suivant sans recalcul).

**Budget threshold : N+1 → 1 batch findMany**
- `checkThresholdsForExpense` (hook post-create/update expense) faisait 3-4 queries DB par budget candidat (`getStatus(b.id)` redondant). 50 candidats = 150-200 queries.
- Maintenant : 1 `expense.findMany` global qui couvre la fenêtre + critères de tous les candidats, puis filter+compute en mémoire via `computeCdcSpentSync` / `computeDelegationSpentSync` (math identique aux versions async).

### Tests

- 10 nouveaux unit tests avec assertions quantitatives **EXACTES** sur le nombre de queries Prisma — pas `< N`, le chiffre exact garantit que le refactor délivre le gain perf attendu (un refactor qui passerait fonctionnellement mais ferait toujours N queries doit faire échouer ces tests).
- Backend : 141 tests verts (13 suites), aucune régression.

### Hors-scope explicite (Session 5b future)

- 3 FK `Expense` (`delegationId`, `siteId`, `bearerId`) sans `onDelete:` explicite découvertes pendant l'audit — pas incluses pour ne pas étendre le scope d'un PR approuvé.
- 3 refactors lourds extraits volontairement : expenses projection en SQL `GENERATE_SERIES`, audit `enrichWithEntityLabels` DataLoader, expenses `reportByBearer/Target` group-by SQL.
- R3 du plan initial (Consumption double-iter) drop : audit Phase 1 incorrect, le code itère déjà chaque asset une seule fois.

### Infra (PR0 hotfix)

- `backend/package-lock.json` resync avec `package.json` (l'ancien lockfile était figé à xch-backend@1.0.0).
- `workspaces` retiré du root `package.json` (déclaration non utilisée — tous les scripts root et CI workflows utilisent `cd backend|frontend && npm ci`). `package-lock.json` racine orphelin supprimé.
- `intrusion.ts` test helper adapté à `@types/supertest@6.0.3` (`SuperTest<Test>` → `TestAgent<Test>`).
- Jest `transformIgnorePatterns` whitelist `@scure/*` + `@noble/*` (ESM-only, transitive de `otplib` via plugins crypto-noble + base32-scure).

---

## [1.8.0] - 2026-04-30 — RBAC universel + tests d'intrusion bloquants en CI (Session 4 du plan v2 finalization)

### Security (BREAKING — shape d'erreur HTTP)

**ADR-021 — RBAC universel : data filtering systématique au niveau service.**

L'audit Phase 1 a montré que sur 15 modules backend, un seul (`users`)
filtrait correctement par scope au niveau service. 14 modules avaient
soit aucun scope automatique (contacts/connectivity), soit un trou
sur `findOne(id)` (sites/assets/racks/tasks/floor-plans/monitoring/
expenses/budgets/billing-entities), soit une API atypique avec
cross-skew (notification-settings) ou pas de validation de scope
(sdwan/consumption). Cette session ferme tous ces trous via un
pattern unifié.

#### Pattern unifié (ADR-021)

- **`CallerCtx + DI PermissionService`** dans tous les services au lieu
  du pattern `accessibleSiteIds[]` pré-résolu au controller (à l'origine
  du bug Contact 4 ans).
- Helpers canoniques : `getReadableSiteIds`, `getReadableDelegationIds`
  (READ+WRITE+MANAGE union), `getManagedDelegationIds` (MANAGE-only,
  cost module), `assertCanReadSite/Delegation` (404), `assertCanWriteSite/Delegation` (403).
- **Shape d'erreur HTTP** : 404 sur read non autorisé (defense in depth,
  ne révèle pas l'existence), 403 sur write non autorisé, 403 sur
  cross-skew header≠body. **BREAKING** : un GET cross-delegation passe
  de "200 + leak" à "404".
- **`SYSTEM_CTX(reason, tenantId)` factory traçable** : chaque appel
  log INFO via canal `AuditSystemCtx`. Bypass paresseux devient bypass
  auditable. Grep `SYSTEM_CTX(` au merge = liste exhaustive.

#### Modules fixés

- **contacts + connectivity** (PR3) : modules sans aucun scope auto
  fermés. Régression utilisateur Contact (technicien voit toutes les
  délégations) confirmée fermée en smoke prod.
- **notification-settings + sdwan + consumption** (PR4) :
  - notif : `enforceDelegationConsistency(req, paramOrDtoDelegationId)`
    refuse cross-skew header X-Delegation-Id vs body delegationId.
  - sdwan : `ensureSiteForRead/Write` avec `assertCanRead/WriteSite`.
  - consumption : `computeSite/computeRack/summary` scopés par
    `assertCanReadSite` et `getReadableSiteIds`.
- **sites + assets + racks + tasks + floor-plans + monitoring +
  expenses + budgets + billing-entities** (PR5) : findOne universel
  avec assert au niveau service. Spec paramétrique `find-one-cross-delegation.spec.ts`
  itère 9 modules × 3 attaques.

#### Audit schéma actif des champs scope-nullable

ADR-021 §6 contient l'audit complet (4 catégories) :
- **A. Global lisible (allowGlobal=true)** : Contact, Expense,
  TenantSecurityReminder.
- **B. Super-admin only** : NotificationChannel, NotificationRule.
- **C. À confirmer (alignée Expense)** : Budget.
- **D. Pas un scope autz** : AuditLog, Photo, MonitorCheck (polymorphique),
  AssetMovement, CostAllocation, NotificationLog.

### Added

- **Workflow CI bloquant** `backend-integration.yml` : services Postgres
  15 + Redis, Jest+supertest, branch protection main exigeant ce check.
- **6 specs intrusion** : foundations (canary helpers, 17 tests),
  contacts-cross-delegation (15 attaques), connectivity-cross-site
  (8 attaques), notification-settings-cross-skew (6 attaques),
  sdwan-cross-delegation (6 attaques), consumption-cross-delegation
  (5 attaques), find-one-cross-delegation (27 attaques paramétriques
  sur 9 modules). **~85 attaques au total**, bloquantes en CI.
- **`backend/test/integration/fixtures/rbac-seed.ts`** : seed
  déterministe (1 tenant, 2 délégations A/B, 5 users, 1 row par module
  par délégation = 16 rows). Réutilisable par toutes les futures specs.
- **`@CallerCtxParam()` decorator** + interface `CallerCtx` + factory
  `SYSTEM_CTX(reason, tenantId)`.

### Frontend (UX 404 deep-link)

R7 du plan : 4 pages détail audit ❌ patchées en gestion d'erreur 404 :
- `dashboard/sites/[id]/page.tsx` : message clair + bouton retour liste.
- `dashboard/assets/[id]/page.tsx` : idem.
- `dashboard/tasks/[id]/page.tsx` : idem.
- `dashboard/floor-plans/[id]/page.tsx` : idem.

React Query `retry` désactivé pour 403/404 (pas la peine de retry —
le scope ne change pas en cours de session).

Pages ⚠️ restantes (`monitoring/[id]`, `consumption/[siteId]`) : tech
debt UX mineure documentée pour Session 5 ou 6.

### Documentation

- ADR-021 rédigée (8 sections : status / context / decision /
  consequences / alternatives / forward deps / annexe table 15 modules /
  audit schéma scope-nullable).
- Pattern technique de référence dans le plan utilisateur.
- README + CHANGELOG + 00-INDEX + PROJECT_STATUS à jour.

### Hors scope (Session 5+)

- Postgres RLS comme défense en profondeur DB.
- Lint custom ts-morph qui détecte tout `findOne` sur entité
  tenant-scopée sans paramètre `CallerCtx`.
- UX deep-link 404 pour les 2 pages ⚠️ restantes.
- Indexes / FK CHECK / query plans (Session 5).

---

## [1.7.1] - 2026-04-29 — Hardening intégrité @@unique avec champ nullable (ADR-020 §C)

### Fixed (DB integrity)
- **Trou d'intégrité comblé** : `notification_channels @@unique([tenantId, delegationId, kind])` et `notification_rules @@unique([tenantId, delegationId, eventType])` ne protégeaient PAS la row globale (`delegationId IS NULL`) — PostgreSQL traite `NULL ≠ NULL` par défaut dans les contraintes UNIQUE. Conséquence possible : 2 rows globales du même `(tenantId, kind)` coexistant, résolution d'inheritance non déterministe.
- Migration `7_notif_unique_nulls_not_distinct` : ajoute 2 partial UNIQUE INDEX (`notification_channels_global_uniq` + `notification_rules_global_uniq`) ciblant les rows globales (`WHERE delegationId IS NULL`), en complément des `@@unique` Prisma existants qui couvrent les rows non-globales.

### Documentation
- ADR-020 §C addendum : audit complet du schéma (seules 2 tables concernées sur 14 `@@unique`), alternatives écartées documentées (sentinel value, 2 tables séparées, `nulls: "not distinct"` Prisma — testé en pratique : non supporté Prisma 5.22). Règle architecturale gravée :
  > Tout `@@unique` Prisma qui inclut un champ nullable DOIT être complété par un partial UNIQUE INDEX SQL ciblant les rows où le champ est NULL.

### Note
Le `findFirst + update/create` du `NotificationSettingsService` reste — il contourne un bug TS Prisma (compound unique avec champ nullable génère `delegationId: string` non-nullable côté TS) indépendant de la garantie DB. Documenté en commentaire (ADR-020 §C).

---

## [1.7.0] - 2026-04-29 — NotificationConfig refacto + Worker BullMQ (Session 3 du plan v2 finalization)

### Changed (BREAKING — API + DB)
- **ADR-020 — `NotificationConfig` (1 table, 2 colonnes JSON) → split en 2 tables typées** :
  - `NotificationChannel` (kind, enabled, recipients[], webhookUrl scalaire chiffré, config JSON non-sensible).
  - `NotificationRule` (eventType, channels[] enum, enabled).
  - Migration `6_notifications_split` : INSERT depuis JSON puis DROP `notification_configs`.
  - 2 nouveaux enums Prisma : `NotificationChannelKind` (EMAIL, TEAMS), `NotificationEventType` (8 valeurs).
- **Inheritance simplifiée** : plus de flag `inherit:true` JSON. Convention : delegation row override > global row > defaults `NOTIFICATION_EVENTS_META`.
- **API contract breaking** :
  - `GET /api/notifications/config?delegationId=…` → `{ scope, channels[], rules[], isDefault }`.
  - `PUT /api/notifications/config` → reçoit la même shape, transaction upsert.
  - DTO : `SaveNotificationSettingsDto` + `SaveSettingsChannelDto` + `SaveSettingsRuleDto` typés enums.
  - `POST /api/notifications/test` reçoit `{ kind, recipients?, webhookUrl? }`.
- **Frontend** : `NotificationsConfigPanel.tsx` + `lib/api/notifications.ts` adaptés au nouveau shape. Plus d'option « Hériter par-event/par-channel » — un override existe (row) ou il n'existe pas. Le bouton « Réinitialiser (hériter) » fait DELETE de tous les rows au scope courant.

### Added (worker async)
- **Queue BullMQ `notifications`** + `NotificationProcessor` (consume `notification-dispatch` jobs).
  - Retry 3× backoff exponentiel (1s, 5s, 30s).
  - `removeOnComplete: { age: 3600, count: 1000 }` / `removeOnFail: { age: 86400 }`.
  - Logs persistés par le processor dans `NotificationLog` (source de vérité unique).
- **`NotificationService.queueDispatch()`** : remplace `dispatch()`. Push instantané sur Redis (~ms), retour avant l'envoi effectif. Les 5 callers (tasks/assets/sites/monitoring/auth — via `NotificationEmitter` + `MonitorProcessor` direct) utilisent désormais cette voie.
- **`NotificationSettingsService`** : nouveau service CRUD + `resolveSettings()` (delegation > global > defaults).

### Security
- **`teams.webhookUrl` chiffré at-rest** comme colonne scalaire (`CryptoService.encryptIfPlain` au write, `decryptOrLegacy` au read), ADR-019 pattern. Le walker JSON sub-field (`encryptSubfields` / `decryptSubfields` / `ENCRYPTED_CHANNEL_PATHS`) est **retiré** du `CryptoService` et de ses tests — règle architecturale unique post-ADR-020 : `config_json` ne contient jamais de secret, tout secret en colonne scalaire chiffrée.

### Removed
- `notification-config.service.ts` (legacy NotificationConfigService).
- `getDefaultConfig`, `NotificationChannelsConfig`, `NotificationEventsConfig`, `ChannelConfig`, `EventConfig` (interfaces JSON-shape de l'ancien modèle).
- `CryptoService.encryptSubfields` / `decryptSubfields` (pattern walker abandonné).

### Documentation
- ADR-020 rédigée (avec règle architecturale `config_json` non-sensible).
- ADR-019 référencée comme "pattern parent" pour le chiffrement scalaire.

---

## [1.6.2] - 2026-04-29 — Chiffrement secrets at-rest (Session 2 du plan v2 finalization)

### Security / Added
- **ADR-019 — AES-256-GCM at-rest pour 4 colonnes sensibles** :
  - `TenantSsoConfig.clientSecret` (OIDC client secret)
  - `TenantIntegrationConfig.netboxToken` (API token NetBox)
  - `User.totpSecret` (clé TOTP 2FA — bypass 2FA évité en cas de fuite DB)
  - `NotificationConfig.channels.teams.webhookUrl` (sub-field JSON)
- **`XCH_MASTER_KEY`** env var (32 bytes base64) — chargée au boot,
  fail-soft si absente (encrypt/decrypt no-op + warn, le boot ne crashe pas).
- Format envelope `v1:<iv-b64>:<authTag-b64>:<ct-b64>` versionné. Rotation
  supportée via `XCH_MASTER_KEY_V<n>` pour les anciennes versions.
- `CryptoService` (Nest, @Global) avec `encrypt`, `decrypt`,
  `encryptIfPlain` (idempotent), `decryptOrLegacy` (transitoire),
  `encryptSubfields` / `decryptSubfields` (walker JSON pour la cible 4).
- 22 tests Jest (round-trip, tampering rejected, key mismatch, fail-soft,
  walker idempotence, no-mutation).
- Phase C ajoutée à `scripts/rotate-secrets.sh` pour générer XCH_MASTER_KEY.

### Security / Changed
- **`User.inviteToken` + `User.resetToken`** ne sont plus stockés en clair —
  hash SHA-256 (lookup par hash). Le clear-text part toujours par email.
  Bonus groupé avec ADR-019 (même esprit colonne sensible, surface limitée).

### Documentation
- ADR-019 rédigée (chiffrement secrets at-rest).
- ADR-018 : note de suivi mise à jour (`clientSecret encrypted-at-rest LIVRÉ par ADR-019`).
- README + docs/00-INDEX : ADR-019 ajoutée au sommaire.
- INSTALL_PROD : section XCH_MASTER_KEY (génération + warning sur la perte).

### Forward dependency
- **Session 3** (NotificationConfig refacto, ADR-020) devra continuer à
  chiffrer les credentials de channels après le split structurel — la
  liste `ENCRYPTED_CHANNEL_PATHS` à graver dans la nouvelle structure.

### Hors scope (par décision)
- KMS externe (Vault, AWS/GCP/Azure KMS) : phase pilote, repoussé v2.0+.
- `passwordHash` reste en bcrypt (déjà sécurisé).
- `qrCodeToken` reste en clair (token éphémère, hors périmètre).

---

## [1.6.1] - 2026-04-29 — Quick wins post-v1.6 (bugs + drift doc)

### Fixed
- **Budgets — double comptage parent + enfants** : la page
  `/dashboard/costs/budgets` sommait tous les budgets pour ses cartes
  « Total budgété » et « Total dépensé », alors que par construction
  Σ(children.amount) ≤ parent.amount. Avec un parent 10k€ + 2 enfants
  3k€, la carte affichait 16k€ au lieu de 10k€. Correction : ne sommer
  que les budgets racines (`parentId === null`). Le `spent` du parent
  capture déjà les dépenses des enfants car leur scope est inclus dans
  le scope parent. Seed démo enrichi avec un 2e sous-budget
  (`Budget équipement IDF`) pour illustrer le cas test.
- **Wizard Sites — contacts non persistés** (ADR-018 cible D regression) :
  le wizard `/sites/new` et `/sites/[id]/edit` capturait les contacts
  ajoutés via le picker dans un state local mais ne les envoyait pas
  côté serveur — Site.contacts ayant été migré JSON → relation 1:N en
  ADR-018, le PATCH du site ne pouvait plus les charrier. Le wizard
  POST/PATCH/DELETE désormais via `contactsApi` après le save du site
  (create-then-attach pour `new`, diff create/update/delete pour
  `edit`). `Contact.isPrimary` ajouté au DTO + types frontend (déjà
  présent dans le schéma Prisma depuis ADR-018 D.1). Type legacy
  `SiteContact` retiré, `Site.contactsOnSite` retypé en `Contact[]`.

### Documentation
- **PROJECT_STATUS.md** — métriques re-mesurées (29 modules, 48 modèles,
  22 enums, 273 endpoints, 18 ADRs, ~31 200 lignes backend, ~52 200
  lignes frontend). Bloc « Métriques réelles » daté 2026-04-29.
- **CHANGELOG.md** — bloc `[Unreleased] — Audit phase 5` déplié
  rétroactivement en `[1.5.0]` (tag 2026-04-26) ; ajout des sections
  `[1.6.0]` (S2+S5+ADR-018) et `[1.6.1]` (cette session).
- **Plan finalization v2 (post-v1.6.0)** persisté en mémoire MCP
  (`XCH_PLAN_V2_FINALIZATION`) et dans `docs/status/PROJECT_STATUS.md` —
  7 sessions vers v1.8.0 (chiffrement secrets at-rest, NotificationConfig
  refacto + Worker BullMQ, perfs DB, hardening tail, UX dark canvas, E2E
  Playwright, Sentry optionnel).
- **Prompts archive** : `next-session-monitoring-native.md`,
  `next-session-v1.6-finalization.md` et `next-session-forms-cleanup.md`
  déplacés en `docs/prompts/archive/` (sessions livrées). Sauvegarde du
  prompt de cette session dans `docs/prompts/next-session-v1.6.1-quick-wins.md`.
- **README.md + docs/00-INDEX.md** — ADR-017 (migrations Prisma versionnées)
  et ADR-018 (refacto JSON résiduel) ajoutés au sommaire.

---

## [1.6.0] - 2026-04-28 — Refacto JSON résiduel (S6/S7) + Migrations Prisma versionnées (S5) + Monitoring natif (S2)

### S2 — Monitoring natif (ADR-014, ADR-016)
- Module `monitoring` dédié : `MonitorTarget` (cible : ConnectivityLink,
  SdwanConfig, Asset, ad-hoc) + `MonitorCheck` (résultats horodatés ICMP /
  HTTP / TCP). Suppression complète de la dépendance Uptime Kuma / Gatus.
- Probes natives planifiées via BullMQ + cron NestJS, statuts agrégés sur
  les entités cibles (statut hérité du dernier `MonitorCheck`).
- 5 endpoints `/api/monitoring/targets` + 1 endpoint `/checks/recent`.
  L'ancien webhook bidirectionnel Gatus retiré.

### S5 — Migrations Prisma versionnées (ADR-017)
- Bascule `prisma db push --accept-data-loss` → `prisma migrate deploy`
  pour la prod. `docker-entrypoint.sh` exécute désormais
  `prisma generate && prisma migrate deploy` au boot.
- Migrations `0_init` et `1_post_push_constraints` (CHECK constraints
  ex-`post-push.sql`) versionnées. `npm run db:migrate:dev` / `migrate:reset`
  documentés dans le README.
- Forward-only — pas de migration revert auto. En cas de bug, créer une
  migration corrective.

### S6/S7 — Refacto JSON résiduel (ADR-018) — 4 cibles, 11 nouvelles tables
- **Cible A — `Asset.networkInfo`** (JSON) → 4 colonnes scalaires + table
  `AssetAdminLink` (URLs admin typées).
- **Cible B — `Tenant.config`** (JSON sac-à-tout) → split intégral en 7
  tables typées : `TenantFeatureFlag`, `TenantElectricityConfig`,
  `TenantAppearance`, `TenantBranding`, `TenantSsoConfig`,
  `TenantIntegrationConfig`, `TenantWebhookConfig`. Plus aucun
  `tenant.config.xxx` dans le code.
- **Cible C — `Site.healthBreakdown`** (JSON) → table 1:0..1
  `SiteHealthSnapshot` (overall + componentsJson typé + computedAt).
- **Cible D — `Site.contacts` / `Site.metadata.serverInfo` /
  `Site.accessNotes` / `Site.metadata.healthBreakdown`** (JSON) → relation
  1:N `Contact` (avec `isPrimary` promu en colonne) + 4 colonnes scalaires
  `smbPath/sharepointUrl/gedUrl/accessRightsUrl` + table `SiteEmplacement`
  + 4 scalaires `accessSchedules/accessBadges/accessProcedures/accessSafety`.
  Le `Site.metadata` JSON résiduel est dropé.
- 5 migrations Prisma versionnées au total (`0_init` →
  `5_site_json_cleanup`). Smoke complet validé sur xch-deploy en clôture.
- 3 enums ajoutés : `SiteEmplacementType`, `SsoMode`, `IntegrationKind`.
- Snapshot v1.6.0 : 48 modèles Prisma, 22 enums, 273 endpoints, 29 modules
  NestJS, 18 ADRs.

### Breaking
- Toute donnée stockée dans `Site.metadata`, `Site.contacts`,
  `Site.healthBreakdown`, `Site.accessNotes` ou `Tenant.config` non
  re-seedée est perdue. Comme énoncé dans `XCH_DEMO_DATA_PRINCIPLE` (pas
  de prod sensible, pilote en cours), le reset+seed est l'opération de
  référence sur xch-deploy.

---

## [1.5.0] - 2026-04-26 — Audit phase 5 (correctifs AUTH_MODEL + UX Notifications) + S0/S1/S4

### S0 — Bump version + script parité repos
- Bump `1.3.0 → 1.5.0` (les versions 1.4.x correspondaient au tag v1.4.0
  plus correctifs phase 5 non-tagués).
- Script `scripts/check-repos-parity.sh` : compare XCH (dev) et XCH-deploy
  (prod) sur structure + Dockerfiles + scripts critiques.

### S1 — Sécurité hardening (ADR-015)
- **Rotation secrets** : `scripts/rotate-secrets.sh` génère et applique
  les nouveaux JWT/MinIO/webhook/Redis ; entrées MCP `secret_audit` pour
  snapshot avant/après.
- **Redis auth** : `REDIS_PASSWORD` requis ; backend + workers
  authentifiés.
- **Multer** : limites tailles + magic-bytes signature check (anti-poly).
- **Webhook secrets** : `x-webhook-secret` validé en service avant tout
  side-effect ; rate-limited.
- 80 tests Jest backend (`PermissionGuard`, `XchThrottlerGuard`,
  Consumption, Webhook…) — S4 livrée en parallèle.

### S4 — Tests Jest critical paths
- Setup Jest backend (jest.config.js + ts-jest + pas de mocks DB selon
  feedback session — vraie Postgres via testcontainers ou base de test).
- 80 tests verts couvrant les chemins critiques : authz, throttle,
  imports CSV, webhook signatures, reset password lockout.

### Audit phase 5 — Security / Fixed (P0 — élévation de privilège & endpoints cassés)
- **`notification.controller.ts`** — 8 endpoints n'avaient aucun décorateur
  `@Require*` ni `@SkipDelegation`, donc tous `403 fail-closed` pour tout
  utilisateur non super-admin. Les helpers `requireAdmin`/`requireAdminOrManager`
  /`checkDelegationAccess` testaient `localRole === 'ADMIN'` qui n'a jamais
  pu matcher (`UserDelegation.right` = MANAGE/WRITE/READ). Ajout des
  décorateurs corrects (`@RequireManage()` pour routes délégation,
  `@SkipDelegation + @RequireManage` pour l'overview tenant-wide,
  `@SkipDelegation + @RequireRead` pour `/meta`) + remplacement des 3 helpers
  morts par un `requireSuperAdminForGlobal` unique.
- **`monitoring-webhook.controller.ts`** — `POST /integrations/monitoring/webhook`
  sans `@Public()` → `JwtAuthGuard` global renvoyait `401` à chaque webhook
  Uptime Kuma / Gatus. Ajout `@Public() + @SkipDelegation()` au niveau classe ;
  la vérif `x-webhook-secret` dans le service reste autoritative.
- **`user-delegations.controller.ts`** — `POST/PATCH/DELETE` utilisaient
  `@RequireWrite()` alors que la docstring disait « Only ADMIN of the
  delegation ». Un user WRITE pouvait promouvoir quelqu'un en MANAGE ou
  retirer un MANAGE peer → élévation de privilège. Les 3 endpoints passent
  à `@RequireManage()`.

### Fixed (P1 — semantic dead-code + scope incorrect)
- **OIDC strategy** — le mapping SSO `ADMIN/MANAGER/TECHNICIEN/VIEWER` était
  placé dans les entries sous `role`, mais `syncSsoDelegations` lisait
  `d.right` → la valeur était silencieusement droppée et tous les nouveaux
  utilisateurs OIDC tombaient en READ par défaut. `normalizeRight()` traduit
  maintenant les deux conventions (legacy + MANAGE/WRITE/READ) vers
  `DelegationRight`. `SsoDelegationEntry.right` remplace `.role`, le `as any`
  cast est retiré. `DEFAULT_ROLE_MAPPING` émet directement MANAGE/WRITE/READ.
- **`PATCH /delegations/:id`** — passage de `@RequireWrite()` à
  `@RequireManage()` pour matcher AUTH_MODEL §7 onglet « Ma délégation »
  (renommer/configurer une délégation = action admin, pas éditeur).

### Fixed (bugs révélés par le déblocage notifications)
- **`GET /notifications/config/global` — 404** : le front
  (`notificationsApi.getConfig/deleteConfig`) construisait l'URL en path-based
  avec sentinel `'global'`, mais le backend n'exposait que la variante
  query-based `/config?delegationId=…`. Ajout de `GET /config/:delegationId`
  avec normalisation `'global' → null` (super-admin only via
  `requireSuperAdminForGlobal`). `GET /config/resolved` déclaré avant pour
  éviter la collision de route. Patch identique sur le DELETE existant.
- **Settings → Notifications — latence initiale sur non super-admins** :
  la page s'ouvrait toujours sur `scopeMode='GLOBAL'` et hit
  `/config/global`, renvoyé en 403 pour tout non super-admin → lag visible
  sur les onglets Canaux / Événements / Journal. Défaut maintenant
  `DELEGATION` avec la délégation active pré-sélectionnée, sélecteur
  « Niveau » masqué hors super-admin, pas de 403 réseau au mount.

### Removed (code mort / drift doc)
- **`handleLegacy()`** + lecture des metadata `@Resource`/`@Action` dans
  `PermissionGuard`. 0 controller n'utilisait les décorateurs legacy depuis
  la migration v1.3 → ~35 lignes supprimées.
- **Model Prisma `AuthProvider` + enum `AuthProviderType`** + relation
  `Tenant.authProviders`. Aucun controller ni service ne les utilisait
  — SSO passe entièrement par `Tenant.config.sso` (JSON) consommé par
  `OidcStrategy`. La table `auth_providers` (vide) est droppée par
  `prisma db push --accept-data-loss` au prochain démarrage backend.
  Les métriques passent à **32 modèles / 17 enums** (au lieu de 33 / 18).
- **`backend/src/modules/contacts/providers-legacy.controller.ts`** — shim
  backward-compat `GET /providers` / `GET /providers/:id` datant du
  rename v1.1 Providers → Contacts. `grep '/providers'` frontend = 0,
  retrait complet.
- **`auth.controller DELETE /2fa/user/:userId`** — suppression du check
  `localRole !== 'MANAGE'` vestigial (la route `@SkipDelegation + @RequireManage`
  est déjà super-admin-only via `PermissionGuard`).

### Changed (documentation)
- **`AUTH_MODEL.md`** — §4 chemins corrigés
  (`backend/src/common/guards/permission.guard.ts` au lieu de
  `modules/auth/…`) ; §7 onglets Notifications / SSO / Tenant alignés sur
  les endpoints réels (plus de `/auth-providers/*` ni
  `PATCH /tenants/current/config` fantômes) ; §9 historique v1.4.x ajouté.
- **`docs/architecture/database-schema.md`** — section « Casbin
  (Permissions) » remplacée par un pointeur vers AUTH_MODEL ; seed command
  alignée sur `SeedService` (plus de `prisma:seed` npm script).
- **`docs/00-INDEX.md`** — ADR-004 RBAC Casbin marqué ⛔ obsolète
  (superseded by ADR-009).
- **`docs/guides/DEVELOPMENT_GUIDE.md`** — bandeau « partiellement
  obsolète » ajouté en tête (le document décrit l'architecture initiale
  casbin/ + 4 rôles qui a été entièrement remplacée).
- **`docs/status/PROJECT_STATUS.md`** — métriques refondues
  (262 → 261 endpoints, 33 → 32 modèles, 18 → 17 enums).
- **`reports/phase5-audit-coherence-v1.4.md`** — rapport complet de
  l'audit read-only qui a précédé ces correctifs.

### Deploy
- `prisma db push --accept-data-loss` exécuté automatiquement par
  `backend/docker-entrypoint.sh` au démarrage — drop la table
  `auth_providers` sans perte de données (la table était vide).
- Build serveur validé (webpack 5.97.1 compiled successfully en 15.7s,
  aucun breaking change TypeScript).

---

## [1.4.0] - 2026-04-18

### Post-audit Phase 4 + feature Apparence

#### Lot A/B/D — RBAC scope corrections (backend)
- `GET /users` et `GET /users/:id` passent de `@RequireRead()` à `@RequireManage()` ;
  le scope de `findAll`/`findOne` est désormais l'**union** des délégations où le caller
  a MANAGE (plus la seule délégation active). Fix : un Manager sur 3 délégations voit
  bien tous les membres de ces 3 délégations ; un Viewer ne voit plus la liste.
- `GET /audit` devient super-admin-only (`@SkipDelegation() + @RequireManage() + isSuperAdmin`
  explicite). Un Manager ne voit plus les événements hors scope ; un Viewer reçoit 403
  propre au lieu d'une liste vide trompeuse.
- `GET /delegations` filtre désormais par `UserDelegation.userId = caller` pour les
  non-super-admin, ce qui masque les délégations système (« By SuperAdmin ») dans les
  filtres des Managers.

#### Lot E/F — Gardes, labels, sidebar (frontend)
- Nouveau composant `AccessGate` (fail-closed page-level) utilisé sur `/dashboard/users`,
  `/dashboard/sites/[id]/edit`, `/dashboard/admin/audit`.
- Boutons Edit/Delete de la page utilisateurs masqués aux non-MANAGE ; icônes ✏
  sur le détail site masquées via le composant inline `SiteEditIconLink`.
- `/dashboard/settings` ajouté à la section « Personnel » de la sidebar → désormais
  visible à tous les utilisateurs authentifiés (Profil/Sécurité/Apparence sont universels).
- Helper `lib/labels.ts` : `rightLabel()`, `healthLabel()`, `siteStatusLabel()`,
  `overrideScopeLabel()`. Badges FR homogènes.
- Champ « Rôle » de l'onglet Profil affiche le droit le plus élevé parmi les
  délégations de l'utilisateur (plus la délégation active), traduit via `rightLabel()`.
- Typo « Portee » → « Portée » corrigée dans Coûts × Dépenses, Coûts × Entités, Contacts,
  Contacts (nouveau).

#### Lot H — Apparence tenant + utilisateur (ADR-010)
- Schéma Prisma : `User.appearancePreference Json?`, `User.appearanceSource String
  default "inherit"`, `Tenant.config.appearance` (Json) pour les défauts.
- Endpoints :
  - `GET /tenants/appearance` (auth) / `PATCH /tenants/appearance` (super admin +
    audit log tenant).
  - `GET /users/me/appearance`, `PATCH /users/me/appearance` (403 FR si
    `allowUserOverride=false`), `GET /users/me/effective-appearance`.
- Provider `AppearanceProvider` appliqué au `DashboardLayout` — charge l'apparence
  effective au login, applique `data-density` et `--primary-rgb` en CSS vars, bridge
  `next-themes`.
- Onglet Apparence enrichi (cards « Mes préférences » + « Apparence tenant »
  pour le super admin) avec source « Hérité / Personnalisé / Verrouillé ».

#### Lot C — Seed enrichi + reset
- Seed démo passe de **1 délégation** à **3** (IDF Ouest + Lyon Métropole + Marseille)
  avec 8 sites au total (6 IDF + 1 Lyon + 1 Marseille).
- Nouvel utilisateur multi-délégation (`multi@demo.fr` — Julien Morel) : MANAGE
  sur IDF + Lyon, READ sur Marseille — exerce le switcher.
- `AccessOverride` démo : 1 ALLOW (viewer temporairement WRITE sur La Défense),
  1 DENY (technicien blacklisté sur Boulogne).
- `Budget` + `BillingEntity` + `Expense` + `CostAllocation` démo (Coûts exerçables
  end-to-end).
- `ConnectivityLink` rows créés en miroir du JSON Site.connectivity.
- `UserNotification` : 3 non-lues seedées (Manager + Technicien).
- `AuditLog` : entrées CREATE initiales seedées.
- `technicien@demo.fr` : `appearancePreference: { theme:'dark', density:'compact' }`
  + `appearanceSource:'custom'` (exerce l'héritage dès le seed).
- `resetData` wipe étendu aux nouvelles tables (ConnectivityLink, UserNotification,
  Budget).

#### Lot G — UX cohérence
- Champ « Mot de passe actuel » avec `autoComplete="current-password"` + dummy
  `username` caché pour neutraliser l'autofill navigateur.
- Nouveau mot de passe en `autoComplete="new-password"`.
- Message d'état vide Monitoring : lien vers `/dashboard/netbox` au lieu d'une
  section « Intégrations » inexistante.
- Dashboard TV : clarification « Alertes monitoring » (vs « Alertes » page qui
  agrège tâches + santé sites).
- **Alertes unifiées (Lot 4 final)** — nouveau `frontend/src/lib/alerts.ts`
  `computeAlerts()` utilisé par Dashboard widget, page `/alerts` et TV dashboard.
  Règles de dedup consolidées (BLOCKED > URGENT > OVERDUE). Comptes
  désormais identiques entre les trois vues.
- **Consommation explainer** : encart UX sur `/dashboard/consumption` expliquant
  pourquoi les totaux « Assets » diffèrent de la page `/dashboard/assets`.
- **Logo placeholder** : Input tenant et exemple Swagger setup nettoyés
  (plus de `https://example.com/logo.png` visible).

#### Throttle (post Lot 4)
- Nouveau `XchThrottlerGuard` : le 429 retourne un message FR
  « Trop de tentatives. Merci de patienter une minute avant de réessayer. ».
- Limites auth pilotables par env vars (`THROTTLE_AUTH_LIMIT`,
  `THROTTLE_AUTH_LOGOUT_LIMIT`, `THROTTLE_AUTH_FORGOT_LIMIT`) avec defaults
  prod-safe (5/10/3). Sur le serveur dev : 60/120/30 pour la phase QA.

#### Documentation
- ADR-010 (apparence) rédigé.
- `docs/architecture/AUTH_MODEL.md` : `AccessGrant` → `AccessOverride` (correction
  de référence), onglet Apparence remappé, historique v1.4 ajouté.
- `reports/phase4-audit-correctifs.md` : rapport de clôture audit 18/04/2026.

#### Breaking
- Aucun pour le runtime produit ; nécessite `prisma db push --accept-data-loss`
  pour ajouter les 2 colonnes `User.appearance*`.
- Base de données dev reset + re-seed obligatoire (données de démo uniquement).

---

## [1.3.0] - 2026-04-16

### Vers le pilote production

#### Lot A — Fix UX baies
- `handleUnitClick()` détecte les slots occupés et ouvre le dialog en mode édition/démontage
- Bouton "Démonter" visible uniquement quand une baie est occupée

#### Lot B — Types dynamiques (EnumLabel)
- `AssetType`, `AssetStatus`, `PinType` passent d'`enum` Prisma à `String`
- `EnumLabel` étendu (`isBuiltIn`, `isActive`) — source unique des valeurs autorisées
- Validator `@IsDynamicEnum()` (class-validator) lit les valeurs actives par tenant
- Seed migre les valeurs historiques avec `isBuiltIn=true`
- `POST /api/admin/enum-labels` + `DELETE /:id` (409 si built-in ou utilisé)
- Dialog de gestion de valeurs + `EnumSelect` réutilisable

#### Lot C — Module coûts (modèles, budgets, projections, coûts tâches)
- **`AssetModel`** : catalogue de modèles avec prix (`acquisitionPrice` / `monthlyPrice`), specs (watts, poids, U), pré-remplissage lors de la création d'asset
- Création automatique d'`Expense` liée quand un asset a un prix (ONE_TIME ou MONTHLY)
- **`Budget`** : période `MONTH` | `YEAR`, scope délégation/site/type, endpoint `/budgets/:id/status` (spent / remaining / progress / overBudget)
- **Projection** : `GET /api/expenses/projection?from=&to=&groupBy=` — éclate les récurrences (MONTHLY/QUARTERLY/YEARLY) en tranches mensuelles
- **Coûts tâches** : champs `estimatedCost` / `actualCost` / `costCurrency` + conversion d'une tâche terminée en `Expense SERVICE`
- `/dashboard/costs/budgets` (liste + new/edit)

#### Lot D — Connectivité structurée
- Modèle **`ConnectivityLink`** remplace `Site.connectivity` JSON (legacy conservé)
- Rôle `PRIMARY | BACKUP | OTHER`, provider/type/bandwidth/IP/contract/prix mensuel
- Endpoint `POST /api/connectivity/:id/generate-expense` — crée une Expense MONTHLY liée et `expenseId` FK
- Section "Connectivité" dans `/dashboard/sites/[id]` remplace l'éditeur JSON

#### Lot E — Consommation électrique
- Nouveau module `/api/consumption/{summary,site/:id,rack/:id}`
- Calcul : `totalWatts = Σ(power × dutyCyclePercent / 100)`, `kWh/mois = totalWatts × 24 × 30 / 1000`, `coût = kWh × tenant.config.electricity.costPerKwh`
- Nouveau champ `dutyCyclePercent` sur Asset (slider 0-100 dans formulaire)
- Nouveau champ `autoGenerateElectricityExpense` sur Site
- Pages `/dashboard/consumption` (vue globale) + `/dashboard/consumption/[siteId]` (détail site)
- Tab "Électricité" dans `/dashboard/settings` (coût kWh, devise)

#### Lot F — Production-ready features
- **F1 — Recherche globale** : `GET /api/search?q=&limit=`, modal `Cmd+K` / `Ctrl+K` avec groupement par type (Assets, Sites, Baies, Tâches, Contacts), navigation clavier
- **F2 — Notifications in-app** : modèle `UserNotification` + inbox `/api/notifications/inbox/*`, cloche dans le header avec badge unread, polling 60s, page `/dashboard/notifications`, crons quotidiens (warranty ≤ 30j, tasks due ≤ 2j), hook sur `TASK_ASSIGNED`
- **F3 — Import CSV** : endpoints `/import/preview` (dry-run) + `/import/commit` + `/import/template`, page `/dashboard/assets/import` avec preview serveur (valid/invalid rows avec erreurs par ligne)
- **F4 — Viewer audit log** : `GET /api/audit` + `/api/audit/entity/:type/:id`, page `/dashboard/admin/audit` (filtres entity/action/user/from/to), composant `EntityAuditLog` réutilisable

### Breaking changes
- Enums `AssetType`, `AssetStatus`, `PinType` supprimés du schéma Prisma → `String` avec validation par `EnumLabel`
- `Site.connectivity` JSON marqué legacy (sera supprimé en v1.4) → utiliser `ConnectivityLink`

### Modules backend ajoutés
- `asset-models`, `budgets`, `connectivity`, `consumption`, `search`, `audit`

### Pages frontend ajoutées
- `/dashboard/costs/budgets/{,new,[id]/edit}`
- `/dashboard/consumption/{,[siteId]}`
- `/dashboard/notifications`
- `/dashboard/admin/audit`

---

## [1.1.1] - 2026-04-06

### Notifications et gestion utilisateurs

- **Systeme notifications** — Email SMTP + Microsoft Teams webhooks, config multi-scope avec heritage, 7 types d'evenements, page UI config + logs
- **Suppression utilisateur** — bouton corbeille (liste) + bouton rouge (edition), dialog confirmation, Task.createdBy nullable
- **Portees d'acces enrichies** — noms divisions/delegations/sites visibles
- **Creation dual-mode** — directe (mot de passe) ou invitation email (fallback lien)
- **Corrections** — double prefixe API notifications, pagination getAll(), pageSize max 100

---

## [1.1.0] - 2026-04-05

### Stabilisation pre-production — 6 phases

#### Securite et integrite
- **AllExceptionsFilter** global — Prisma P2002/P2025/P2003 retournent 409/404/400 au lieu de 500
- Endpoint seed securise (`@Action('delete')`) — MANAGER ne peut plus reset la base
- `integrations.delete` + `tenants.delete` ajoutes dans Casbin
- Validation: asset RETIRED bloque le montage en rack
- NetBox provider: INACTIVE remplace par CLOSED/OUT_OF_SERVICE (valeurs Prisma valides)
- MinIO credentials: fallback hardcode supprime, variables env obligatoires

#### Unification types, labels, permissions
- **WIFI_AP / ACCESS_POINT unifie** — 48 occurrences dans 22 fichiers, heatmap WiFi corrige
- `assetTypeLabels` centralise dans `@/lib/asset-labels` (6 doublons supprimes)
- Pin colors/labels centralises dans `backend/src/common/constants/pin-config.ts`
- `siteStatusLabels` corrige (PREPARATION/ACTIVE/CLOSED)
- ROLE_PERMISSIONS frontend aligne avec Casbin (MANAGER+tenants, TECH/VIEWER+integrations)
- DTOs corriges avec `@IsEnum()` (expenses, contacts, users, assets)
- `@ts-nocheck` retire de 4 fichiers modifies (tasks, assets/new, assets/[id], assets/[id]/edit)
- Navigation Couts avec `moduleKey`, expenses hors `hasAnySiteAccess`

#### Pagination serveur
- `PaginationDto` + `PaginatedResponse<T>` generiques
- 8 modules backend pagines (assets, sites, tasks, contacts, expenses, racks, users, floor-plans)
- Sites: raw SQL avec COUNT + LIMIT/OFFSET parametrise
- Composant `<Pagination>` frontend (page, pageSize, navigation)
- 8 pages frontend integrees avec pagination + selecteur taille page

#### Import et onboarding
- **Import CSV assets** — endpoint multipart, papaparse, headers FR/EN, validation ligne par ligne, rapport erreurs
- **Page import frontend** — drag & drop, preview tableau, template telechargebale, rapport resultats
- **Service email** (Nodemailer) — SMTP configurable, fallback console log en dev
- **Invitation par email** — token 72h, page `/invite` pour definir mot de passe
- **Mot de passe oublie** — endpoints forgot/reset, token 1h, pages frontend

#### UX production
- 5x `window.confirm()` remplaces par AlertDialog
- **Verification avant fermeture site** — alerte si assets actifs ou taches ouvertes
- Filtres ajoutes: statut sites, assigne tasks, statut racks, recherche/role users
- **Export Tasks + Contacts** (CSV/Excel/PDF/JSON)
- **Batch update assets** — selection multiple, changement statut/site en lot

#### Nettoyage et robustesse
- **MinIO cleanup** a la suppression (sites cascade → assets/racks/floor-plans, `deleteByPrefix`)
- **Audit logs etendus** aux assets, tasks, racks (create/update/delete/mount/unmount)

### Migration requise
```bash
npx prisma migrate deploy   # Ajoute tokens invitation/reset sur User
npx prisma generate
```

### Variables env ajoutees (optionnelles)
```env
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
FRONTEND_URL
```

---

## [1.0.0-rc1] - 2026-03-15

### Added
- **Export PDF plans Wi-Fi 4 quadrants** (2.4 GHz, 5 GHz, 6 GHz, Toutes bandes)
  - Page Wi-Fi auto-incluse dans les exports PDF si le plan est calibre et contient des AP
  - Fonctionne sans activer le toggle "Couverture Wi-Fi"
- **Heatmap Wi-Fi sur plans d'etage** — couverture radio avec modele FSPL Friis
- **Monitoring Gatus** integre au Docker Compose avec webhook alertes
  - Dashboard TV mode plein ecran
  - Abstraction provider monitoring (Gatus / Uptime Kuma)
  - Sante composite SD-WAN depuis firewalls
  - Sync automatique cron des etats de sante
- **Sauvegarde / Restauration completes**
  - Backup complet (DB + fichiers MinIO) avec UI dans Parametres
  - Restauration site individuel + restauration complete
  - Nettoyage stockage orphelin (manuel + cron)
- **Scripts deploiement production**
  - `scripts/package-release.sh` — packaging archive portable
  - `scripts/install-airgap.sh` — installation serveur isole
  - `scripts/backup-full.sh` / `scripts/restore-full.sh`
- **Docker production optimise**
  - `docker-compose.prod.yml` avec limites memoire et rotation logs
  - `.dockerignore` backend + frontend (contexte build reduit)
  - Dockerfiles optimises (bcrypt pre-compile, pas de python/g++ en prod)
  - `next.config.ts` converti en `next.config.mjs` (pas de TypeScript en prod)
  - `.env.production.example` documente
  - `README-DEPLOY.md` — guide deploiement connecte + air-gapped
- **Export site ZIP enrichi** — plans PDF avec pins + equipements montes dans baies
- **Tri colonnes** sur les tableaux assets et sites
- **Alertes dashboard** compactes + page monitoring et alertes

### Fixed
- **RBAC Casbin 403** — policies manquaient le parametre tenant (v3 = '*')
- **Restauration site 500** — contrainte unique serialNumber (deduplication avec suffixe)
- **Heatmap PDF invisible** — compositing `screen` sur fond blanc remplace par overlay `source-over`
- **Heatmap PDF double-scaling** — transform canvas 4x au lieu de 2x corrige
- **Double scrollbar** page parametres/backup — overflow global corrige
- **Restauration champs manquants** — GPS, contacts, tous champs site/asset/rack/plan/task
- **Monitor parser** — codes site avec tirets (DEF-01) rejetes
- **Gatus webhook** — parsing booleens + guillemets placeholders
- **Migration table Site** — `@@map` vers `sites`
- **Types pins manquants** — 7 types ajoutes dans l'enum PostgreSQL
- **Rack assets API** — tous les champs renvoyes + tous types pins dans editeur
- **Monitoring per-site toggle 400** — canUpdate('settings') toujours false
- **5 bugs post-deploiement** — backup 500, dark mode, plans rendus, Kuma, filtres

### Changed
- **Frontend version** `0.1.0` → `1.0.0`
- **Menu restructure** — NetBox page autonome, onglet SSO, backup dans Parametres
- **Labels centralises** pour monitoring et alertes

### Removed
- **3 migrations orphelines** — 1 fichier SQL isole + 2 repertoires vides

### Infrastructure
- Images Docker taguees `v1.0.0-rc1`
- Labels OCI sur images backend/frontend
- Nginx reverse proxy integre (proxy profile supprime, toujours actif en prod)
- Redis avec `maxmemory 128mb` et politique `allkeys-lru`
- MinIO init en mode one-shot (`restart: "no"`)

---

## [1.0.3] - 2026-01-18

### Added
- **SSL Production** avec Nginx Proxy Manager
  - Certificat wildcard `*.eoncom.io`
  - 2 Proxy Hosts: `xch.eoncom.io` (frontend), `xchapi.eoncom.io` (backend)
  - Force SSL + HTTP/2 + HSTS activés
- **Documentation guides production**
  - `docs/guides/NGINX_PROXY_PRODUCTION.md` - Setup Nginx Proxy Manager
  - `docs/guides/PWA_ICONS_SETUP.md` - Génération icônes PWA
- **Variables environnement production**
  - `backend/.env.production` avec URLs HTTPS
  - CORS configuré pour cross-subdomain HTTPS

### Fixed
- **Authentification cross-domain cookies** (Session 14)
  - Problème: Cookie `accessToken` limité à `xchapi.eoncom.io`
  - Solution: Ajout `domain: '.eoncom.io'` dans tous les cookies
  - Impact: Cookies partagés entre `xch.eoncom.io` et `xchapi.eoncom.io`
- **Redirection dashboard bloquée après login**
  - Login réussi mais page reste sur `/login`
  - F5 (refresh) renvoie systématiquement à `/login`
  - Solution: Cookies partagés + auth client-side
- **Middleware Next.js incompatible cookies cross-domain**
  - Edge Runtime ne lit pas cookies HTTP-only cross-domain en SSR
  - Solution: Middleware désactivé, auth vérifiée client-side via `checkSession()`

### Changed
- **Backend auth cookies** (`backend/src/modules/auth/auth.controller.ts`)
  - `accessToken`: domain `.eoncom.io`, sameSite `none`, secure `true`, 15 min
  - `refreshToken`: domain `.eoncom.io`, sameSite `none`, secure `true`, 7 jours
  - Endpoint `/api/auth/refresh`: domain `.eoncom.io`
  - Endpoint `/api/auth/logout`: domain `.eoncom.io` dans clearCookie
- **Frontend auth protection** (`frontend/src/app/dashboard/layout.tsx`)
  - Ajout state `sessionChecked` pour éviter flash redirection
  - useEffect `checkSession()` avec loading state
  - Redirection uniquement après vérification session complète
- **Frontend middleware** (`frontend/src/middleware.ts`)
  - Désactivé (incompatibilité SSR + cookies cross-domain)
  - Commentaire explicatif ajouté
- **URLs production**
  - Frontend: http://192.168.0.39:3001 → https://xch.eoncom.io
  - Backend API: http://192.168.0.39:3002/api → https://xchapi.eoncom.io/api

### Infrastructure
- **Production déployée avec SSL:**
  - Frontend: https://xch.eoncom.io (accessible publiquement)
  - Backend API: https://xchapi.eoncom.io/api (accessible publiquement)
  - HTTPS forcé sur tous endpoints
  - Authentification fonctionnelle: login → dashboard → F5 → logout

---

## [1.0.2] - 2026-01-17

### Added
- **CI/CD GitHub Actions** (Session 12)
  - Workflow `.github/workflows/tests-e2e.yml`
  - Trigger automatique: push/PR sur branches main/develop
  - Infrastructure Docker Compose complète
  - Tests E2E Playwright (Chromium)
  - Rapports HTML/JUnit uploadés comme artifacts
- **Docker Compose E2E** (`docker-compose.e2e.yml`)
  - Réseau Docker `xch-network`
  - Variables environnement DNS Docker (frontend:3001, backend:3002)
  - Volumes rapports montés sur host

### Fixed
- **Configuration réseau Docker E2E**
  - Problème: `network_mode: host` empêchait DNS Docker
  - Solution: Utilisation réseau `xch-network`
  - Tests E2E peuvent maintenant résoudre `frontend`, `backend`

### Changed
- **Documentation testing**
  - `docs/testing/CI_CD_GUIDE.md` - Guide workflow GitHub Actions
  - `docs/testing/E2E_VALIDATION_REPORT.md` - Rapport validation E2E
  - README.md - Section CI/CD avec exemples

---

## [1.0.1] - 2026-01-13

### Added
- **Tests E2E Playwright** (Session 11)
  - Installation Playwright v1.57.0 (Chromium, Firefox, WebKit)
  - Configuration `playwright.config.ts` (5 projets de test)
  - **57 tests E2E** couvrant 95% scénarios critiques
  - Fixtures: `auth.fixture.ts` (login/logout automatisés)
  - Helpers: navigation, test-data
  - Scripts npm: 10 commandes (test:e2e, test:e2e:ui, etc.)
  - Cross-browser: 5 navigateurs
  - Rapports HTML + JUnit pour CI/CD

### Fixed
- **RBAC Manager permissions** (Session 9)
  - Problème: Manager login OK mais dashboard montre 0 données
  - Solution: Insertion 34 policies SQL (17 MANAGER, 10 TECHNICIEN, 7 VIEWER)
- **Session/Auth redirects** (Session 9)
  - Problème: Navigation → logout inattendu
  - Solution: Ajout cookie update dans setTokens()
- **Site detail assets visibility** (Session 9)
  - Problème: Site detail "Paris" → 0 équipements
  - Solution: Implémentation queries React Query

---

## [1.0.0] - 2026-01-01

### Added
- **MVP Complet Production-Ready**
  - Backend: 10 modules API (~100 endpoints)
  - Frontend: 7 modules fonctionnels (17 pages)
  - Auth JWT + OIDC + refresh tokens
  - RBAC Casbin (4 rôles, 67 policies)
  - Multi-tenant isolation (RLS ready)
  - PostgreSQL + PostGIS + Redis + MinIO
  - Docker Compose production-ready
  - Documentation complète (~25000 lignes)

### Infrastructure
- Docker Compose orchestration
- PostgreSQL 15 + PostGIS (recherche géospatiale)
- Redis 7 (cache + sessions)
- MinIO (stockage S3-compatible)
- Prisma ORM (15 modèles)

### Fonctionnalités MVP
- Gestion chantiers avec carte Leaflet interactive
- Inventaire assets avec QR codes (génération + scan PWA)
- Gestion baies 4U-42U avec montage équipements
- Plans d'étage avec visionneuse Konva (zoom/pan/pins)
- Tâches Kanban drag & drop avec checklist
- Intégrations NetBox + Uptime Kuma (READ-ONLY)
- PWA manifest + icons (192x192, 512x512)
- Responsive design mobile-first

---

## [0.3.0] - 2025-12-31

### Added
- Backend 10 modules complets
- Frontend authentification + dashboard
- Module Sites (liste + carte)
- API Client avec auto-refresh JWT

---

## [0.2.0] - 2025-12-30

### Added
- Module Tasks (checklist dynamique)
- Module Racks (baies 4U-42U)
- Module FloorPlans (upload + pins)

---

## [0.1.0] - 2025-12-29

### Added
- Module Auth (JWT + OIDC)
- Module RBAC (Casbin)
- Module Users + Tenants
- Module Sites (PostGIS)
- Module Assets (QR codes)

---

**Légende:**
- `Added` - Nouvelles fonctionnalités
- `Changed` - Modifications fonctionnalités existantes
- `Deprecated` - Fonctionnalités bientôt retirées
- `Removed` - Fonctionnalités retirées
- `Fixed` - Corrections de bugs
- `Security` - Correctifs de sécurité
- `Infrastructure` - Changements infrastructure/déploiement
