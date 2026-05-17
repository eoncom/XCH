# Roadmap Développement XCH

Date : 2025-12-31
Version : 1.0

## Vue d'ensemble

Développement organisé en **7 phases** avec agents spécialisés travaillant en parallèle quand possible.

**Durée estimée MVP** : 8-10 semaines (dépend parallélisation agents)

---

## Phase 1 : Fondations (Semaine 1-2)

### Objectif
Infrastructure de base fonctionnelle : DB, auth, RBAC, structure projet

### Agents

#### Agent-01 : Infrastructure & DevOps
**Mission** : Setup complet infrastructure développement et déploiement

**Livrables** :
- [ ] Docker Compose complet (PostgreSQL + PostGIS, Redis, MinIO, Traefik)
- [ ] Configuration environnements (dev, staging, prod)
- [ ] Scripts backup/restore DB
- [ ] CI/CD GitLab + GitHub Actions
- [ ] Documentation déploiement

**Statut** : Non démarré

#### Agent-02 : Database & Prisma
**Mission** : Schéma DB complet, migrations, seed initial

**Livrables** :
- [ ] Fichier `prisma/schema.prisma` complet
- [ ] Migrations initiales
- [ ] Seeds (tenant par défaut, admin user, policies Casbin)
- [ ] Scripts RLS PostgreSQL
- [ ] Documentation schéma DB

**Statut** : Non démarré

#### Agent-03 : Auth & RBAC
**Mission** : Système auth (local + OIDC) + permissions Casbin

**Livrables** :
- [ ] Module auth NestJS (Passport local + OIDC)
- [ ] JWT tokens (access + refresh)
- [ ] Guards (JwtAuthGuard, CasbinGuard)
- [ ] CRUD auth providers (config OIDC)
- [ ] Policies Casbin initiales (4 rôles)
- [ ] Tests auth complets

**Statut** : Non démarré

**Dépendances** : Agent-02 (DB schema User, AuthProvider)

---

## Phase 2 : Core Business (Semaine 3-4)

### Objectif
Fonctionnalités métier fondamentales : Sites, Assets, Racks

### Agents

#### Agent-04 : Sites (Chantiers)
**Mission** : CRUD sites complet avec géolocalisation

**Livrables** :
- [ ] Module Sites NestJS (controllers, services, DTOs)
- [ ] CRUD sites (create, read, update, delete)
- [ ] Validation inputs (Zod schemas)
- [ ] Recherche full-text (nom, code, adresse)
- [ ] Filtres (statut, santé, localisation)
- [ ] Gestion contacts chantier (JSON ou table)
- [ ] Tests unitaires + intégration

**Statut** : Non démarré

**Dépendances** : Agent-02 (DB), Agent-03 (Auth/RBAC)

#### Agent-05 : Assets (Équipements)
**Mission** : Inventaire assets complet avec types multiples

**Livrables** :
- [ ] Module Assets NestJS
- [ ] CRUD assets (tous types : imprimantes, iPads, réseau, visio...)
- [ ] Validation serial numbers (obligatoire selon type)
- [ ] Recherche (modèle, S/N, fabricant)
- [ ] Filtres (type, statut, chantier, sans S/N, sans localisation)
- [ ] Actions groupées (export CSV/Excel, changement statut masse)
- [ ] Tests

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-04 (Sites)

#### Agent-06 : Racks (Baies)
**Mission** : Gestion baies avec montage équipements

**Livrables** :
- [ ] Module Racks NestJS
- [ ] CRUD racks (création, édition, suppression)
- [ ] Montage/démontage équipements (position U, hauteur U)
- [ ] Vérification chevauchements positions U
- [ ] Calcul occupation (U utilisés / U total)
- [ ] Recherche espace libre (pour équipement N U)
- [ ] Réservation emplacements
- [ ] Historique modifications baie
- [ ] Tests (logique positions U critique)

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-04, Agent-05

---

## Phase 3 : Frontend Core (Semaine 4-5)

### Objectif
Interface utilisateur fondamentale : layout, auth, dashboards, listes

### Agents

#### Agent-07 : Frontend Setup & Layout
**Mission** : Setup Next.js + UI library + layout app

**Livrables** :
- [ ] Configuration Next.js 14 + TypeScript
- [ ] Setup shadcn/ui + Tailwind CSS
- [ ] Configuration PWA
- [ ] Layout principal (header, sidebar, footer)
- [ ] Navigation responsive + mobile
- [ ] Thème clair/sombre
- [ ] Branding dynamique (logo, couleurs tenant)
- [ ] Documentation composants

**Statut** : Non démarré

**Dépendances** : Agent-01 (infra)

#### Agent-08 : Auth Frontend
**Mission** : Pages login, gestion session, OIDC flow

**Livrables** :
- [ ] Pages login (local + OIDC)
- [ ] Flow OIDC complet (redirect, callback)
- [ ] Gestion tokens (storage, refresh auto)
- [ ] Protected routes (middleware)
- [ ] Page profil utilisateur
- [ ] Logout

**Statut** : Non démarré

**Dépendances** : Agent-03 (Auth backend), Agent-07 (Layout)

#### Agent-09 : Dashboard & Home
**Mission** : Dashboard principal avec indicateurs clés

**Livrables** :
- [ ] Page Dashboard (/)
- [ ] Indicateurs clés (chantiers actifs, assets total, tâches ouvertes)
- [ ] Timeline activité récente
- [ ] "Mes tâches" (assignées à moi)
- [ ] Charts simples (Chart.js ou Recharts)

**Statut** : Non démarré

**Dépendances** : Agent-07, Agent-08

#### Agent-10 : Sites Frontend
**Mission** : Pages liste sites, fiche site, recherche/filtres

**Livrables** :
- [ ] Page liste sites (table + filtres)
- [ ] Page fiche site (tabs : résumé, contacts, connectivité, inventaire, plans, tâches, intégrations)
- [ ] Recherche instantanée (as-you-type)
- [ ] Filtres (statut, santé, localisation)
- [ ] Formulaires création/édition site
- [ ] Validation frontend (React Hook Form + Zod)

**Statut** : Non démarré

**Dépendances** : Agent-04 (Sites backend), Agent-07, Agent-08

#### Agent-11 : Assets Frontend
**Mission** : Pages liste assets, fiche asset, actions groupées

**Livrables** :
- [ ] Page liste assets (table + vignettes)
- [ ] Page fiche asset
- [ ] Recherche (modèle, S/N)
- [ ] Filtres (type, statut, chantier)
- [ ] Formulaires création/édition asset
- [ ] Actions groupées (sélection multiple, export, QR batch)
- [ ] Vue mobile optimisée (scan QR)

**Statut** : Non démarré

**Dépendances** : Agent-05 (Assets backend), Agent-07, Agent-08

---

## Phase 4 : Features Avancées Backend (Semaine 5-6)

### Objectif
Tasks, Plans, Intégrations externes

### Agents

#### Agent-12 : Tasks (Tâches)
**Mission** : CRUD tâches avec checklist, TicketLink, assignation

**Livrables** :
- [ ] Module Tasks NestJS
- [ ] CRUD tâches
- [ ] Gestion checklist (JSON array)
- [ ] TicketLink (référence ticket externe)
- [ ] Assignation utilisateurs
- [ ] Filtres (statut, priorité, assigné, chantier, en retard)
- [ ] Notifications (nouvelle tâche, échéance proche)
- [ ] Tests

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-04

#### Agent-13 : Plans & Pins
**Mission** : Upload plans, visionneuse, éditeur pins

**Livrables** :
- [ ] Module FloorPlans NestJS
- [ ] Upload fichiers (S3/MinIO) avec validation (PDF, PNG, JPG, 10MB max)
- [ ] Versioning plans
- [ ] CRUD pins (création, déplacement, association asset/rack)
- [ ] Coordonnées normalisées (0-1)
- [ ] Validation pins (doit pointer vers asset existant)
- [ ] Tests

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-04, Agent-05, Agent-06

#### Agent-14 : Intégrations (NetBox, Monitoring)
**Mission** : Connecteurs optionnels READ-ONLY

**Livrables** :
- [ ] Module Integrations NestJS
- [ ] Connecteur NetBox (READ-ONLY)
  - Mapping Site ↔ NetBox site
  - Récupération devices
  - Mapping assisté Asset ↔ Device (S/N)
  - Enrichissement données (IP, rack)
- [ ] Connecteur Uptime Kuma
  - Récupération statut monitors
  - Mise à jour health_status sites
- [ ] Configuration UI providers (enable/disable, credentials, test connexion)
- [ ] Cache résultats (Redis, 15min)
- [ ] Tests mocks API externes

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-04, Agent-05

#### Agent-15 : Photos & Pièces jointes
**Mission** : Upload photos, galerie, compression

**Livrables** :
- [ ] Module Photos NestJS
- [ ] Upload fichiers (images + PDF, 5MB max)
- [ ] Compression images automatique
- [ ] Association polymorphique (Sites, Assets, Tasks)
- [ ] Metadata EXIF (date, GPS)
- [ ] API download/delete
- [ ] Tests

**Statut** : Non démarré

**Dépendances** : Agent-01 (MinIO), Agent-02, Agent-03

---

## Phase 5 : Features Avancées Frontend (Semaine 6-7)

### Objectif
Tasks UI, Plans interactifs, Carte chantiers, QR codes

### Agents

#### Agent-16 : Tasks Frontend
**Mission** : Pages tâches (liste, kanban, calendrier), création/édition

**Livrables** :
- [ ] Page liste tâches (table + filtres)
- [ ] Vue Kanban (drag & drop colonnes statut)
- [ ] Vue Calendrier (par date échéance)
- [ ] Page fiche tâche (détails, checklist, commentaires)
- [ ] Formulaires création/édition tâche
- [ ] Gestion checklist interactive
- [ ] TicketLink UI (badge cliquable)
- [ ] Workflow mobile (scan QR → tâche)

**Statut** : Non démarré

**Dépendances** : Agent-12 (Tasks backend), Agent-07, Agent-08

#### Agent-17 : Plans & Visionneuse
**Mission** : Visionneuse plans interactive + éditeur pins

**Livrables** :
- [ ] Composant visionneuse plans (Konva.js)
- [ ] Zoom/pan fluides
- [ ] Affichage pins existants (icônes typées, couleurs)
- [ ] Mode édition (admin/tech)
  - Ajout pins (click)
  - Déplacement pins (drag & drop)
  - Édition pin (association asset, label)
  - Suppression pins
- [ ] Export plan annoté (PNG, PDF)
- [ ] Mobile friendly (pinch zoom)

**Statut** : Non démarré

**Dépendances** : Agent-13 (Plans backend), Agent-07, Agent-08, Agent-11 (Assets frontend)

#### Agent-18 : Carte Multi-chantiers
**Mission** : Carte interactive tous chantiers avec clustering

**Livrables** :
- [ ] Composant carte (Leaflet)
- [ ] Affichage tous chantiers (markers GPS)
- [ ] Clustering automatique (Supercluster)
- [ ] Markers couleur par santé (vert/orange/rouge/gris)
- [ ] Popups markers (code, nom, statut, bouton ouvrir fiche)
- [ ] Filtres synchronisés liste ↔ carte
- [ ] Recherche adresse/ville
- [ ] Zone selection (dessiner rectangle pour filtrer)
- [ ] Export CSV chantiers filtrés

**Statut** : Non démarré

**Dépendances** : Agent-04 (Sites backend), Agent-10 (Sites frontend)

#### Agent-19 : QR Codes & Scan
**Mission** : Génération QR, étiquettes imprimables, scan mobile

**Livrables** :
- [ ] Backend : Génération QR codes (qrcode library)
- [ ] Endpoints QR sécurisés (tokens non-devinables)
- [ ] Frontend : Génération batch QR (sélection assets)
- [ ] Génération étiquettes PDF imprimables (formats Avery)
- [ ] Scan QR mobile (html5-qrcode)
- [ ] Workflow scan → auth → redirection fiche asset
- [ ] Rate limiting anti-spam

**Statut** : Non démarré

**Dépendances** : Agent-05 (Assets backend), Agent-11 (Assets frontend)

---

## Phase 6 : Baies Frontend & Exports (Semaine 7-8)

### Objectif
Visualisation baies, exports PDF/Excel, recherche globale

### Agents

#### Agent-20 : Racks Frontend
**Mission** : Visualisation baies, montage équipements, schémas

**Livrables** :
- [ ] Page liste baies (par chantier, globale)
- [ ] Page fiche baie :
  - Vue schématique verticale (SVG)
  - Graduation U (1 à heightU)
  - Équipements positionnés
  - Espaces libres visuels
  - Indicateurs (occupation %, espace libre max)
- [ ] Formulaires montage/démontage équipements
- [ ] Recherche espace libre (équipement N U)
- [ ] Réservation emplacements
- [ ] Drag & drop réorganisation (optionnel MVP)
- [ ] Export schéma baie (PDF)

**Statut** : Non démarré

**Dépendances** : Agent-06 (Racks backend), Agent-07, Agent-08, Agent-11

#### Agent-21 : Exports & Rapports
**Mission** : Génération PDF/Excel (rapports, inventaires)

**Livrables** :
- [ ] Backend : Service génération PDF (Puppeteer)
- [ ] Templates PDF brandés (logo, couleurs tenant)
- [ ] Rapport synthèse chantier (PDF complet)
- [ ] Schéma baie (PDF)
- [ ] Étiquettes QR (PDF imprimable)
- [ ] Exports CSV/Excel (sites, assets, tâches)
- [ ] Queue jobs (BullMQ) pour générations longues
- [ ] Dashboard jobs (monitoring exports)

**Statut** : Non démarré

**Dépendances** : Agent-01 (Redis/BullMQ), agents métier (Sites, Assets, Racks, Tasks)

#### Agent-22 : Recherche Globale
**Mission** : Barre recherche omniprésente, résultats multi-types

**Livrables** :
- [ ] Backend : Endpoint search global (full-text PostgreSQL)
- [ ] Frontend : Composant barre recherche (header)
- [ ] Raccourci clavier (Ctrl+K)
- [ ] Recherche as-you-type
- [ ] Résultats groupés (sites, assets, baies, tâches, contacts)
- [ ] Navigation clavier (flèches + Enter)
- [ ] Sauvegarde recherches fréquentes

**Statut** : Non démarré

**Dépendances** : Tous agents métier (Sites, Assets, Racks, Tasks)

---

## Phase 7 : Admin, Config, Polish (Semaine 8-9)

### Objectif
Gestion users, config tenant, audit, optimisations, tests E2E

### Agents

#### Agent-23 : Admin Users & Permissions
**Mission** : CRUD users, gestion rôles, UI permissions Casbin

**Livrables** :
- [ ] Backend : Module Users (CRUD)
- [ ] Frontend : Page gestion utilisateurs
  - Liste users (table + filtres)
  - Création user (invitation email)
  - Édition profil, changement rôle
  - Désactivation/suppression compte
  - Réinitialisation password
- [ ] Page gestion permissions
  - Matrice rôles × ressources × actions
  - Édition policies Casbin (admin)
  - Assignation rôles users
- [ ] Tests permissions (vérifier isolation RBAC)

**Statut** : Non démarré

**Dépendances** : Agent-03 (Auth/RBAC), Agent-07, Agent-08

#### Agent-24 : Configuration Tenant
**Mission** : Paramètres délégation (branding, intégrations)

**Livrables** :
- [ ] Backend : Endpoints config tenant
- [ ] Frontend : Page "Paramètres"
  - Infos générales (nom, logo, couleur)
  - Upload logo
  - Configuration auth providers (OIDC)
  - Configuration intégrations (NetBox, monitoring)
  - Test connexions
  - Préférences utilisateur (format dates, notifications)
- [ ] Branding dynamique (logo/couleurs injectés app)

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-07, Agent-14

#### Agent-25 : Audit Logs & Monitoring
**Mission** : Logs audit complet, UI consultation logs

**Livrables** :
- [ ] Backend : Service audit logging (interceptor NestJS)
- [ ] Traçage actions (create, update, delete sur entités critiques)
- [ ] Capture context (userId, IP, user agent, before/after)
- [ ] Frontend : Page "Audit" (admin)
  - Table événements
  - Filtres (user, action, ressource, période)
  - Recherche logs
  - Export logs CSV
- [ ] Monitoring app (Sentry setup)

**Statut** : Non démarré

**Dépendances** : Agent-02, Agent-03, Agent-07

#### Agent-26 : Tests E2E & Optimisations
**Mission** : Tests bout en bout, optimisations performance

**Livrables** :
- [ ] Tests E2E Playwright :
  - Scénario auth (login local + OIDC)
  - Scénario CRUD chantier
  - Scénario montage équipement en baie
  - Scénario scan QR mobile
  - Scénario création tâche
- [ ] Optimisations :
  - Lazy loading images
  - Pagination (sites, assets > 50)
  - Cache Redis (recherches, intégrations)
  - Indexes DB vérifiés
  - Bundle size frontend (code splitting)
- [ ] Lighthouse audit (performance, SEO, accessibility)

**Statut** : Non démarré

**Dépendances** : Tous agents (application complète)

---

## Phase 8 : Documentation & Livraison (Semaine 9-10)

### Objectif
Documentation complète, package déploiement, recette

### Agents

#### Agent-27 : Documentation Finale
**Mission** : Documentation utilisateur et admin complète

**Livrables** :
- [ ] README.md (présentation, features, installation rapide)
- [ ] INSTALLATION.md (déploiement détaillé on-premise + cloud)
- [ ] USER_GUIDE.md (guide utilisateur par rôle)
- [ ] ADMIN_GUIDE.md (configuration, maintenance, backup/restore)
- [ ] API_DOCS.md (endpoints si API exposée future)
- [ ] CONTRIBUTING.md (si open-source)
- [ ] CHANGELOG.md (versions, évolutions)
- [ ] Architecture diagrams (schémas C4, ERD)

**Statut** : Non démarré

**Dépendances** : Application complète

#### Agent-28 : Package Déploiement
**Mission** : Package all-in-one déploiement production

**Livrables** :
- [ ] Docker Compose production optimisé
- [ ] Scripts déploiement (deploy.sh, backup.sh, restore.sh)
- [ ] Configuration environnements (templates .env)
- [ ] Healthchecks tous services
- [ ] Logs centralisés (Loki ou équivalent)
- [ ] Monitoring stack (Prometheus + Grafana - optionnel)
- [ ] Guide troubleshooting

**Statut** : Non démarré

**Dépendances** : Application complète, Agent-01 (infra)

---

## Parallélisation & Dépendances

### Vague 1 (Semaine 1-2) - Parallèle
- Agent-01 : Infrastructure ✓
- Agent-02 : Database ✓ (parallèle Agent-01)

### Vague 2 (Semaine 2) - Séquentiel
- Agent-03 : Auth/RBAC (attend Agent-02)

### Vague 3 (Semaine 3-4) - Parallèle
- Agent-04 : Sites ✓ (attend Agent-02, 03)
- Agent-05 : Assets ✓ (attend Agent-02, 03, 04)
- Agent-06 : Racks ✓ (attend Agent-02, 03, 04, 05)
- Agent-07 : Frontend Setup ✓ (attend Agent-01)

### Vague 4 (Semaine 4-5) - Parallèle
- Agent-08 : Auth Frontend (attend Agent-03, 07)
- Agent-09 : Dashboard (attend Agent-07, 08)
- Agent-10 : Sites Frontend (attend Agent-04, 07, 08)
- Agent-11 : Assets Frontend (attend Agent-05, 07, 08)

### Vague 5 (Semaine 5-6) - Parallèle
- Agent-12 : Tasks (attend Agent-02, 03, 04)
- Agent-13 : Plans (attend Agent-02, 03, 04, 05, 06)
- Agent-14 : Intégrations (attend Agent-02, 03, 04, 05)
- Agent-15 : Photos (attend Agent-01, 02, 03)

### Vague 6 (Semaine 6-7) - Parallèle
- Agent-16 : Tasks Frontend (attend Agent-12, 07, 08)
- Agent-17 : Plans Frontend (attend Agent-13, 07, 08, 11)
- Agent-18 : Carte (attend Agent-04, 10)
- Agent-19 : QR Codes (attend Agent-05, 11)

### Vague 7 (Semaine 7-8) - Parallèle
- Agent-20 : Racks Frontend (attend Agent-06, 07, 08, 11)
- Agent-21 : Exports (attend agents métier)
- Agent-22 : Recherche Globale (attend agents métier)

### Vague 8 (Semaine 8-9) - Parallèle
- Agent-23 : Admin Users (attend Agent-03, 07, 08)
- Agent-24 : Config Tenant (attend Agent-02, 03, 07, 14)
- Agent-25 : Audit Logs (attend Agent-02, 03, 07)
- Agent-26 : Tests E2E (attend application complète)

### Vague 9 (Semaine 9-10) - Séquentiel
- Agent-27 : Documentation (attend application complète)
- Agent-28 : Package Déploiement (attend application complète)

---

## Métriques de succès MVP

### Fonctionnel
- [ ] 30 chantiers gérables avec infos complètes
- [ ] 150 équipements inventoriés
- [ ] 10 baies avec 50 équipements montés
- [ ] Scan QR → fiche asset < 2s
- [ ] Export rapport chantier 1 clic
- [ ] Plans avec pins localisation < 30s
- [ ] Schémas baies visualisation instantanée
- [ ] 100 tâches suivies sans confusion
- [ ] Carte santé instantanée tous chantiers

### Technique
- [ ] Application responsive desktop + mobile
- [ ] PWA installable smartphones
- [ ] Temps chargement pages < 3s
- [ ] Actions < 1s
- [ ] Recherche < 500ms
- [ ] Stabilité (pas de crash usage normal)
- [ ] Sécurité (auth, HTTPS, RBAC, audit)
- [ ] Coverage tests > 80%

### Adoption
- [ ] RSI pilote utilise quotidiennement après 1 mois
- [ ] Techs préfèrent XCH vs Excel
- [ ] Temps recherche info -50%
- [ ] Zéro régression workflows

---

## Prochaines étapes

1. ✅ Roadmap validée
2. ⏳ Créer fiches tous agents (/docs/agents/)
3. ⏳ Générer prompts instanciation agents
4. ⏳ Démarrer Vague 1 (Agent-01 + Agent-02)

---

**Dernière mise à jour** : 2025-12-31 par Architecte Lead
