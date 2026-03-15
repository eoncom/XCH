# Changelog XCH

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
