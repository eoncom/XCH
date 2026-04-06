# XCH - Gestion IT pour Chantiers Temporaires

**Version :** 1.1.1 | **Derniere mise a jour :** 2026-04-06

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)

> Application web full-stack de gestion IT pour chantiers temporaires — mono-delegation

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

### Notifications (v1.1.1)
- **Email SMTP** — envoi configurable (Nodemailer), templates HTML
- **Microsoft Teams** — webhooks Incoming avec Adaptive Cards
- **Configuration multi-scope** — heritage tenant > division > delegation avec override
- **7 types d'evenements** — tache assignee, changement statut, asset critique, alerte monitoring, invitation utilisateur, etc.
- **Page configuration UI** — onglets canaux/evenements/logs, test de canal integre

### Gestion utilisateurs (v1.1.1)
- **Suppression utilisateur** — depuis la liste (icone corbeille) ou la page d'edition (bouton rouge), avec dialog de confirmation
- **Portees d'acces enrichies** — noms des divisions/delegations/sites visibles (ex: "Sud-Ouest > Toulouse")
- **Creation dual-mode** — creation directe (mot de passe) ou invitation par email (avec fallback lien si SMTP indisponible)

### Integrations externes
- **NetBox** (READ-ONLY) — mapping sites/devices, enrichissement donnees
- **Gatus / Uptime Kuma** — sante services, alertes, dashboard monitoring
- **Import CSV assets** — endpoint multipart, headers FR/EN, validation ligne par ligne, rapport erreurs

### Securite & Permissions
- **Auth hybride** : locale (email/password) + OIDC (Microsoft Entra ID, Keycloak)
- **RBAC** : 4 roles (Admin, Manager, Technicien, Viewer) via Casbin
- **Invitation email** : token 72h, page `/invite` pour definir mot de passe
- **Mot de passe oublie** : token 1h, flux complet forgot/reset
- **Audit trail** complet : sites, assets, tasks, racks (create/update/delete/mount/unmount)

### Pagination serveur (v1.1.0)
- Tous les endpoints de liste sont pagines (page, pageSize, total, totalPages)
- 8 modules : assets, sites, tasks, contacts, expenses, racks, users, floor-plans
- Composant `<Pagination>` frontend avec selecteur taille page

### Sauvegarde / Restauration
- Backup complet (DB + fichiers MinIO) avec UI dans Parametres
- Restauration site individuel + restauration complete
- Nettoyage stockage orphelin (manuel + cron)

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
- **Prisma** (ORM type-safe, migrations)
- **Redis** (cache + sessions)
- **Casbin** (RBAC/ABAC policy-based)
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

# 3. Backend : installer + migrer + seeder
npm install
npx prisma migrate dev
npx prisma db seed

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

**Compte admin par defaut** :
- Email : `admin@xch.local`
- Mot de passe : `admin123`

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
docker compose -f docker-compose.prod.yml up -d --build
```

### Deploiement air-gapped

```bash
# Sur la machine de build (avec Internet)
bash scripts/package-release.sh v1.1.1

# Transferer l'archive, puis sur le serveur cible
tar xzf xch-v1.1.1-full.tar.gz
cd xch-release-v1.1.1
bash scripts/install-airgap.sh /opt/xch
```

### Mise a jour

```bash
cd /opt/xch
bash scripts/deploy-prod.sh                # Rebuild backend + frontend
bash scripts/deploy-prod.sh --backend-only  # Backend uniquement
bash scripts/deploy-prod.sh --frontend-only # Frontend uniquement
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
| `scripts/deploy-prod.sh` | Deploiement production local (git pull + build + restart + NPM restart) |
| `scripts/backup-full.sh` | Backup complet (DB + MinIO) |
| `scripts/restore-full.sh` | Restauration depuis backup |
| `scripts/package-release.sh` | Empaquetage archive portable pour deploiement air-gapped |
| `scripts/install-airgap.sh` | Installation sur serveur isole |
| `deploy.sh` | Script deploiement principal (racine) |
| `install.sh` | Installation zero-to-hero (3 modes) |
| `rollback.sh` | Rollback interactif avec option restauration DB |

### Scripts utiles developpement

```bash
# Backend
cd backend
npm run start:dev            # Hot-reload developpement
npm run build                # Build production
npx prisma migrate dev       # Migrations DB
npx prisma db seed           # Seed data
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
├── backend/                 # API NestJS
│   ├── src/
│   │   ├── modules/         # 10 modules metier
│   │   │   ├── auth/        # JWT + OIDC + invitation + reset password
│   │   │   ├── users/       # CRUD + suppression + scopes
│   │   │   ├── sites/       # Chantiers + PostGIS
│   │   │   ├── assets/      # Equipements + QR + import CSV
│   │   │   ├── racks/       # Baies 4U-42U
│   │   │   ├── tasks/       # Taches + Kanban
│   │   │   ├── floor-plans/ # Plans + pins + heatmap WiFi
│   │   │   ├── contacts/    # Contacts par site
│   │   │   ├── expenses/    # Couts + entites facturation
│   │   │   ├── integrations/# NetBox + monitoring
│   │   │   ├── notifications/ # Email + Teams
│   │   │   └── audit/       # Logs d'audit
│   │   ├── common/          # Guards, filters, interceptors, decorators
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma    # Schema DB (~20 modeles)
│   │   └── migrations/
│   └── docker-entrypoint.sh # Prisma migrate deploy + start
├── frontend/                # App Next.js 15
│   ├── src/
│   │   ├── app/dashboard/   # Pages (App Router)
│   │   ├── components/      # Composants React (shadcn/ui)
│   │   └── lib/             # Utils, hooks, API client
│   └── e2e/                 # Tests Playwright (57 tests)
├── scripts/                 # Scripts deploiement/backup
├── docker-compose.prod.yml  # Production Docker Compose
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

### v1.1.1 (2026-04-06)
- Systeme de notifications (Email SMTP + Microsoft Teams webhooks)
- Configuration multi-scope avec heritage
- Suppression utilisateur avec dialog confirmation
- Portees d'acces enrichies (noms divisions/delegations/sites)
- Creation utilisateur dual-mode (directe ou invitation email)
- Corrections: double prefixe API notifications, pagination getAll(), pageSize max 100

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
- Monitoring Gatus + alertes
- Sauvegarde / Restauration completes
- Docker production optimise
- Scripts deploiement (package-release, install-airgap, backup/restore)

Historique complet : [CHANGELOG.md](CHANGELOG.md)

---

## License

MIT License - Voir [LICENSE](LICENSE)

---

**Developpe pour les equipes IT terrain**
