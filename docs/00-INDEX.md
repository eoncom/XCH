# DOCS_INDEX.md - Index de la documentation XCH

**Date:** 2026-01-18
**Projet:** XCH - Gestion IT Chantiers Temporaires
**Version:** 1.0.3

---

## 📚 Table des matières

1. [Documentation principale](#documentation-principale)
2. [Installation & Déploiement](#installation--déploiement)
3. [Architecture & Décisions techniques](#architecture--décisions-techniques)
4. [Guides de développement](#guides-de-développement)
5. [Checkpoints & Livrables](#checkpoints--livrables)
6. [Documentation par module](#documentation-par-module)
7. [Navigation rapide](#navigation-rapide)

---

## Documentation principale

### README.md
**📍 Chemin:** [`README.md`](README.md)
**📝 Description:** Documentation principale du projet XCH
**🎯 Audience:** Tous
**📋 Contient:**
- Présentation du projet
- Stack technique complète
- Structure du projet
- Liens vers la documentation détaillée

### CLAUDE.md
**📍 Chemin:** [`CLAUDE.md`](CLAUDE.md)
**📝 Description:** Instructions pour l'agent Claude Code (lead technique)
**🎯 Audience:** Équipe développement, Agents IA
**📋 Contient:**
- Contexte et rôle de l'architecte
- Règles de travail et autonomie décisionnelle
- Workflow de développement par phases
- Gestion des agents spécialisés
- Contraintes MVP non-négociables

### CHANGELOG.md
**📍 Chemin:** [`CHANGELOG.md`](CHANGELOG.md)
**📝 Description:** Journal des modifications du projet (format Keep a Changelog)
**🎯 Audience:** Tous
**📋 Contient:**
- v1.0.3 (2026-01-18): SSL Production + Auth Cross-Domain
- v1.0.2 (2026-01-17): CI/CD GitHub Actions
- v1.0.1 (2026-01-13): Tests E2E Playwright
- v1.0.0 (2026-01-01): MVP Complet Production-Ready
- Versions antérieures (0.3.0 → 0.1.0)

---

## Installation & Déploiement

### installation/INSTALL_DEV.md
**📍 Chemin:** [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md)
**📝 Description:** Guide complet d'installation en environnement de développement
**🎯 Audience:** Développeurs
**📋 Contient:**
- Prérequis Windows/WSL2
- Installation backend (NestJS + Docker Compose)
- Installation frontend (Next.js 15)
- Configuration VS Code avec debugging
- Workflow quotidien de développement
- Troubleshooting développement (10+ scénarios)

**🔑 Sections clés:**
- ✅ PostgreSQL + Redis + MinIO via Docker
- ✅ Prisma migrations & seed data
- ✅ Variables d'environnement `.env` détaillées
- ✅ Hot-reload backend et frontend
- ✅ Génération PWA icons

### installation/INSTALL_PROD.md
**📍 Chemin:** [`installation/INSTALL_PROD.md`](installation/INSTALL_PROD.md)
**📝 Description:** Guide complet de déploiement en production Linux
**🎯 Audience:** DevOps, Administrateurs système
**📋 Contient:**
- Prérequis serveur Linux (Ubuntu 22.04+)
- Sécurisation serveur (UFW firewall, Fail2ban, SSH)
- Installation Docker & Docker Compose
- Gestion des conflits de ports
- Configuration production (secrets, SSL/TLS)
- Reverse proxy Nginx avec Let's Encrypt
- Backups automatisés PostgreSQL
- Monitoring et health checks
- Procédures de mise à jour et rollback
- Troubleshooting production (15+ scénarios)

**🔑 Sections clés:**
- ✅ Génération secrets sécurisés (openssl)
- ✅ Isolation Docker complète (réseaux, volumes, conteneurs)
- ✅ Ports personnalisables via variables d'environnement
- ✅ SSL/TLS avec certbot (auto-renewal)
- ✅ PM2 et systemd pour gestion processus

### installation/DOCKER_PORTS.md
**📍 Chemin:** [`installation/DOCKER_PORTS.md`](installation/DOCKER_PORTS.md)
**📝 Description:** Guide exhaustif sur la gestion des ports Docker et l'isolation
**🎯 Audience:** DevOps, Développeurs
**📋 Contient:**
- Architecture réseau Docker XCH
- Liste complète des ports (par défaut + personnalisés)
- Détection des conflits de ports (netstat, ss, lsof)
- Configuration ports via variables d'environnement
- Isolation multi-instances (dev, staging, prod)
- Sécurité réseau (firewall, bind localhost)
- Scripts de vérification automatique
- Troubleshooting ports (8+ problèmes courants)
- Exemples de scénarios (5 cas réels)

**🔑 Sections clés:**
- ✅ Scripts `check-ports.sh`, `find-free-ports.sh`
- ✅ Schéma réseau Docker `xch-network`
- ✅ Configuration multi-instances sur même serveur
- ✅ Firewall UFW pour bloquer ports internes

---

## Architecture & Décisions techniques

### Cahier des charges
**📍 Chemin:** [`business/CAHIER_DES_CHARGES.md`](business/CAHIER_DES_CHARGES.md)
**📝 Description:** Spécifications fonctionnelles complètes du projet
**🎯 Audience:** Product Owner, Équipe développement
**📋 Contient:**
- Contexte et objectifs du projet
- Fonctionnalités détaillées par module (7 modules)
- Exigences techniques (performance, sécurité, mobile-first)
- Contraintes et hors-scope
- Roadmap fonctionnelle

### Tech Stack
**📍 Chemin:** [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md)
**📝 Description:** Documentation complète de la stack technique choisie
**🎯 Audience:** Développeurs, Architectes
**📋 Contient:**
- Backend: NestJS 10, Prisma 5.8, PostgreSQL 15 + PostGIS
- Frontend: Next.js 15, React 19, TypeScript 5.7
- Infrastructure: Docker Compose, Redis, MinIO
- Librairies clés avec versions et justifications

### Database Schema
**📍 Chemin:** [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md)
**📝 Description:** Schéma complet de la base de données PostgreSQL
**🎯 Audience:** Développeurs Backend, DBA
**📋 Contient:**
- Diagramme ERD (Entity-Relationship Diagram)
- 18 tables avec colonnes détaillées
- Relations et clés étrangères
- Index et contraintes
- Multi-tenant avec Row-Level Security (RLS)
- Types PostGIS (Point, Polygon)

### Architecture Decision Records (ADR)

#### ADR-001: Stack TypeScript
**📍 Chemin:** [`docs/decisions/adr-001-stack-typescript.md`](docs/decisions/adr-001-stack-typescript.md)
**📝 Décision:** Utilisation de TypeScript full-stack (NestJS + Next.js)
**📅 Date:** 2024-12-XX
**✅ Statut:** Accepté

#### ADR-002: Multi-tenant RLS
**📍 Chemin:** [`docs/decisions/adr-002-multi-tenant-rls.md`](docs/decisions/adr-002-multi-tenant-rls.md)
**📝 Décision:** Implémentation multi-tenant via PostgreSQL Row-Level Security
**📅 Date:** 2024-12-XX
**✅ Statut:** Accepté

#### ADR-003: Auth OIDC Hybride
**📍 Chemin:** [`docs/decisions/adr-003-auth-oidc-hybrid.md`](docs/decisions/adr-003-auth-oidc-hybrid.md)
**📝 Décision:** Authentification hybride (JWT local + SSO OIDC optionnel)
**📅 Date:** 2024-12-XX
**✅ Statut:** Accepté

#### ADR-004: RBAC Casbin (⚠️ Superseded by ADR-009)
**📍 Chemin:** [`docs/decisions/adr-004-rbac-casbin.md`](docs/decisions/adr-004-rbac-casbin.md)
**📝 Décision:** Gestion des permissions avec Casbin (4 rôles)
**📅 Date:** 2024-12-XX
**⛔ Statut:** Obsolète — Casbin a été retiré en v1.3 (cf. ADR-009 `delegation-first-model`). Le module `casbin/`, la table `casbinRule` et l'enum `UserRole` ne font plus partie du code. Document conservé pour historique uniquement.

#### ADR-005: CI/CD GitLab
**📍 Chemin:** [`docs/decisions/adr-005-cicd-gitlab.md`](docs/decisions/adr-005-cicd-gitlab.md)
**📝 Décision:** Pipeline CI/CD avec GitLab CI
**📅 Date:** 2024-12-XX
**✅ Statut:** Accepté

#### ADR-006 → ADR-013

Décisions intermédiaires (Docker network, E2E Playwright, fix SSR/CSR cookies,
delegation-first model, Apparence, inline expense creation, Gatus
bidirectional, JSON debt baseline). Voir [`docs/decisions/`](docs/decisions/).

#### ADR-014: Monitoring natif (S2)
**📍 Chemin:** [`docs/decisions/adr-014-native-monitoring.md`](docs/decisions/adr-014-native-monitoring.md)
**📝 Décision:** Probes ICMP/HTTP/TCP natives (BullMQ + cron) — fin du couplage Uptime Kuma / Gatus.
**📅 Date:** 2026-04-23
**✅ Statut:** Accepté

#### ADR-015: Sécurité hardening (S1)
**📍 Chemin:** [`docs/decisions/adr-015-s1-security-hardening.md`](docs/decisions/adr-015-s1-security-hardening.md)
**📝 Décision:** Rotation secrets, Redis auth, Multer magic-bytes, webhook signing.
**📅 Date:** 2026-04-22
**✅ Statut:** Accepté

#### ADR-016: Unification du monitoring
**📍 Chemin:** [`docs/decisions/adr-016-monitoring-unification.md`](docs/decisions/adr-016-monitoring-unification.md)
**📝 Décision:** `MonitorTarget` + `MonitorCheck` deviennent la source unique de statut runtime (link/SDWAN/asset).
**📅 Date:** 2026-04-25
**✅ Statut:** Accepté

#### ADR-017: Migrations Prisma versionnées (S5)
**📍 Chemin:** [`docs/decisions/adr-017-prisma-versioned-migrations.md`](docs/decisions/adr-017-prisma-versioned-migrations.md)
**📝 Décision:** Bascule `prisma db push` → `prisma migrate deploy`. Forward-only, pas de revert auto.
**📅 Date:** 2026-04-27
**✅ Statut:** Accepté

#### ADR-018: Refacto JSON résiduel (S6/S7)
**📍 Chemin:** [`docs/decisions/adr-018-json-debt-cleanup.md`](docs/decisions/adr-018-json-debt-cleanup.md)
**📝 Décision:** 4 cibles (Asset.networkInfo, Tenant.config, Site.healthBreakdown, Site cleanup) — 11 nouvelles tables typées, 5 migrations versionnées.
**📅 Date:** 2026-04-28
**✅ Statut:** Accepté (livré v1.6.0)

#### ADR-019: Chiffrement secrets at-rest (Session 2)
**📍 Chemin:** [`docs/decisions/adr-019-secrets-at-rest-encryption.md`](docs/decisions/adr-019-secrets-at-rest-encryption.md)
**📝 Décision:** AES-256-GCM applicatif (XCH_MASTER_KEY 32 bytes), 4 cibles (clientSecret SSO, netboxToken, totpSecret, teams.webhookUrl) + bonus hash SHA-256 invite/reset tokens.
**📅 Date:** 2026-04-29
**✅ Statut:** Accepté (livré v1.6.2)

### Roadmap
**📍 Chemin:** [`status/ROADMAP.md`](status/ROADMAP.md)
**📝 Description:** Planification détaillée du développement par phases
**🎯 Audience:** Chef de projet, Équipe développement
**📋 Contient:**
- ✅ Phase 1: Architecture & Backend Core (TERMINÉ)
- ✅ Phase 2: Modules métier backend (TERMINÉ)
- ✅ Phase 3: Frontend MVP (TERMINÉ)
- État d'avancement global
- Prochaines étapes

---

## Guides de développement

### guides/DEVELOPMENT_GUIDE.md
**📍 Chemin:** [`guides/DEVELOPMENT_GUIDE.md`](guides/DEVELOPMENT_GUIDE.md)
**📝 Description:** Guide pratique pour le développement quotidien
**🎯 Audience:** Développeurs
**📋 Contient:**
- Structure du code backend et frontend
- Conventions de code (ESLint, Prettier)
- Patterns de développement (guards, decorators, hooks)
- Workflow Git (branches, commits, PR)
- Tests (unitaires, e2e, intégration)
- Debugging (VS Code, logs, breakpoints)

### DEVELOPMENT_STATUS.md
**📍 Chemin:** [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md)
**📝 Description:** État d'avancement détaillé du développement
**🎯 Audience:** Chef de projet, Product Owner
**📋 Contient:**
- Modules backend terminés (10/10)
- Modules frontend terminés (7/7)
- Fonctionnalités livrées vs planifiées
- Métriques (100+ endpoints, 17 pages, 40+ composants)

### Plan Frontend
**📍 Chemin:** [`docs/PLAN_FRONTEND.md`](docs/PLAN_FRONTEND.md)
**📝 Description:** Plan détaillé de développement frontend
**🎯 Audience:** Développeurs Frontend
**📋 Contient:**
- Architecture Next.js 15 (App Router)
- Modules par phase (Auth, Dashboard, Sites, Assets, Tasks, Racks, FloorPlans)
- Composants UI (shadcn/ui)
- State management (Zustand + TanStack Query)
- Intégrations (Leaflet, Konva.js, QR scanner)

### guides/NGINX_PROXY_PRODUCTION.md
**📍 Chemin:** [`guides/NGINX_PROXY_PRODUCTION.md`](guides/NGINX_PROXY_PRODUCTION.md)
**📝 Description:** Guide configuration Nginx Proxy Manager pour production SSL
**🎯 Audience:** DevOps, Administrateurs Système
**📋 Contient:**
- Configuration certificat SSL wildcard `*.eoncom.io`
- Création Proxy Hosts (frontend + backend)
- Force SSL + HTTP/2 + HSTS
- Websockets Support + Block Exploits
- Validation déploiement HTTPS

### guides/PWA_ICONS_SETUP.md
**📍 Chemin:** [`guides/PWA_ICONS_SETUP.md`](guides/PWA_ICONS_SETUP.md)
**📝 Description:** Guide génération icônes PWA (Progressive Web App)
**🎯 Audience:** Développeurs Frontend
**📋 Contient:**
- 4 solutions génération icônes (ImageMagick, Script bash, Services en ligne, Canvas HTML)
- Tailles requises PWA (192x192px, 512x512px)
- Procédure déploiement production
- Validation icônes accessibles

---

## Systèmes d'automatisation

### automation/AUTO_DOCUMENTATION.md
**📍 Chemin:** [`automation/AUTO_DOCUMENTATION.md`](automation/AUTO_DOCUMENTATION.md)
**📝 Description:** Système automatique de mise à jour de la documentation
**🎯 Audience:** Développeurs, Lead Technique
**✅ Statut:** Actif et fonctionnel (2026-01-18)
**📋 Contient:**
- Mise à jour automatique via Git hook pre-commit
- PROJECT_STATUS.md timestamp auto-updaté
- DEVELOPMENT_LOG.md entrées ajoutées automatiquement (≥3 fichiers)
- Script: `scripts/auto-update-docs.sh`
- Hook: `.git/hooks/pre-commit`
- Usage: `git commit` → met automatiquement à jour la documentation
- **Aucune action manuelle requise - Plus besoin de rappeler**

**🔑 Avantages:**
- ✅ Mise à jour automatique à chaque commit code
- ✅ Documentation toujours synchronisée avec le code
- ✅ Timestamp PROJECT_STATUS.md toujours à jour
- ✅ Historique DEVELOPMENT_LOG.md complet automatiquement
- ✅ Désactivable temporairement: `git commit --no-verify`
- ✅ Pas besoin de dire "mets à jour la doc" ou "fais un commit"

**📝 Commit:** 2144d0b - feat(automation): Add automatic documentation update system

### automation/AUTO_PWA_ICONS.md
**📍 Chemin:** [`automation/AUTO_PWA_ICONS.md`](automation/AUTO_PWA_ICONS.md)
**📝 Description:** Système automatique de génération des icônes PWA
**🎯 Audience:** Développeurs, DevOps
**✅ Statut:** Actif et fonctionnel (2026-01-18)
**📋 Contient:**
- Génération automatique via prebuild hook
- 5 icônes PNG générées automatiquement (192px, 512px, 180px, 32px, 16px)
- Source unique: `frontend/public/icon.svg`
- Script: `frontend/scripts/generate-pwa-icons.js`
- Technologies: sharp library (Node.js)
- Usage: `npm run build` → génère automatiquement les icônes
- **Aucune action manuelle requise**

**🔑 Avantages:**
- ✅ Génération automatique à chaque build
- ✅ Icônes toujours synchronisées avec icon.svg
- ✅ Qualité uniforme garantie
- ✅ Résout les erreurs 404 PWA manifest
- ✅ Pas besoin de rappeler la génération

**📝 Commit:** 9cdbf31 - feat(pwa): Add automatic PWA icons generation system

### Status: AUTO_PROGRESS_REPORT.md
**📍 Chemin:** [`status/AUTO_PROGRESS_REPORT.md`](status/AUTO_PROGRESS_REPORT.md)
**📝 Description:** Rapport de progression automatique généré par GitHub Actions
**🎯 Audience:** Chef de projet, Équipe
**✅ Statut:** Actif (workflow auto-doc-update.yml)
**📋 Contient:**
- Statistiques code actuelles (lignes backend/frontend, tests E2E)
- Changements récents (7 derniers jours par module)
- Top 20 fichiers récemment modifiés
- Contributeurs actifs (30 derniers jours)
- Activité par jour (7 derniers jours)
- Mis à jour automatiquement chaque push sur main/develop
- **Génération automatique quotidienne (cron 2h UTC)**

**🔑 Avantages:**
- ✅ Rapport toujours à jour sans intervention manuelle
- ✅ Métriques objectives sur progression
- ✅ Historique activité développement
- ✅ Pas besoin de créer rapports manuellement

**📝 Workflow:** .github/workflows/auto-doc-update.yml

---

## Sessions de développement

### sessions/session-13-ssl-deployment.md
**📍 Chemin:** [`sessions/session-13-ssl-deployment.md`](sessions/session-13-ssl-deployment.md)
**📝 Description:** Session 13 - SSL Production Deployment (2026-01-17/18)
**🎯 Audience:** DevOps, Lead Technique
**📋 Contient:**
- Configuration Nginx Proxy Manager
- Docker Compose production
- Variables environnement HTTPS
- Tests validation SSL
- Problèmes identifiés (cookies cross-domain)

### sessions/session-14-auth-cookies.md
**📍 Chemin:** [`sessions/session-14-auth-cookies.md`](sessions/session-14-auth-cookies.md)
**📝 Description:** Session 14 - Auth Cross-Domain Cookies Fix (2026-01-18)
**🎯 Audience:** Développeurs Backend/Frontend, Lead Technique
**📋 Contient:**
- Diagnostic problème cookies cross-subdomain
- Solution: domain `.eoncom.io` dans tous cookies
- Middleware Next.js désactivé (incompatibilité SSR)
- Auth client-side avec `checkSession()`
- Tests validation complète

---

## Checkpoints & Livrables

### LIVRAISON_MVP_100.md
**📍 Chemin:** [`LIVRAISON_MVP_100.md`](LIVRAISON_MVP_100.md)
**📝 Description:** Document de livraison finale MVP 100% complet
**🎯 Audience:** Client, Product Owner
**📋 Contient:**
- ✅ Récapitulatif des 7 modules livrés
- ✅ 100+ endpoints API documentés
- ✅ 17 pages frontend fonctionnelles
- ✅ Toutes les features MVP (auth, RBAC, QR codes, maps, Kanban, racks, floor plans)
- ✅ PWA ready avec manifest et icons
- ✅ Tests et documentation
- 📦 Instructions d'installation et déploiement

### MVP_COMPLET.md
**📍 Chemin:** [`MVP_COMPLET.md`](MVP_COMPLET.md)
**📝 Description:** Récapitulatif technique du MVP complet
**🎯 Audience:** Équipe technique
**📋 Contient:**
- Synthèse backend (10 modules NestJS)
- Synthèse frontend (7 modules Next.js)
- Fonctionnalités clés implémentées
- Métriques de qualité (TypeScript strict, tests, error handling)

### LIVRAISON_FINALE.md
**📍 Chemin:** [`LIVRAISON_FINALE.md`](LIVRAISON_FINALE.md)
**📝 Description:** Document de livraison initial (version antérieure)
**🎯 Audience:** Archive
**📋 Contient:**
- Historique du développement
- Livraisons intermédiaires

### Checkpoints Backend

#### archive/backend/backend-checkpoint-MODULES_1-4.md
**📍 Chemin:** [`archive/backend/backend-checkpoint-MODULES_1-4.md`](archive/backend/backend-checkpoint-MODULES_1-4.md)
**📝 Description:** Validation modules backend 1 à 4
**📅 Date:** Phase 1
**📋 Contient:**
- ✅ Module Auth (JWT, RBAC, SSO)
- ✅ Module Users & Tenants
- ✅ Module Sites
- ✅ Module Assets

#### archive/backend/backend-checkpoint-MODULES_6-8.md
**📍 Chemin:** [`backend/archive/backend/backend-checkpoint-MODULES_6-8.md`](backend/archive/backend/backend-checkpoint-MODULES_6-8.md)
**📝 Description:** Validation modules backend 6 à 8
**📅 Date:** Phase 2
**📋 Contient:**
- ✅ Module Tasks (avec TicketLink)
- ✅ Module Racks (baies 4U-42U)
- ✅ Module FloorPlans (upload + pins)

#### archive/backend/backend-checkpoint-BACKEND_FINAL.md
**📍 Chemin:** [`archive/backend/backend-checkpoint-BACKEND_FINAL.md`](archive/backend/backend-checkpoint-BACKEND_FINAL.md)
**📝 Description:** Validation finale backend complet
**📅 Date:** Fin Phase 2
**📋 Contient:**
- ✅ 10 modules terminés
- ✅ 100+ endpoints REST
- ✅ Authentification JWT + SSO
- ✅ RBAC avec 4 rôles
- ✅ Multi-tenant RLS
- ✅ Intégrations NetBox + monitoring

### Checkpoints Frontend

#### archive/backend/backend-checkpoint-FRONTEND_PHASE1.md
**📍 Chemin:** [`archive/backend/backend-checkpoint-FRONTEND_PHASE1.md`](archive/backend/backend-checkpoint-FRONTEND_PHASE1.md)
**📝 Description:** Validation Phase 1 frontend
**📅 Date:** Phase 3
**📋 Contient:**
- ✅ Auth (login local + SSO)
- ✅ Dashboard avec stats
- ✅ Liste sites avec carte Leaflet

#### archive/backend/backend-checkpoint-FRONTEND_FINAL.md
**📍 Chemin:** [`archive/backend/backend-checkpoint-FRONTEND_FINAL.md`](archive/backend/backend-checkpoint-FRONTEND_FINAL.md)
**📝 Description:** Validation finale frontend complet
**📅 Date:** Fin Phase 3
**📋 Contient:**
- ✅ 7 modules (Dashboard, Sites, Assets, Tasks, Racks, FloorPlans, Settings)
- ✅ 17 pages fonctionnelles
- ✅ Carte interactive Leaflet
- ✅ QR codes scanner
- ✅ Kanban drag & drop
- ✅ Visualisation 2D baies (Konva.js)
- ✅ Upload floor plans avec pins
- ✅ PWA manifest + icons

#### PROJECT_STATUS_FINAL.md
**📍 Chemin:** [`PROJECT_STATUS_FINAL.md`](PROJECT_STATUS_FINAL.md)
**📝 Description:** État final du projet (toutes phases)
**📅 Date:** 2026-01-01
**📋 Contient:**
- ✅ Backend 100%
- ✅ Frontend 100%
- ✅ Documentation 100%
- ✅ Production-ready

---

## Documentation par module

### Frontend

#### Frontend README
**📍 Chemin:** [`frontend/README.md`](frontend/README.md)
**📝 Description:** Documentation spécifique du frontend Next.js
**🎯 Audience:** Développeurs Frontend
**📋 Contient:**
- Stack technique frontend (Next.js 15, React 19, TypeScript 5.7)
- Structure du projet frontend
- Installation et configuration
- Scripts disponibles (dev, build, start, generate-icons)
- Modules implémentés (7/7)
- State management (Zustand + TanStack Query)
- API Client avec gestion JWT
- Prochaines étapes (déjà toutes terminées)

#### PWA Icons README
**📍 Chemin:** [`frontend/public/ICONS_README.md`](frontend/public/ICONS_README.md)
**📝 Description:** Guide pour générer les icônes PWA
**🎯 Audience:** Développeurs Frontend
**📋 Contient:**
- Script `generate-icons.js` (conversion SVG → PNG)
- Tailles requises (192x192, 512x512)
- Intégration manifest.json
- Troubleshooting génération icons

---

## Navigation rapide

### Par cas d'usage

#### "Je veux installer XCH en développement"
→ [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md)

#### "Je veux déployer XCH en production"
→ [`installation/INSTALL_PROD.md`](installation/INSTALL_PROD.md)

#### "J'ai un conflit de port Docker"
→ [`installation/DOCKER_PORTS.md`](installation/DOCKER_PORTS.md)

#### "Je veux comprendre l'architecture technique"
→ [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md)
→ [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md)

#### "Je veux voir les spécifications fonctionnelles"
→ [`business/CAHIER_DES_CHARGES.md`](business/CAHIER_DES_CHARGES.md)

#### "Je veux contribuer au code"
→ [`guides/DEVELOPMENT_GUIDE.md`](guides/DEVELOPMENT_GUIDE.md)
→ [`CLAUDE.md`](CLAUDE.md)

#### "Je veux vérifier ce qui a été livré"
→ [`LIVRAISON_MVP_100.md`](LIVRAISON_MVP_100.md)
→ [`MVP_COMPLET.md`](MVP_COMPLET.md)

#### "Je veux comprendre les décisions d'architecture"
→ [`docs/decisions/`](docs/decisions/) (5 ADR)

#### "Je veux voir la roadmap"
→ [`status/ROADMAP.md`](status/ROADMAP.md)

### Par rôle

#### Chef de projet / Product Owner
1. [`business/CAHIER_DES_CHARGES.md`](business/CAHIER_DES_CHARGES.md) - Spécifications
2. [`LIVRAISON_MVP_100.md`](LIVRAISON_MVP_100.md) - Livrable final
3. [`status/ROADMAP.md`](status/ROADMAP.md) - Planification
4. [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md) - État avancement

#### Développeur Backend
1. [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md) - Installation dev
2. [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md) - Schéma DB
3. [`guides/DEVELOPMENT_GUIDE.md`](guides/DEVELOPMENT_GUIDE.md) - Conventions code
4. [`archive/backend/backend-checkpoint-BACKEND_FINAL.md`](archive/backend/backend-checkpoint-BACKEND_FINAL.md) - Backend complet

#### Développeur Frontend
1. [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md) - Installation dev
2. [`frontend/README.md`](frontend/README.md) - Doc frontend
3. [`docs/PLAN_FRONTEND.md`](docs/PLAN_FRONTEND.md) - Plan frontend
4. [`archive/backend/backend-checkpoint-FRONTEND_FINAL.md`](archive/backend/backend-checkpoint-FRONTEND_FINAL.md) - Frontend complet

#### DevOps / Administrateur système
1. [`installation/INSTALL_PROD.md`](installation/INSTALL_PROD.md) - Déploiement production
2. [`installation/DOCKER_PORTS.md`](installation/DOCKER_PORTS.md) - Gestion ports Docker
3. [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) - Stack complète
4. [`docs/decisions/adr-005-cicd-gitlab.md`](docs/decisions/adr-005-cicd-gitlab.md) - CI/CD

#### Architecte / Tech Lead
1. [`CLAUDE.md`](CLAUDE.md) - Vision architecturale
2. [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) - Stack technique
3. [`docs/decisions/`](docs/decisions/) - ADR (5 décisions)
4. [`MVP_COMPLET.md`](MVP_COMPLET.md) - Vue d'ensemble MVP

---

## Statistiques de la documentation

### Fichiers totaux
- **27 fichiers Markdown** au total
- **3 guides d'installation** (DEV, PROD, DOCKER_PORTS)
- **5 ADR** (Architecture Decision Records)
- **8 checkpoints** de validation
- **2 documents de livraison** (MVP_COMPLET, LIVRAISON_MVP_100)

### Lignes de documentation
- **installation/INSTALL_DEV.md**: ~6 600 lignes
- **installation/INSTALL_PROD.md**: ~11 000 lignes
- **installation/DOCKER_PORTS.md**: ~2 800 lignes
- **Total guides installation**: ~20 400 lignes

### Couverture documentation
- ✅ **Installation**: 100% (dev + prod + Docker)
- ✅ **Architecture**: 100% (stack, DB, ADR)
- ✅ **Développement**: 100% (guide, conventions, workflow)
- ✅ **Déploiement**: 100% (prod, backups, SSL, firewall)
- ✅ **Troubleshooting**: 30+ scénarios documentés
- ✅ **Sécurité**: Complète (secrets, firewall, SSL, isolation)

---

## Maintenance de la documentation

### Mises à jour régulières

**À jour automatiquement:**
- `README.md` - Présentation projet
- `status/ROADMAP.md` - État avancement
- `DEVELOPMENT_STATUS.md` - Métriques développement

**À mettre à jour manuellement:**
- `installation/INSTALL_DEV.md` - Si changement stack ou workflow dev
- `installation/INSTALL_PROD.md` - Si nouveaux prérequis ou procédures
- `installation/DOCKER_PORTS.md` - Si nouveaux services Docker
- `docs/architecture/tech-stack.md` - Si mise à jour versions majeures
- `docs/architecture/database-schema.md` - Si modifications schéma DB

### Processus de mise à jour

1. **Modification technique** → Mettre à jour doc concernée dans les 24h
2. **Nouvelle fonctionnalité** → Créer/compléter checkpoint + LIVRAISON
3. **Décision architecture** → Créer nouveau ADR dans `docs/decisions/`
4. **Nouvelle version** → Mettre à jour `LIVRAISON_MVP_XXX.md`

### Contact

**📧 Questions sur la documentation:**
Consultez d'abord ce fichier `DOCS_INDEX.md`, puis les fichiers spécifiques listés.

**🐛 Documentation manquante ou obsolète:**
Créer une issue GitHub avec le label `documentation`.

---

## Checklist d'utilisation

### Je débute sur le projet

- [ ] Lire [`README.md`](README.md) - Vue d'ensemble
- [ ] Lire [`business/CAHIER_DES_CHARGES.md`](business/CAHIER_DES_CHARGES.md) - Comprendre les specs
- [ ] Lire [`docs/architecture/tech-stack.md`](docs/architecture/tech-stack.md) - Stack technique
- [ ] Suivre [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md) - Installer environnement dev
- [ ] Lire [`guides/DEVELOPMENT_GUIDE.md`](guides/DEVELOPMENT_GUIDE.md) - Conventions code
- [ ] Consulter [`LIVRAISON_MVP_100.md`](LIVRAISON_MVP_100.md) - Comprendre ce qui est livré

### Je déploie en production

- [ ] Lire [`installation/INSTALL_PROD.md`](installation/INSTALL_PROD.md) intégralement (11 000 lignes)
- [ ] Consulter [`installation/DOCKER_PORTS.md`](installation/DOCKER_PORTS.md) - Gestion ports
- [ ] Exécuter scripts de vérification (`check-ports.sh`, `check-all-ports.sh`)
- [ ] Configurer firewall UFW selon guide
- [ ] Configurer Nginx + SSL/TLS avec Let's Encrypt
- [ ] Mettre en place backups automatisés PostgreSQL
- [ ] Tester depuis l'extérieur (nmap, curl)

### Je résous un problème

- [ ] Consulter section **Troubleshooting** du guide concerné:
  - Problème développement → [`installation/INSTALL_DEV.md`](installation/INSTALL_DEV.md#troubleshooting)
  - Problème production → [`installation/INSTALL_PROD.md`](installation/INSTALL_PROD.md#troubleshooting)
  - Problème ports Docker → [`installation/DOCKER_PORTS.md`](installation/DOCKER_PORTS.md#troubleshooting)
- [ ] Vérifier logs Docker: `docker-compose logs -f`
- [ ] Vérifier configuration: `docker-compose config`
- [ ] Exécuter scripts de diagnostic (`check-all-ports.sh`)

### Je comprends une décision technique

- [ ] Consulter ADR correspondant dans [`docs/decisions/`](docs/decisions/)
- [ ] Lire contexte, décision, conséquences, alternatives
- [ ] Vérifier statut (Accepté / Rejeté / Obsolète)

---

## Légende des symboles

- 📍 **Chemin** - Localisation du fichier
- 📝 **Description** - Contenu du document
- 🎯 **Audience** - Public ciblé
- 📋 **Contient** - Sections principales
- 🔑 **Sections clés** - Points importants
- ✅ **Statut** - État (Terminé, En cours, Planifié)
- 📅 **Date** - Date de création/mise à jour
- 📧 **Contact** - Qui contacter
- 🐛 **Bug** - Signalement problème
- ⚠️ **Attention** - Point critique

---

## Stratégie V2 & Multi-Agents

### V2_STRATEGY_PROPOSAL.md
**📍 Chemin:** [`V2_STRATEGY_PROPOSAL.md`](V2_STRATEGY_PROPOSAL.md)
**📝 Description:** Proposition stratégique complète pour V2 + architecture multi-agents
**🎯 Audience:** Lead Technique, Product Owner, Équipe
**📅 Date:** 2026-01-25
**📋 Contient:**
- Audit complet état V1 actuel
- Architecture multi-agents (6 agents spécialisés)
- Stratégie V1 stable / V2 parallèle
- POC intégrations NetBox + Uptime Kuma
- Planning 8 semaines

### Fiches Agents

#### agents/ORCHESTRATOR.md
**📍 Chemin:** [`agents/ORCHESTRATOR.md`](agents/ORCHESTRATOR.md)
**📝 Description:** Agent principal - Coordination et décisions architecture
**🎯 Rôle:** Lead Technique, coordination inter-agents

#### agents/AGENT_DB.md
**📍 Chemin:** [`agents/AGENT_DB.md`](agents/AGENT_DB.md)
**📝 Description:** Agent DB/Prisma - Gestion exclusive schéma base de données
**🎯 Rôle:** Migrations, schema, optimisation queries

#### agents/AGENT_BACKEND.md
**📍 Chemin:** [`agents/AGENT_BACKEND.md`](agents/AGENT_BACKEND.md)
**📝 Description:** Agent Backend - Développement API NestJS
**🎯 Rôle:** Controllers, services, intégrations

#### agents/AGENT_FRONTEND.md
**📍 Chemin:** [`agents/AGENT_FRONTEND.md`](agents/AGENT_FRONTEND.md)
**📝 Description:** Agent Frontend - Développement interface Next.js
**🎯 Rôle:** Pages, composants, UX

#### agents/AGENT_TESTS.md
**📍 Chemin:** [`agents/AGENT_TESTS.md`](agents/AGENT_TESTS.md)
**📝 Description:** Agent Tests - Qualité et couverture tests
**🎯 Rôle:** E2E Playwright, unitaires, reporting

#### agents/AGENT_DOCS.md
**📍 Chemin:** [`agents/AGENT_DOCS.md`](agents/AGENT_DOCS.md)
**📝 Description:** Agent Documentation - Maintien documentation
**🎯 Rôle:** README, ADR, guides, changelogs

#### agents/AGENT_CICD.md
**📍 Chemin:** [`agents/AGENT_CICD.md`](agents/AGENT_CICD.md)
**📝 Description:** Agent CI/CD - Pipelines automatisation
**🎯 Rôle:** GitHub Actions, déploiement, gates

---

## Version

- **Version du document**: 1.1
- **Dernière mise à jour**: 2026-01-25
- **Mainteneur**: Équipe XCH
- **Prochaine revue**: À chaque livraison majeure

---

✅ **INDEX COMPLET DE LA DOCUMENTATION XCH**
📚 **35 fichiers documentés** (27 V1 + 8 V2/Agents)
🎯 **Production-ready + V2 Strategy**

**Dernière mise à jour:** 2026-01-25
**Projet:** XCH V1.0.4 + V2 Strategy
