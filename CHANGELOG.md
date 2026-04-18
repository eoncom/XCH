# Changelog XCH

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
