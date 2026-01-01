# XCH - Gestion IT pour Chantiers Temporaires

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)
[![MVP](https://img.shields.io/badge/MVP-100%25-brightgreen)](LIVRAISON_MVP_100.md)

> Application web full-stack de gestion IT pour chantiers temporaires - Instance mono-délégation

---

## 📋 Vue d'ensemble

**XCH** est le hub centralisé pour toutes les informations IT des chantiers d'une délégation.

### Problème résolu

Les DSI de délégations gèrent des dizaines de chantiers temporaires avec infrastructure IT critique (réseau, connectivité, équipements). Les informations sont dispersées dans fichiers Excel, emails, outils spécialisés multiples. Les interventions terrain sont ralenties par manque d'accès rapide à l'information contextuelle.

### Solution

XCH centralise le contexte et référence les outils spécialisés (NetBox, monitoring, ticketing) sans les remplacer.

**Valeur ajoutée** :
- ✅ **Accès instantané** : Toute info chantier en 3 clics ou 1 scan QR
- ✅ **Mobile-first** : Interventions terrain fluides
- ✅ **Vue d'ensemble** : Carte temps réel de tous les chantiers et leur santé
- ✅ **Traçabilité** : Historique complet actions et modifications
- ✅ **Intégrations** : Connecte aux outils existants

---

## 🚀 Fonctionnalités principales

### Gestion Chantiers
- Référentiel complet (code, nom, adresse, GPS, contacts, connectivité)
- Carte interactive multi-chantiers avec clustering
- Santé chantier temps réel (monitoring intégré)
- Procédures coupure connectivité

### Inventaire Assets
- Gestion équipements : imprimantes, iPads, réseau, visio, caméras...
- QR codes sécurisés (génération + scan mobile)
- Recherche instantanée (modèle, S/N, fabricant)
- Actions groupées (export, changement statut)

### Gestion Baies (Racks)
- Création baies 4U à 42U
- Montage équipements avec positions U
- Visualisation schématique verticale
- Calcul occupation et espace libre
- Export schémas PDF

### Plans d'Étage
- Upload plans (PDF, PNG, JPG)
- Visionneuse interactive (zoom/pan)
- Éditeur pins (drag & drop)
- Association pins ↔ équipements
- Export plans annotés

### Tâches (Work Orders)
- CRUD tâches avec checklist
- Assignation utilisateurs
- Priorités et échéances
- TicketLink (référence ticket externe)
- Vues : Liste, Kanban, Calendrier

### Intégrations Externes
- **NetBox** (READ-ONLY) : Mapping sites/devices, enrichissement données
- **Uptime Kuma** : Récupération santé services, alertes
- **Extensible** : Architecture prête pour nouveaux connecteurs

### Sécurité & Permissions
- **Auth hybride** : Locale (email/password) + OIDC (Microsoft Entra ID, Keycloak...)
- **RBAC** : 4 rôles (Admin, Manager, Technicien, Viewer)
- **Casbin** : Moteur permissions policy-based
- **Audit trail** complet : Qui, Quoi, Quand

### Mobile (PWA)
- Progressive Web App installable
- Scan QR codes (caméra native)
- Upload photos terrain
- Mode offline basique

---

## 🛠️ Stack Technique

### Backend
- **NestJS 10+** (Node.js + TypeScript)
- **PostgreSQL 15** + **PostGIS** (géospatialisation)
- **Prisma** (ORM type-safe)
- **Redis** (cache + queue + sessions)
- **Casbin** (RBAC/ABAC)
- **Passport.js** (auth local + OIDC)

### Frontend
- **Next.js 15** (React 19 + TypeScript 5.7)
- **shadcn/ui** + **Tailwind CSS 3.4**
- **Zustand** (state management) + **TanStack Query** (data fetching)
- **Leaflet** (cartes interactives)
- **Konva.js** (plans interactifs + visualisation baies)
- **React Hook Form** + **Zod** (validation)

### Infrastructure
- **Docker** + **Docker Compose**
- **MinIO** (stockage S3-compatible)
- **Traefik** (reverse proxy + HTTPS)
- **GitLab CI** / **GitHub Actions** (CI/CD)

**Détails complets** : [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md)

---

## 📦 Installation

### Guides d'installation complets

- **🔧 [INSTALL_DEV.md](INSTALL_DEV.md)** - Installation complète environnement développement (Windows/WSL2)
  - Prérequis (Node.js, Docker, PostgreSQL, Redis)
  - Backend NestJS + Frontend Next.js 15
  - Configuration VS Code avec debugging
  - Troubleshooting développement (10+ scénarios)

- **🚀 [INSTALL_PROD.md](INSTALL_PROD.md)** - Déploiement production Linux (Ubuntu/Debian)
  - Sécurisation serveur (UFW, Fail2ban, SSH)
  - Docker avec isolation complète
  - Nginx reverse proxy + SSL/TLS (Let's Encrypt)
  - Backups automatisés PostgreSQL
  - Monitoring et health checks
  - Troubleshooting production (15+ scénarios)

- **🐳 [DOCKER_PORTS.md](DOCKER_PORTS.md)** - Gestion ports Docker et isolation
  - Architecture réseau Docker `xch-network`
  - Détection et résolution conflits de ports
  - Configuration multi-instances (dev, staging, prod)
  - Scripts de vérification automatique
  - Sécurité réseau (firewall, exposition minimale)

### Installation rapide (Développement)

```bash
# 1. Cloner le repository
git clone https://github.com/your-org/xch.git
cd xch

# 2. Backend : Démarrer infrastructure Docker
cd backend
docker-compose up -d

# 3. Backend : Installer dépendances
npm install

# 4. Backend : Migrations Prisma + seed
npx prisma migrate dev
npx prisma db seed

# 5. Frontend : Installer dépendances
cd ../frontend
npm install

# 6. Frontend : Générer icônes PWA
npm run generate-icons

# 7. Démarrer les serveurs de développement
# Terminal 1 (backend)
cd backend && npm run start:dev

# Terminal 2 (frontend)
cd frontend && npm run dev
```

**Accès application** :
- Frontend : http://localhost:3001
- Backend API : http://localhost:3000
- API Docs (Swagger) : http://localhost:3000/api

**Compte admin par défaut** :
- Email : `admin@xch.local`
- Password : `admin123` (⚠️ À changer immédiatement)

### Prérequis

#### Développement
- **Node.js** 18+ (LTS recommandé)
- **Docker** 24+ avec Docker Compose
- **PostgreSQL** 15 (via Docker recommandé)
- **Redis** 7 (via Docker recommandé)
- **MinIO** (via Docker)
- **RAM** : 8 GB minimum
- **Stockage** : 20 GB

#### Production
- **Serveur Linux** (Ubuntu 22.04+ ou Debian 12+)
- **Docker** 24+ avec Docker Compose
- **RAM** : 8 GB minimum (16 GB recommandé)
- **Stockage** : 100 GB minimum (SSD recommandé)
- **Ports** : 80 (HTTP), 443 (HTTPS), 22 (SSH)

### Installation production

Voir guide complet : **[INSTALL_PROD.md](INSTALL_PROD.md)**

---

## 📖 Documentation

**📚 [DOCS_INDEX.md](DOCS_INDEX.md)** - Index complet de toute la documentation (27 fichiers)

### Installation & Déploiement
- **[INSTALL_DEV.md](INSTALL_DEV.md)** - Installation développement Windows/WSL2 (6 600+ lignes)
- **[INSTALL_PROD.md](INSTALL_PROD.md)** - Déploiement production Linux (11 000+ lignes)
- **[DOCKER_PORTS.md](DOCKER_PORTS.md)** - Gestion ports Docker et isolation réseau (2 800+ lignes)

### Architecture & Décisions
- **[docs/architecture/tech-stack.md](docs/architecture/tech-stack.md)** - Stack technique complète avec justifications
- **[docs/architecture/database-schema.md](docs/architecture/database-schema.md)** - Schéma PostgreSQL (18 tables + ERD)
- **[docs/decisions/adr-001-stack-typescript.md](docs/decisions/adr-001-stack-typescript.md)** - Choix TypeScript full-stack
- **[docs/decisions/adr-002-multi-tenant-rls.md](docs/decisions/adr-002-multi-tenant-rls.md)** - Multi-tenant PostgreSQL RLS
- **[docs/decisions/adr-003-auth-oidc-hybrid.md](docs/decisions/adr-003-auth-oidc-hybrid.md)** - Auth hybride (JWT + SSO)
- **[docs/decisions/adr-004-rbac-casbin.md](docs/decisions/adr-004-rbac-casbin.md)** - RBAC avec Casbin (4 rôles)
- **[docs/decisions/adr-005-cicd-gitlab.md](docs/decisions/adr-005-cicd-gitlab.md)** - Pipeline CI/CD GitLab

### Développement
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Guide développement quotidien
- **[docs/roadmap.md](docs/roadmap.md)** - Roadmap et état d'avancement
- **[docs/cahier-des-charges.md](docs/cahier-des-charges.md)** - Spécifications fonctionnelles complètes
- **[CLAUDE.md](CLAUDE.md)** - Instructions pour agents Claude Code

### Frontend
- **[frontend/README.md](frontend/README.md)** - Documentation Next.js 15 spécifique
- **[frontend/public/ICONS_README.md](frontend/public/ICONS_README.md)** - Génération icônes PWA

### Livrables & Checkpoints
- **[LIVRAISON_MVP_100.md](LIVRAISON_MVP_100.md)** - Document de livraison MVP 100% complet ✅
- **[MVP_COMPLET.md](MVP_COMPLET.md)** - Récapitulatif technique MVP
- **[CHECKPOINT_BACKEND_FINAL.md](CHECKPOINT_BACKEND_FINAL.md)** - Validation backend (10 modules)
- **[CHECKPOINT_FRONTEND_FINAL.md](CHECKPOINT_FRONTEND_FINAL.md)** - Validation frontend (7 modules)

### Utilisation
- **Guide Utilisateur** - À venir (MVP livré)
- **Guide Administrateur** - À venir (MVP livré)

---

## 🏗️ Structure Projet

```
xch/
├── backend/                # API NestJS
│   ├── src/
│   │   ├── modules/       # Modules métier (sites, assets, racks...)
│   │   ├── common/        # Guards, interceptors, decorators
│   │   ├── config/        # Configuration app
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma  # Schéma DB
│   │   └── migrations/
│   └── test/
├── frontend/              # App Next.js
│   ├── app/               # Pages (App Router)
│   ├── components/        # Composants React
│   ├── lib/               # Utils, hooks, API client
│   └── public/
├── docker/                # Dockerfiles
├── docs/                  # Documentation
│   ├── architecture/
│   ├── decisions/
│   └── agents/
├── .gitlab-ci.yml         # Pipeline GitLab CI
├── .github/workflows/     # GitHub Actions
├── docker-compose.yml     # Services (dev)
├── docker-compose.prod.yml # Services (prod)
└── README.md
```

---

## 🧪 Tests

### Backend (NestJS)

```bash
# Tests unitaires
npm run test

# Tests intégration
npm run test:e2e

# Coverage
npm run test:cov
```

### Frontend (Next.js)

```bash
# Tests unitaires
npm run test

# Tests E2E (Playwright)
npm run test:e2e
```

**Coverage minimum** : 80%

---

## 🚢 Déploiement

### Production complète

Voir le guide complet : **[INSTALL_PROD.md](INSTALL_PROD.md)** (11 000+ lignes)

**Inclut :**
- ✅ Sécurisation serveur Linux (UFW firewall, Fail2ban, SSH)
- ✅ Installation Docker avec isolation réseau `xch-network`
- ✅ Configuration production (secrets sécurisés, ports personnalisés)
- ✅ Nginx reverse proxy avec SSL/TLS (Let's Encrypt)
- ✅ Backups automatisés PostgreSQL (cron, rétention 7 jours)
- ✅ Monitoring et health checks
- ✅ Procédures de mise à jour et rollback
- ✅ Troubleshooting production (15+ scénarios)

### Déploiement rapide (Production)

```bash
# 1. Préparer le serveur (Ubuntu 22.04+)
sudo apt update && sudo apt upgrade -y

# 2. Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 3. Cloner le projet
git clone https://github.com/your-org/xch.git
cd xch/backend

# 4. Configurer .env.production (secrets, ports)
cp .env.example .env.production
nano .env.production
# Générer secrets : openssl rand -base64 32

# 5. Démarrer Docker Compose
docker-compose --env-file .env.production up -d

# 6. Vérifier les conteneurs
docker ps

# 7. Migrations Prisma
docker-compose exec backend npx prisma migrate deploy

# 8. Configurer Nginx + SSL (voir INSTALL_PROD.md)
```

### Multi-instances (dev, staging, prod)

Voir guide complet : **[DOCKER_PORTS.md](DOCKER_PORTS.md)** section "Isolation multi-instances"

**Permet :**
- Plusieurs environnements XCH sur un seul serveur
- Ports personnalisés par instance (5432→5433→5434, etc.)
- Isolation réseau Docker complète
- Gestion via scripts automatisés

---

## 🔐 Sécurité

- **HTTPS obligatoire** (Let's Encrypt via Traefik)
- **Auth** : JWT tokens (access 15min + refresh 7j)
- **RBAC strict** : Casbin policies
- **PostgreSQL RLS** : Isolation multi-tenant
- **Secrets chiffrés** : Client secrets OIDC, env vars
- **Rate limiting** : API + login
- **Audit trail** : Toutes actions tracées
- **Scan vulnérabilités** : Trivy (images), Semgrep (code)

---

## 🤝 Contribution

Contributions bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md)

### Workflow

1. Fork le repo
2. Créer branche feature (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push branche (`git push origin feature/amazing-feature`)
5. Ouvrir Pull Request

### Standards

- **Code** : TypeScript strict mode, ESLint, Prettier
- **Tests** : Coverage > 80% pour nouvelles features
- **Commits** : Conventional Commits
- **Documentation** : Mettre à jour docs/ si architecture modifiée

---

## 📝 Changelog

### Version 1.0.0-MVP (2026-01-01) ✅ **PRODUCTION-READY**

**🎉 MVP 100% Complet - Livraison finale**

#### Backend (NestJS 10)
- ✅ 10 modules terminés (Auth, Users, Tenants, Sites, Assets, Racks, Tasks, FloorPlans, Integrations, Audit)
- ✅ 100+ endpoints REST documentés (Swagger)
- ✅ Authentification JWT + SSO OIDC (Microsoft Entra ID, Keycloak)
- ✅ RBAC Casbin avec 4 rôles (Admin, Manager, Technicien, Viewer)
- ✅ Multi-tenant PostgreSQL Row-Level Security (RLS)
- ✅ Intégrations NetBox + Uptime Kuma (READ-ONLY)
- ✅ Audit trail complet (actions tracées)

#### Frontend (Next.js 15)
- ✅ 7 modules terminés (Dashboard, Sites, Assets, Tasks, Racks, FloorPlans, Settings)
- ✅ 17 pages fonctionnelles
- ✅ Carte interactive Leaflet (clustering, filtres)
- ✅ QR codes génération + scanner caméra (@zxing/browser)
- ✅ Kanban drag & drop (Tasks avec checklist)
- ✅ Visualisation 2D baies Konva.js (mount/unmount équipements)
- ✅ Upload floor plans + pins éditables
- ✅ PWA manifest + icons (192x192, 512x512)
- ✅ Toast notifications (react-hot-toast)
- ✅ Error boundaries React

#### Infrastructure
- ✅ Docker Compose (PostgreSQL 15 + PostGIS, Redis 7, MinIO)
- ✅ Réseau Docker isolé `xch-network`
- ✅ Ports personnalisables via variables d'environnement
- ✅ Prisma migrations + seed data

#### Documentation
- ✅ INSTALL_DEV.md (6 600+ lignes) - Installation développement Windows/WSL2
- ✅ INSTALL_PROD.md (11 000+ lignes) - Déploiement production Linux
- ✅ DOCKER_PORTS.md (2 800+ lignes) - Gestion ports et isolation
- ✅ DOCS_INDEX.md - Index complet 27 fichiers documentation
- ✅ 5 ADR (Architecture Decision Records)
- ✅ Troubleshooting développement (10+ scénarios)
- ✅ Troubleshooting production (15+ scénarios)

**📦 Détails complets :** [LIVRAISON_MVP_100.md](LIVRAISON_MVP_100.md)

---

## 📄 License

MIT License - Voir [LICENSE](LICENSE) pour détails.

---

## 👥 Auteurs

- **Architecte Lead** - Architecture globale, coordination agents
- **Agents spécialisés Claude Code** - Développement modules

---

## 🙏 Remerciements

- **NestJS** pour l'excellent framework backend
- **Next.js** (Vercel) pour le framework React moderne
- **Prisma** pour l'ORM type-safe
- **Casbin** pour le moteur RBAC
- **Communauté open-source** pour les librairies utilisées

---

## 📞 Support

- **Issues** : [GitHub Issues](https://github.com/your-org/xch/issues)
- **Documentation** : [docs/](docs/)
- **Email** : support@xch.example.com

---

**Développé avec ❤️ pour les équipes IT terrain**
