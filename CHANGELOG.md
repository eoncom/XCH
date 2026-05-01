# Changelog XCH

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
