# XCH - Gestion IT pour Chantiers Temporaires

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://www.postgresql.org/)

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
- **Next.js 14** (React + TypeScript)
- **shadcn/ui** + **Tailwind CSS**
- **Leaflet** (cartes interactives)
- **Konva.js** (plans interactifs)
- **React Hook Form** + **Zod** (validation)

### Infrastructure
- **Docker** + **Docker Compose**
- **MinIO** (stockage S3-compatible)
- **Traefik** (reverse proxy + HTTPS)
- **GitLab CI** / **GitHub Actions** (CI/CD)

**Détails complets** : [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md)

---

## 📦 Installation

### Prérequis

- Docker 24+
- Docker Compose 2.20+
- 4 CPU, 8 GB RAM minimum
- 100 GB stockage

### Installation rapide (Développement)

```bash
# Cloner le repo
git clone https://github.com/your-org/xch.git
cd xch

# Copier configuration environnement
cp .env.example .env

# Éditer .env (DB passwords, JWT secret, etc.)
nano .env

# Démarrer tous les services
docker-compose up -d

# Attendre initialisation DB + migrations
docker-compose logs -f app

# Accès application
# https://localhost
```

**Compte admin par défaut** :
- Email : `admin@xch.local`
- Password : `admin` (à changer immédiatement)

### Installation production

Voir documentation complète : [INSTALLATION.md](INSTALLATION.md)

---

## 📖 Documentation

### Architecture & Décisions
- [Stack Technique](docs/architecture/tech-stack.md)
- [Schéma Base de Données](docs/architecture/database-schema.md)
- [ADR-001 : Stack TypeScript](docs/decisions/adr-001-stack-typescript.md)
- [ADR-002 : Multi-tenant RLS](docs/decisions/adr-002-multi-tenant-rls.md)
- [ADR-003 : Auth OIDC Hybride](docs/decisions/adr-003-auth-oidc-hybrid.md)
- [ADR-004 : RBAC Casbin](docs/decisions/adr-004-rbac-casbin.md)
- [ADR-005 : CI/CD GitLab](docs/decisions/adr-005-cicd-gitlab.md)

### Développement
- [Roadmap Développement](docs/roadmap.md)
- [Cahier des Charges](docs/cahier-des-charges.md)
- [Contributing Guide](CONTRIBUTING.md)

### Utilisation
- [Guide Utilisateur](docs/USER_GUIDE.md)
- [Guide Administrateur](docs/ADMIN_GUIDE.md)

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

### On-premise

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Démarrer services
docker-compose -f docker-compose.prod.yml up -d

# Migrations DB
docker-compose exec app npx prisma migrate deploy

# Vérifier santé
docker-compose ps
```

### Cloud (AWS, Azure, GCP)

Architecture Docker portable on-premise ↔ cloud.

Voir : [INSTALLATION.md](INSTALLATION.md) section Cloud

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

Voir [CHANGELOG.md](CHANGELOG.md) pour historique versions.

**Version actuelle** : 1.0.0-alpha (MVP en développement)

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
