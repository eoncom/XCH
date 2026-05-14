# XCH - Gestion IT pour Chantiers Temporaires

**Version :** 1.4.0 | **Derniere mise a jour :** 2026-04-23

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)

> Application web full-stack de gestion IT pour chantiers temporaires — modele delegation-first (multi-delegations)

---

## Vue d'ensemble

**XCH** centralise toutes les informations IT des chantiers d'une delegation : sites, equipements, baies, plans, taches, contacts et couts. Il reference les outils specialises (NetBox, monitoring) sans les remplacer.

**Valeur ajoutee** :
- Acces instantane : toute info chantier en 3 clics ou 1 scan QR
- Mobile-first : interventions terrain fluides (PWA)
- Vue d'ensemble : carte temps reel de tous les chantiers
- Tracabilite : historique complet des actions (audit trail)

---

## Fonctionnalites

### Coeur metier
- **Gestion chantiers** — referentiel complet (code, nom, adresse, GPS, contacts, connectivite), carte interactive Leaflet avec clustering
- **Inventaire assets** — equipements avec QR codes (generation + scan mobile), recherche instantanee, actions groupees (batch status/site)
- **Gestion baies** — creation 4U-42U, montage equipements avec positions U, visualisation schematique, export PDF
- **Plans d'etage** — upload (PDF/PNG/JPG), visionneuse interactive Konva (zoom/pan), editeur pins drag & drop, heatmap Wi-Fi (modele FSPL Friis)
- **Taches** — CRUD avec checklist, assignation, priorites/echeances, vues Liste + Kanban drag & drop
- **Contacts** — referentiel par site avec categories (prestataire, client, interne)
- **Couts** — suivi depenses par site avec entites de facturation

### Notifications
- **Email SMTP** — envoi configurable (Nodemailer), templates HTML
- **Microsoft Teams** — webhooks Incoming avec Adaptive Cards
- **Configuration scopee delegation** — config par delegation avec sentinel `global` super admin (ADR-009)
- **Inbox in-app** — cloche header + badge unread, polling 60s, page `/dashboard/notifications`
- **Crons quotidiens** — warranty <= 30j et tasks due <= 2j (8h/8h05)
- **Page configuration UI** — onglets canaux/evenements/journal, test de canal integre

### Gestion utilisateurs et delegations (v1.2+)
- **Modele delegation-first (ADR-009)** — `UserDelegation.right` (MANAGE/WRITE/READ) + `User.isSuperAdmin` + `AccessOverride` ALLOW/DENY par site
- **Suppression utilisateur** — liste ou page d'edition, dialog de confirmation
- **Portees d'acces** — multi-delegations par utilisateur, role local (rightLabel: Administrateur/Editeur/Lecteur)
- **Creation dual-mode** — directe (mot de passe) ou invitation par email (fallback lien si SMTP indisponible)
- **AccessGate frontend** — guards page-level fail-closed sur `/users`, `/admin/audit`, `/sites/[id]/edit`

### Surveillance & Integrations
- **Surveillance native (ADR-014 + ADR-016)** — sondes ICMP / HTTP / TCP exécutées
  par un worker XCH dédié (BullMQ + scheduler 30s + retry exponentiel + cap_add NET_RAW
  pour l'ICMP réel). Site.healthStatus mis à jour en temps réel sur transition.
  Aucune dépendance monitoring externe.
- **NetBox** (READ-ONLY) — mapping sites/devices, enrichissement donnees
- **Import CSV assets** — endpoint multipart, headers FR/EN, validation ligne par ligne, rapport erreurs

### Securite & Permissions (modele v2 delegation-first, ADR-009)
- **Auth hybride** : locale (email/password) + OIDC (Microsoft Entra ID, Keycloak) avec mapping groupes -> DelegationRight
- **Autorisation** : `UserDelegation.right` (MANAGE/WRITE/READ) + `AccessOverride` ALLOW/DENY par site (Casbin retire en v1.3)
- **Decorateurs fail-closed** : `@RequireRead/@RequireWrite/@RequireManage` + `@SkipDelegation`
- **Invitation email** : token 72h, page `/invite` pour definir mot de passe
- **Mot de passe oublie** : token 1h, flux complet forgot/reset
- **Audit trail** complet : sites, assets, tasks, racks (create/update/delete/mount/unmount), viewer super admin (`/admin/audit`)
- **Throttle** : `XchThrottlerGuard` (429 FR), account lockout 5 echecs -> 14 min

### Pagination serveur (v1.1.0)
- Tous les endpoints de liste sont pagines (page, pageSize, total, totalPages)
- 8 modules : assets, sites, tasks, contacts, expenses, racks, users, floor-plans
- Composant `<Pagination>` frontend avec selecteur taille page

### Sauvegarde / Restauration (v2.2.0 — Track D.1 Backup v2)
- **Streaming end-to-end** (zero `Buffer.concat`) — backup + restore scale au multi-GB
  tenant employeur sans OOM (RSS worker < 1 GB sur backup 5 GB)
- **Orphan-aware** — full bucket walk MinIO inclus dans le ZIP (blobs non
  référencés DB préservés pour DR)
- **Per-file SHA-256** dans `metadata.json` v2 + verify à la restauration
  (mismatch → BadRequestException explicite)
- **Idempotent restore** via `upsertByNaturalKey` skip-if-exists sur 19 tables
  + 5 phases FK ordering. Re-restore = 0 inserts garanti.
- **Dry-run preview** safe-default (Switch UI checked par défaut) — filet
  de sécurité critique pour 1er restore sur tenant peuplé. Affiche le
  diff `wouldCreate / wouldSkip / missingFiles / invalidChecksums`
  avant commit.
- **Async Bull v3 jobs** : `POST /backup/full` retourne 202 + jobId,
  frontend `useBackupJob` poll `GET /backup/jobs/:jobId` toutes les 2s.
  Progress bar live + capture Sentry/GlitchTip gratuite via `WorkerEventLogger`
  (ADR-024).
- **Pre-launch estimate** : `POST /backup/estimate` retourne taille
  projetée + check disque (`fs.statfs` Node 20). HTTP 507 si insuffisant.
- **Compat v1 restore-only** : ZIP v1 existants restaurables via délégation
  legacy `AdmZip` path (détection automatique par `typeof metadata.version`).
- **CLI escape hatch** : header `X-Backup-Sync: 1` force le path v1
  synchrone (fallback urgence si Redis down).
- Référence : [ADR-025 Backup v2 streaming](docs/decisions/adr-025-backup-v2-streaming.md)
  + [CHANGELOG v2.2.0](CHANGELOG.md)

### Sauvegarde / Restauration (legacy v1, restore-only depuis v2.2.0)
- Restauration site individuel + restauration complete (multipart sync)
- Nettoyage stockage orphelin (manuel + cron `cleanupOrphanedStorage`)

### Export
- **Sites** : CSV, Excel, PDF, JSON, ZIP (plans PDF avec pins + equipements en baies)
- **Assets** : CSV, Excel, PDF, JSON
- **Tasks + Contacts** : CSV, Excel, PDF, JSON
- **Plans Wi-Fi** : PDF 4 quadrants (2.4 GHz, 5 GHz, 6 GHz, toutes bandes)

---

## Stack Technique

### Backend
- **NestJS 10** (Node.js + TypeScript)
- **PostgreSQL 15** + **PostGIS** (geospatialisation)
- **Prisma 5.22** (ORM type-safe)
- **Redis 7** (cache + sessions + throttle)
- **Passport.js** (auth locale + OIDC)
- **Nodemailer** (emails SMTP)

### Frontend
- **Next.js 15** (React 19 + TypeScript 5.7)
- **shadcn/ui** + **Tailwind CSS 3.4**
- **Zustand** (state management) + **TanStack Query** (data fetching)
- **Leaflet** (cartes interactives)
- **Konva.js** (plans interactifs + visualisation baies)
- **React Hook Form** + **Zod** (validation)
- **Framer Motion** (animations)

### Infrastructure
- **Docker** + **Docker Compose**
- **MinIO** (stockage S3-compatible)
- **Nginx Proxy Manager** (reverse proxy + HTTPS + SSL)
- **GitHub Actions** (CI/CD, tests E2E Playwright)

---

## Installation rapide (Developpement)

```bash
# 1. Cloner le repository
git clone https://github.com/votre-org/xch.git
cd xch

# 2. Demarrer l'infrastructure Docker
cd backend
docker compose up -d   # PostgreSQL, Redis, MinIO

# 3. Backend : installer + appliquer le schema
npm install
npx prisma db push --accept-data-loss
# Seed/demo data : assistant de configuration au 1er login (POST /api/setup/initialize)

# 4. Frontend : installer + generer icones PWA
cd ../frontend
npm install
npm run generate-icons

# 5. Demarrer en developpement
# Terminal 1 (backend)
cd backend && npm run start:dev

# Terminal 2 (frontend)
cd frontend && npm run dev
```

**Acces application** :
- Frontend : http://localhost:3001
- Backend API : http://localhost:3000/api
- Swagger : http://localhost:3000/api (documentation auto)

**Premier login** : assistant de configuration (super admin via `/setup`).

**Comptes demo (apres seed via setup wizard avec `loadDemoData:true`)** :
- `admin@demo.fr` / `Demo1234` — super admin
- `manager@demo.fr` / `demo123` — MANAGE sur IDF Ouest + Lyon + Marseille
- `technicien@demo.fr` / `demo123` — WRITE sur IDF
- `viewer@demo.fr` / `demo123` — READ sur IDF
- `multi@demo.fr` / `demo123` — multi-delegation (MANAGE IDF+Lyon, READ Marseille)

---

## Deploiement Production

### Architecture deploiement

```
Internet/LAN
     |
  [Nginx Proxy Manager :80/:443]
     |
     +-- /api/*    --> [Backend :3000]  --> [PostgreSQL :5432]
     |                                  --> [Redis :6379]
     |                                  --> [MinIO :9000]
     +-- /*        --> [Frontend :3001]
```

### Deploiement connecte

```bash
# Sur le serveur de production
git clone https://github.com/votre-org/xch.git /opt/xch
cd /opt/xch

# Configurer l'environnement
cp .env.production.example backend/.env
nano backend/.env   # Personnaliser secrets (JWT, PostgreSQL, MinIO, SMTP)

# Lancer la stack
docker compose up -d --build
```

### Mise a jour

```bash
cd /opt/xch
git pull
docker compose up -d --build backend backend-worker frontend
```

### Rollback

```bash
bash rollback.sh    # Interactif, avec option restauration DB
```

### Ports par defaut

| Service | Port hote | Port conteneur |
|---------|-----------|----------------|
| Frontend | 3001 | 3001 |
| Backend | 3002 | 3000 |
| PostgreSQL | 5433 | 5432 |
| Redis | 6380 | 6379 |
| MinIO API | 9000 | 9000 |
| MinIO Console | 9001 | 9001 |

### Variables d'environnement cles

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL |
| `JWT_SECRET` | Secret JWT access tokens |
| `JWT_REFRESH_SECRET` | Secret JWT refresh tokens |
| `MINIO_ACCESS_KEY` | Identifiant MinIO |
| `MINIO_SECRET_KEY` | Secret MinIO (min 16 car.) |
| `SMTP_HOST/PORT/USER/PASS` | Config SMTP pour notifications |
| `FRONTEND_URL` | URL frontend (pour liens dans emails) |
| `COOKIE_SECURE` | `true` pour HTTPS, `false` pour HTTP |

---

## Scripts

### Scripts actifs

| Script | Description |
|--------|-------------|
| `scripts/deploy-auto.sh` | Deploiement production (git pull + build + restart) |
| `scripts/rotate-secrets.sh` | Rotation des secrets prod (JWT, MinIO, Redis, XCH_MASTER_KEY) |
| `scripts/backup-full.sh` | Backup complet (DB + MinIO) |
| `scripts/restore-full.sh` | Restauration depuis backup |
| `scripts/generate-ssl.sh` | Generation cert SSL auto-signe |
| `deploy.sh` | Script deploiement principal (racine) |
| `install.sh` | Installation zero-to-hero (3 modes) |
| `rollback.sh` | Rollback interactif avec option restauration DB |

### Scripts utiles developpement

```bash
# Backend
cd backend
npm run start:dev            # Hot-reload developpement
npm run build                # Build production
npx prisma db push           # Appliquer le schema (pas de migrations versionnees, decision projet)
# Seed/demo data : POST /api/setup/initialize avec loadDemoData=true (super admin requis)
npx prisma studio            # GUI DB (http://localhost:5555)

# Frontend
cd frontend
npm run dev                  # Dev server (http://localhost:3001)
npm run build                # Build production
npm run generate-icons       # Generer PWA icons

# Tests E2E
cd frontend
npm run test:e2e             # Tous tests Playwright
npm run test:e2e:ui          # Mode interactif
npm run test:e2e:chromium    # Chromium uniquement
```

---

## Structure Projet

```
xch/
├── backend/                 # API NestJS (27 modules, 261 endpoints)
│   ├── src/
│   │   ├── modules/         # auth, users, user-delegations, access-overrides,
│   │   │                    # organization, tenants, sites,
│   │   │                    # assets, asset-models, racks, tasks, floor-plans,
│   │   │                    # contacts, contact-types,
│   │   │                    # billing-entities, expenses, budgets, consumption,
│   │   │                    # integrations, connectivity,
│   │   │                    # notifications, audit, search,
│   │   │                    # admin, backup, seed, setup
│   │   ├── common/          # Guards, filters, interceptors, decorators
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma    # Schema DB (32 modeles + 17 enums)
│   └── docker-entrypoint.sh # prisma generate + db push + start
├── frontend/                # App Next.js 15
│   ├── src/
│   │   ├── app/dashboard/   # Pages (App Router)
│   │   ├── components/      # Composants React (shadcn/ui)
│   │   └── lib/             # Utils, hooks, API client
│   └── e2e/                 # Tests Playwright (57 tests)
├── scripts/                 # Scripts deploiement/backup
├── docker-compose.yml       # Docker Compose principal (dev + prod)
├── deploy.sh                # Script deploiement principal
├── install.sh               # Installation zero-to-hero
├── rollback.sh              # Rollback interactif
├── CHANGELOG.md             # Historique versions
└── README.md                # Ce fichier
```

---

## Tests

### Tests E2E Playwright
- **57 tests** couvrant 7 modules (auth, sites, assets, tasks, racks, floor-plans, users)
- **5 navigateurs** : Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **CI/CD** : GitHub Actions avec rapports HTML/JUnit

```bash
cd frontend
npm run test:e2e              # Tous tests
npm run test:e2e:ui           # Mode interactif
npm run test:e2e:report       # Ouvrir rapport
```

---

## Changelog (versions recentes)

### v1.8.0 (2026-04-30) — RBAC universel + tests d'intrusion bloquants (Session 4)
- **ADR-021** : data filtering systématique au niveau service via
  `CallerCtx + DI PermissionService`. 14 modules fixés (contacts,
  connectivity, notif-settings, sdwan, consumption + 9 modules avec
  findOne universel).
- **Shape d'erreur breaking** : 404 sur read cross-delegation (defense
  in depth), 403 sur write, 403 sur cross-skew.
- **Workflow CI bloquant** : `backend-integration.yml` Jest+supertest,
  ~85 attaques d'intrusion, branch protection main exigeant ce check.
- **`@CallerCtxParam()` + `SYSTEM_CTX(reason, tenantId)` factory traçable**.
- **UX deep-link 404** : 4 pages détail patchées (sites/assets/tasks/
  floor-plans) avec message clair + bouton retour liste.

### v1.7.1 (2026-04-29) — Hardening @@unique nullable (ADR-020 §C)
- Trou d'intégrité PG comblé : 2 partial UNIQUE INDEX sur
  `notification_channels_global_uniq` + `notification_rules_global_uniq`
  (`WHERE delegationId IS NULL`). Plus de 2ᵉ row globale possible.

### v1.7.0 (2026-04-29) — Notifications refacto + Worker BullMQ (Session 3)
- **ADR-020** : `NotificationConfig` (1 table, 2 JSON) → 2 tables typées
  `NotificationChannel` + `NotificationRule` avec enums Prisma. Migration
  versionnée `6_notifications_split` (INSERT FROM JSON puis DROP).
- **Worker BullMQ** : queue `notifications` + `NotificationProcessor`
  (retry 3× backoff exponentiel, fan-out vers EmailChannel / TeamsChannel).
  Les 5 callers (tasks/assets/sites/monitoring/auth) ne bloquent plus sur
  SMTP / Teams.
- **`teams.webhookUrl`** : colonne scalaire chiffrée (ADR-019 pattern).
  Le walker JSON sub-field (`encryptSubfields` / `decryptSubfields`)
  retiré : règle unique post-ADR-020 — `config_json` ne contient jamais
  de secret.
- **API breaking** côté front : nouveau shape `{ channels[], rules[] }`,
  panel UI refondu, DTO typés enums.

### v1.6.2 (2026-04-29) — Chiffrement secrets at-rest (Session 2)
- **ADR-019** : AES-256-GCM applicatif pour 4 colonnes sensibles en DB —
  `TenantSsoConfig.clientSecret`, `TenantIntegrationConfig.netboxToken`,
  `User.totpSecret`, `NotificationConfig.channels.teams.webhookUrl`.
  Format `v1:<iv>:<tag>:<ct>` versionné (rotation MASTER_KEY supportée).
- **`XCH_MASTER_KEY`** : nouvelle env var requise prod (32 bytes base64).
  Phase C ajoutée à `scripts/rotate-secrets.sh`.
- **Bonus hash SHA-256** : `User.inviteToken` + `User.resetToken` ne sont
  plus stockés en clair (lookup par hash, comme l'API standard).

### v1.6.1 (2026-04-29) — Quick wins post-v1.6
- **Bug Budgets** : `/dashboard/costs/budgets` ne double-compte plus parent + enfants (somme limitée aux racines).
- **Wizard Sites — contacts persistés** : POST/PATCH/DELETE via `contactsApi` apres save (regression ADR-018 cible D corrigee). `Contact.isPrimary` ajoute au DTO.
- **PROJECT_STATUS** metriques re-mesurees (29 modules, 48 modeles Prisma, 22 enums, 273 endpoints, 18 ADRs).
- **Plan finalization v2** persiste (7 sessions vers v1.8.0).

### v1.6.0 (2026-04-28) — Refacto JSON residuel + Migrations versionnees + Monitoring natif
- **ADR-014 + ADR-016 (S2)** : sondes natives ICMP/HTTP/TCP, `MonitorTarget` + `MonitorCheck` source unique, fin du couplage Gatus / Uptime Kuma.
- **ADR-017 (S5)** : bascule `prisma db push` -> `prisma migrate deploy`. 5 migrations versionnees (`0_init` -> `5_site_json_cleanup`).
- **ADR-018 (S6/S7)** : refacto JSON residuel sur 4 cibles (Asset.networkInfo, Tenant.config, Site.healthBreakdown, Site cleanup) - 11 nouvelles tables typees, 3 enums, ~22 colonnes scalaires extraites.

### v1.5.0 (2026-04-26) — Securite hardening + Tests + Audit phase 5
- **ADR-015 (S1)** : rotation secrets, Redis auth, Multer magic-bytes, webhook signing.
- **S4** : 80 tests Jest backend (PermissionGuard, Throttler, Consumption, Webhook).
- **Audit phase 5** : correctifs P0 (notifications endpoints fail-closed, monitoring webhook public, user-delegations escalation), correctifs P1 (OIDC mapping right, PATCH delegations RequireManage), code mort retire (handleLegacy, AuthProvider, providers-legacy).

### v1.4.0 (2026-04-18) — Post audit + Apparence
- **Audit phase 4 + 5** : 3 critiques + 7 majeurs corriges (RBAC scope `/users`, gardes frontend `AccessGate`, OIDC mapping DelegationRight, webhook monitoring `@Public`, escalation user-delegations)
- **Feature Apparence (ADR-010)** : tenant defaults + user override avec verrou admin (`AppearanceProvider`)
- **Settings dans Personnel** : visible a tout utilisateur authentifie (Profil/Securite/Apparence/Notifications)
- **Labels FR centralises** : `rightLabel()`, `healthLabel()`, `siteStatusLabel()`
- **Seed demo enrichi** : 3 delegations, 8 sites, 6 users `@demo.fr`, AccessOverride ALLOW+DENY, Budget+Expense+CostAllocation, ConnectivityLink, UserNotification, AuditLog
- **Cleanup phase 5** : `AuthProvider` retire (-1 model, -1 enum), 2 endpoints providers-legacy retires, +1 `GET /notifications/config/:delegationId`

### v1.3.0 (2026-04-16) — Costs avances + Consumption + Search + Audit
- Enums dynamiques (`AssetType/AssetStatus/PinType` -> `String` via `EnumLabel`)
- Nouveaux modeles : `AssetModel`, `Budget`, `ConnectivityLink`, `UserNotification`
- 6 nouveaux modules backend : `asset-models`, `budgets`, `connectivity`, `consumption`, `search`, `audit`
- Projection mensuelle (eclatement MONTHLY/QUARTERLY/YEARLY) + endpoint `/api/expenses/projection`
- Frontend : `/dashboard/costs/budgets`, `/dashboard/consumption`, `/dashboard/notifications`, `/dashboard/admin/audit`, `GlobalSearch` (Cmd+K), `NotificationInbox`
- Notifications in-app + crons quotidiens (warranty + tasks due)
- Import CSV assets dry-run (`/api/assets/import/preview`)

### v1.2.0 (2026-04-08) — Delegation-first (ADR-009) + Repartition des couts
- Refactoring autorisation : suppression hierarchy 4 niveaux, modele `UserDelegation` source de verite
- `User.isSuperAdmin` + `AccessOverride` ALLOW/DENY par site
- Header `X-Delegation-Id` obligatoire sur requetes operationnelles
- `BillingEntity` + `Expense` + `CostAllocation` (refacturation, chargeback, rapports)

### v1.1.1 (2026-04-06)
- Systeme de notifications (Email SMTP + Microsoft Teams webhooks)
- Suppression utilisateur avec dialog confirmation
- Creation utilisateur dual-mode (directe ou invitation email)

### v1.1.0 (2026-04-05)
- Stabilisation pre-production (6 phases)
- Filtre exceptions global (Prisma errors → HTTP codes)
- Pagination serveur (8 modules)
- Import CSV assets
- Invitation email + mot de passe oublie
- 5x window.confirm() remplaces par AlertDialog
- Batch update assets
- Export Tasks + Contacts
- Nettoyage MinIO a la suppression
- Audit logs etendus

### v1.0.0-rc1 (2026-03-15)
- Export PDF plans Wi-Fi 4 quadrants
- Heatmap Wi-Fi (modele FSPL Friis)
- Monitoring Gatus + alertes (remplacé par la surveillance native ADR-016)
- Sauvegarde / Restauration completes
- Docker production optimise
- Scripts deploiement (package-release, install-airgap, backup/restore)

Historique complet : [CHANGELOG.md](CHANGELOG.md)

---

## License

MIT License - Voir [LICENSE](LICENSE)

---

**Developpe pour les equipes IT terrain**
