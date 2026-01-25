# XCH V2 - Proposition Stratégique Multi-Agents

**Date :** 2026-01-25
**Auteur :** Claude (Architecte Principal)
**Statut :** PROPOSITION - En attente validation

---

## 📋 RÉSUMÉ EXÉCUTIF

### Contexte Actuel

**XCH V1 :**
- Application MVP 100% fonctionnelle (backend NestJS + frontend Next.js 15)
- Production déployée sur 192.168.0.13 (xch.eoncom.io)
- ~100 endpoints API, 18 pages frontend
- Quelques bugs mineurs (refresh auto, icônes PWA)

**Problème Identifié :**
Lors des sessions de développement précédentes, une approche "agent unique monolithique" a créé des complications :
1. **Pas de migrations Prisma formelles** - Schéma DB créé via SQL direct
2. **Tests E2E incomplets** - 2/57 tests passent (Known Issue SSR/CSR cookies)
3. **Pas de garde-fous automatiques** - Régressions possibles non détectées
4. **Documentation parfois désynchronisée** - Sources multiples difficiles à maintenir

### Solution Proposée

Passer d'un **agent monolithique** à une **équipe d'agents spécialisés** avec :
1. **Orchestrateur central** - Coordination, décisions architecture
2. **Agents spécialisés** - DB, Backend, Frontend, Tests, CI/CD, Docs
3. **Garde-fous automatiques** - CI gates, tests obligatoires, validation croisée
4. **Processus industrialisé** - Workflows standardisés, revues systématiques

---

## 🔍 AUDIT COMPLET ÉTAT ACTUEL

### 1. Cohérence Code Local ↔ Serveur ↔ GitHub

| Élément | Local | Serveur | GitHub | Statut |
|---------|-------|---------|--------|--------|
| Commit HEAD | 2617f0c | 2617f0c | 2617f0c | ✅ Synchronisé |
| schema.prisma | 14502 bytes | 14502 bytes | 14502 bytes | ✅ Synchronisé |
| Migrations | Aucune | Aucune | Aucune | ⚠️ Non standard |
| Backend build | OK | Running | N/A | ✅ OK |
| Frontend build | OK | Running | N/A | ✅ OK |

### 2. État Base de Données Production

```
Tables actuelles (17) :
✅ assets, audit_logs, auth_providers, casbin_rule
✅ external_refs, floor_plans, photos, pins, providers
✅ racks, sites, tasks, tenants, users
✅ geometry_columns, geography_columns, spatial_ref_sys (PostGIS)
```

**Constat :** Le schéma DB correspond au schema.prisma actuel. Pas de drift détecté.

### 3. Problèmes de Processus Identifiés

| Problème | Impact | Criticité |
|----------|--------|-----------|
| Pas de migrations Prisma | Impossibilité de versionner changements DB | 🔴 Haute |
| Tests E2E quasi non fonctionnels | 55/57 échouent sur auth SSR/CSR | 🔴 Haute |
| CI/CD partiel | Workflow existe mais pas déploiement auto | 🟠 Moyenne |
| Refresh cache frontend | 66% pages sans invalidation queries | 🟠 Moyenne |
| Icônes PWA manquantes | Warnings console, UX dégradée | 🟡 Basse |

### 4. Bugs V1 Restants à Corriger

| # | Bug | Impact | Estimation |
|---|-----|--------|------------|
| 1 | Refresh auto mutations (12 pages) | UX | 1-2h |
| 2 | Icônes PWA 404 | UX | 30min |
| 3 | Tests E2E SSR/CSR cookies | Qualité | 2-3h |

---

## 🏗️ ARCHITECTURE MULTI-AGENTS PROPOSÉE

### Vision : Équipe Agents Spécialisés

```
┌─────────────────────────────────────────────────────────────┐
│                    🎯 ORCHESTRATEUR                         │
│                 (Claude - Lead Technique)                   │
│  Coordination • Décisions architecture • Arbitrage         │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┬───────────┐
    ▼           ▼           ▼           ▼           ▼
┌───────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐ ┌──────────┐
│🗄️ DB  │ │⚙️ Backend │ │🎨 Frontend│ │🧪 Tests │ │📚 Docs   │
│Agent  │ │  Agent    │ │  Agent    │ │ Agent   │ │ Agent    │
└───────┘ └───────────┘ └───────────┘ └─────────┘ └──────────┘
    │           │           │           │           │
    └───────────┴───────────┴───────────┴───────────┘
                            │
                    ┌───────▼───────┐
                    │🚀 CI/CD Agent │
                    │ (Automatisé)  │
                    └───────────────┘
```

### Agents Détaillés

#### 1. 🎯 Orchestrateur (Lead Technique)
**Rôle :** Coordination globale, décisions architecture, arbitrage conflits

**Responsabilités :**
- Réception demandes utilisateur
- Décomposition en tâches pour agents spécialisés
- Validation cohérence inter-modules
- Décisions techniques majeures (stack, patterns, tradeoffs)
- Gestion planning et priorités
- Communication avec le client

**Skills :**
- Vision globale architecture
- Connaissance complète codebase
- Capacité arbitrage technique

#### 2. 🗄️ Agent DB/Prisma
**Rôle :** Gestion exclusive du schéma base de données

**Responsabilités :**
- Modifications schema.prisma
- Création/application migrations
- Optimisation requêtes (indexes, explain)
- Intégrité référentielle
- Seed data

**Règles strictes :**
- ⚠️ TOUJOURS créer migration pour chaque changement schema
- ⚠️ JAMAIS modifier DB directement (sauf seed)
- ⚠️ Tests migration rollback obligatoires
- ⚠️ Validation par Orchestrateur avant merge

**Outputs :**
- Fichiers migrations (prisma/migrations/*)
- Schema.prisma versionné
- Documentation changements DB

#### 3. ⚙️ Agent Backend
**Rôle :** Développement API NestJS

**Responsabilités :**
- Modules/controllers/services NestJS
- DTOs et validation (class-validator)
- Guards et interceptors
- Intégrations externes (NetBox, Uptime Kuma)
- Documentation Swagger

**Règles strictes :**
- ⚠️ JAMAIS modifier schema.prisma (déléguer à Agent DB)
- ⚠️ Tests unitaires pour nouveaux services
- ⚠️ Validation inputs complète
- ⚠️ Gestion erreurs standardisée

**Dépendances :**
- Attend migrations DB avant utilisation nouveaux champs

#### 4. 🎨 Agent Frontend
**Rôle :** Développement interface Next.js

**Responsabilités :**
- Composants React/TypeScript
- Pages et routing App Router
- State management (Zustand)
- Data fetching (TanStack Query)
- UI/UX (Tailwind, shadcn/ui)
- PWA features

**Règles strictes :**
- ⚠️ TOUJOURS invalidateQueries après mutations
- ⚠️ TypeScript strict (no any)
- ⚠️ Responsive obligatoire
- ⚠️ Error boundaries sur pages critiques

**Dépendances :**
- Endpoints API doivent exister avant intégration

#### 5. 🧪 Agent Tests
**Rôle :** Qualité et couverture tests

**Responsabilités :**
- Tests E2E Playwright
- Tests unitaires (Jest/Vitest)
- Tests intégration API
- Rapports couverture
- Détection régressions

**Règles strictes :**
- ⚠️ 100% scénarios critiques couverts
- ⚠️ Tests doivent passer AVANT merge
- ⚠️ Pas de skip tests sans justification

**Outputs :**
- Fichiers specs E2E
- Rapports HTML/JUnit
- Dashboard couverture

#### 6. 📚 Agent Documentation
**Rôle :** Maintien documentation projet

**Responsabilités :**
- README et guides installation
- ADR (Architecture Decision Records)
- API documentation (Swagger enrichi)
- Changelogs
- PROJECT_STATUS.md (source vérité)

**Règles strictes :**
- ⚠️ MAJ docs AVEC chaque feature/fix
- ⚠️ Vérification liens cassés
- ⚠️ Synchronisation avec code

#### 7. 🚀 Agent CI/CD (Automatisé)
**Rôle :** Pipeline automatisation

**Responsabilités :**
- GitHub Actions workflows
- Build/test/deploy automatiques
- Checks obligatoires (lint, types, tests)
- Déploiement staging/production
- Rollback automatique si échec

**Gates obligatoires :**
```yaml
# Chaque PR doit passer :
- ✅ TypeScript compilation (0 errors)
- ✅ ESLint (0 warnings critiques)
- ✅ Tests unitaires (100% pass)
- ✅ Tests E2E (scénarios critiques)
- ✅ Build production réussi
```

---

## 🛡️ GARDE-FOUS AUTOMATIQUES

### 1. Pre-commit Hooks

```bash
# .husky/pre-commit
npm run lint-staged
npm run type-check
npm run test:unit:changed
```

### 2. CI Gates (GitHub Actions)

| Gate | Bloque merge si | Criticité |
|------|-----------------|-----------|
| TypeScript | Erreurs compilation | 🔴 Obligatoire |
| ESLint | Errors (pas warnings) | 🔴 Obligatoire |
| Tests unitaires | < 100% pass | 🔴 Obligatoire |
| Tests E2E | Scénarios critiques fail | 🔴 Obligatoire |
| Build prod | Échec build | 🔴 Obligatoire |
| Coverage | < 70% (future) | 🟠 Recommandé |

### 3. Validation Croisée Agents

```
Avant merge feature :
1. Agent Backend ✓ code review
2. Agent Tests ✓ tests passent
3. Agent Docs ✓ documentation OK
4. Orchestrateur ✓ validation finale
```

### 4. Drift Detection

```yaml
# Workflow quotidien
- Comparaison schema.prisma vs DB réelle
- Alerte si différence détectée
- Bloque déploiement si drift
```

---

## 📊 STRATÉGIE V1 STABLE / V2 PARALLÈLE

### Phase 1 : Stabilisation V1 (Semaine 1-2)

**Objectifs :**
1. Corriger bugs restants (refresh auto, PWA icons)
2. Mettre en place migrations Prisma rétroactives
3. Résoudre problème tests E2E SSR/CSR
4. Implémenter CI gates

**Livrables :**
- [ ] V1.0.4-stable releasée
- [ ] Tag Git v1.0.4
- [ ] Branche `release/v1.x` créée (maintenance)
- [ ] Migrations Prisma alignées avec DB prod
- [ ] 80%+ tests E2E passent
- [ ] CI/CD complet activé

### Phase 2 : Fondations V2 (Semaine 3-4)

**Objectifs :**
1. Créer branche `develop-v2`
2. Mettre en place architecture agents
3. Définir nouveau frontend (thème, UX améliorée)
4. Préparer infrastructure POC intégrations

**Livrables :**
- [ ] Branche develop-v2 initialisée
- [ ] Prompts agents documentés
- [ ] Maquettes nouveau thème UX
- [ ] Environnement dev V2 isolé

### Phase 3 : POC Intégrations (Semaine 5-8)

**Objectifs :**
1. POC NetBox intégration fonctionnelle
2. POC Uptime Kuma dashboard intégré
3. Nouveau thème UI implémenté
4. Tests validation POC

**Livrables :**
- [ ] Sync bidirectionnelle NetBox (sites, devices)
- [ ] Dashboard monitoring temps réel
- [ ] Thème V2 appliqué sur pages principales
- [ ] Documentation intégrations

---

## 🔌 POC INTÉGRATIONS V2

### 1. NetBox Integration (MVP)

**Objectif :** Synchronisation inventaire XCH ↔ NetBox

**Scope POC :**
```
NetBox                    XCH
--------                  --------
Sites     ←→ sync ←→      Sites
Devices   ←→ sync ←→      Assets
Racks     ←→ sync ←→      Racks
```

**Fonctionnalités :**
- Import initial depuis NetBox
- Sync périodique (toutes les 15 min)
- UI affichant statut sync
- Gestion conflits (priorité configurable)
- Webhook NetBox → XCH (temps réel)

**Stack technique :**
```typescript
// backend/src/modules/integrations/netbox/
netbox.service.ts       // Client API NetBox
netbox.sync.service.ts  // Logique synchronisation
netbox.webhook.controller.ts // Réception events
netbox.mapper.ts        // Mapping entités
```

### 2. Uptime Kuma Integration (MVP)

**Objectif :** Dashboard monitoring intégré dans XCH

**Scope POC :**
```
Uptime Kuma              XCH
-----------              --------
Monitors    →            Site health_status
Heartbeats  →            Dashboard monitoring
Status      →            Alertes temps réel
```

**Fonctionnalités :**
- Widget monitoring sur dashboard principal
- Statut santé automatique par chantier
- Historique uptime par service
- Alertes toast si DOWN détecté

**Stack technique :**
```typescript
// backend/src/modules/integrations/uptime-kuma/
uptime-kuma.service.ts     // Client API
uptime-kuma.scheduler.ts   // Poll périodique
uptime-kuma.events.ts      // WebSocket events

// frontend/src/components/monitoring/
MonitoringWidget.tsx       // Widget dashboard
StatusBadge.tsx            // Badge statut
UptimeGraph.tsx           // Historique graphique
```

### 3. Nouveau Frontend UX (V2)

**Objectif :** Expérience utilisateur modernisée

**Améliorations prévues :**
- Thème sombre/clair avec toggle
- Animations fluides (Framer Motion)
- Navigation plus intuitive
- Mobile optimisé (gestures, bottom nav)
- Accessibilité améliorée (WCAG 2.1)

**Stack additionnelle :**
```
- Framer Motion (animations)
- next-themes (thème switching)
- Radix UI primitives (accessibilité)
- Recharts (graphiques monitoring)
```

---

## 📁 STRUCTURE RECOMMANDÉE

### Branches Git

```
main                    # Production stable
├── release/v1.x        # Maintenance V1 (bugfixes only)
├── develop-v2          # Développement V2
│   ├── feature/netbox-integration
│   ├── feature/uptime-kuma-integration
│   ├── feature/new-theme-v2
│   └── feature/ux-improvements
└── hotfix/*            # Corrections urgentes
```

### Tags

```
v1.0.4    # Release stable V1
v2.0.0-alpha.1  # Première preview V2
v2.0.0-beta.1   # Beta testable V2
v2.0.0    # Release finale V2
```

### Environnements

| Env | URL | Usage |
|-----|-----|-------|
| Production V1 | xch.eoncom.io | Utilisateurs actuels |
| Staging V1 | staging-v1.xch.eoncom.io | Tests hotfixes |
| Dev V2 | dev-v2.xch.eoncom.io | Développement V2 |
| Preview V2 | preview.xch.eoncom.io | Démos intégrations |

---

## ⏱️ PLANNING PROPOSÉ

### Semaine 1 : Stabilisation V1 + Setup Agents
- [ ] Jour 1-2 : Correction bugs refresh auto
- [ ] Jour 3 : Fix PWA icons + tests E2E
- [ ] Jour 4 : Migration Prisma rétroactive
- [ ] Jour 5 : CI gates + tag v1.0.4

### Semaine 2 : Infrastructure V2
- [ ] Jour 1-2 : Setup branches + environnements
- [ ] Jour 3-4 : Documentation agents + prompts
- [ ] Jour 5 : Maquettes nouveau thème

### Semaine 3-4 : POC NetBox
- [ ] Semaine 3 : API client + import initial
- [ ] Semaine 4 : Sync bidirectionnelle + UI

### Semaine 5-6 : POC Uptime Kuma + Thème
- [ ] Semaine 5 : Intégration monitoring
- [ ] Semaine 6 : Nouveau thème appliqué

### Semaine 7-8 : Validation + Release
- [ ] Semaine 7 : Tests intégration complète
- [ ] Semaine 8 : V2.0.0-beta release

---

## ✅ DÉCISIONS IMMÉDIATES REQUISES

### Questions pour Validation

1. **Approche agents :**
   - ✅ Valider l'architecture 6 agents proposée
   - Ou préférer moins d'agents (3-4) plus polyvalents ?

2. **Stratégie V1/V2 :**
   - ✅ Branches séparées (release/v1.x + develop-v2)
   - Ou repo V2 séparé ?

3. **Priorité POC :**
   - NetBox d'abord ? Uptime Kuma d'abord ?
   - Nouveau thème en parallèle ou après ?

4. **Environnements :**
   - Sous-domaines distincts acceptables ?
   - Ou préférer ports différents sur même serveur ?

---

## 📋 PROCHAINES ACTIONS

### Si proposition validée :

1. **Immédiat (aujourd'hui) :**
   - Créer branche `release/v1.x` depuis main
   - Corriger bugs refresh auto (12 fichiers identifiés)
   - Générer icônes PWA manquantes

2. **Demain :**
   - Créer migration Prisma initiale
   - Résoudre problème tests E2E cookies
   - Implémenter CI gates

3. **Cette semaine :**
   - Tag v1.0.4-stable
   - Créer branche develop-v2
   - Documenter prompts agents

4. **Semaine prochaine :**
   - Démarrer POC NetBox
   - Maquettes nouveau thème

---

## 🎯 CRITÈRES DE SUCCÈS

### V1 Stabilisée
- [ ] 0 bugs bloquants
- [ ] 80%+ tests E2E passent
- [ ] CI/CD complet fonctionnel
- [ ] Migrations Prisma alignées

### V2 POC Réussi
- [ ] Sync NetBox ↔ XCH fonctionnelle
- [ ] Dashboard monitoring temps réel
- [ ] Nouveau thème appliqué
- [ ] Documentation complète

### Processus Industrialisé
- [ ] 100% features passent par agents
- [ ] 0 merge sans CI verts
- [ ] Documentation toujours à jour
- [ ] Drift DB détecté automatiquement

---

**Document préparé par Claude - Architecte Principal XCH**
**En attente de validation pour démarrer l'implémentation**
