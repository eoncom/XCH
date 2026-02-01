# 🚀 PROMPT MULTI-AGENT LAUNCH - XCH Projet

**Date création :** 2026-02-01
**Objectif :** Lancer 3 agents spécialisés en parallèle pour finaliser MVP frontend

---

## 📋 PROMPT À COPIER-COLLER (Mode Multi-Agent)

```markdown
# LANCEMENT MULTI-AGENT - XCH Finalisation MVP Frontend

Tu es le **Development Team Lead** pour le projet XCH. Ta mission est de lancer et coordonner **3 agents spécialisés en parallèle** pour combler les 3 gaps MVP frontend.

## CONTEXTE PROJET

**XCH** = Application gestion IT chantiers temporaires (Backend NestJS + Frontend Next.js 15)

**Serveur production :**
- Frontend : https://xch.eoncom.io
- Backend API : https://xchapi.eoncom.io
- Storage MinIO : https://xchstr.eoncom.io
- SSH : `ssh xch-deploy` → `/opt/xch-dev/XCH`

**Chemin local :** C:\xampp\htdocs\XCH

## ÉTAT ACTUEL (2026-02-01)

**Backend :** 100% ✅ (10 modules, ~100 endpoints API prêts)
**Frontend :** 90% ⚠️ (**3 gaps MVP à combler**)
**Tests :** 15% (2/57 E2E Playwright passent)
**Documentation :** 100% ✅
**CI/CD :** 50% ⚠️

**Infrastructure production :** ✅ Déployée et opérationnelle

## 📚 FICHIERS À LIRE AVANT DE LANCER (ORDRE STRICT)

**Tu DOIS lire ces fichiers dans cet ordre :**

1. **CLAUDE.md** - Instructions lead technique (rôle, autonomie, conventions)
2. **docs/status/PROJECT_STATUS.md** - État projet (SOURCE DE VÉRITÉ)
3. **DEVELOPMENT_TEAM_READY.md** - Guide complet Development Team (⭐ CRITIQUE)
4. **docs/ANALYSE_FINALISATION_PRODUCTION.md** - Analyse gaps MVP + roadmap
5. **docs/agents/agent-dev-team-lead.md** - Ta fiche complète (mission coordination)

**Fichiers optionnels (si besoin clarification) :**
- DEVELOPMENT_LOG.md (Session 15 - dernière entrée)
- LIVRAISON_MVP_100.md (contexte livraison MVP)
- frontend/README.md (stack technique frontend)

## 🎯 MISSION MULTI-AGENT

**Objectif :** Frontend XCH **90% → 100%** en 6-8h (au lieu de 26-38h séquentiels)

**Stratégie :** Lancer **3 agents spécialisés en parallèle** (gain temps 70%)

### 3 Agents à Lancer Simultanément

#### Agent 1 : Frontend Providers CRUD (16-24h)
- **Fiche :** `docs/agents/agent-frontend-providers-crud.md`
- **Mission :** Créer module Providers CRUD complet (4 pages + service API)
- **Fichiers à créer :** 5 fichiers (page.tsx, new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx, services/providers.ts)
- **Backend API :** ✅ Prêt (GET/POST/PATCH/DELETE /api/providers)
- **Priorité :** 🟡 Moyenne (module secondaire MVP)

#### Agent 2 : Frontend Sites Connectivity (6-8h)
- **Fiche :** `docs/agents/agent-frontend-sites-connectivity.md`
- **Mission :** Ajouter 3 champs connectivity form (internet, backup, procedure)
- **Fichiers à modifier :** sites/new/page.tsx + sites/[id]/edit/page.tsx
- **Backend DTO :** ✅ Prêt (internet?, backup?, procedure?)
- **Priorité :** 🟡 Moyenne (info importante chantiers)

#### Agent 3 : Frontend Tasks Checklist (4-6h)
- **Fiche :** `docs/agents/agent-frontend-tasks-checklist.md`
- **Mission :** Checklist interactive (toggle/add/delete items)
- **Fichier à modifier :** frontend/src/app/dashboard/tasks/[id]/page.tsx
- **Backend API :** ✅ Prêt (PATCH /api/tasks/:id)
- **Priorité :** 🔴 Haute (fonctionnalité clé MVP)

## 🚀 TES ACTIONS (Development Team Lead)

### Étape 1 : Validation Pré-Lancement (15 min)

**Vérifie que tu as bien :**

1. [ ] Lu les 5 fichiers obligatoires (CLAUDE.md, PROJECT_STATUS.md, DEVELOPMENT_TEAM_READY.md, etc.)
2. [ ] Compris les 3 gaps MVP (Tasks, Sites, Providers)
3. [ ] Accès aux 3 fiches agents (docs/agents/)
4. [ ] Backend API 100% prêt pour les 3 modules
5. [ ] Infrastructure production déployée (https://xch.eoncom.io)

**Ensuite, confirme-moi :**
```markdown
✅ PRÉ-LANCEMENT VALIDÉ

**Fichiers lus :**
- [x] CLAUDE.md
- [x] PROJECT_STATUS.md
- [x] DEVELOPMENT_TEAM_READY.md
- [x] ANALYSE_FINALISATION_PRODUCTION.md
- [x] agent-dev-team-lead.md

**Gaps compris :**
- Gap 1 : Tasks Checklist (60% → 100%, 4-6h)
- Gap 2 : Sites Connectivity (50% → 100%, 6-8h)
- Gap 3 : Providers CRUD (0% → 100%, 16-24h)

**Backend API :**
- [x] Tasks PATCH /api/tasks/:id
- [x] Sites POST/PATCH /api/sites
- [x] Providers GET/POST/PATCH/DELETE /api/providers

**Infrastructure :**
- [x] Production déployée (xch.eoncom.io)
- [x] SSH access ready (xch-deploy)
- [x] Docker configured

✅ PRÊT À LANCER 3 AGENTS EN PARALLÈLE
```

### Étape 2 : Lancement 3 Agents Parallèle (Immédiat)

**Tu vas utiliser l'outil Task pour lancer 3 agents simultanément :**

#### Commande 1 : Lancer Agent Providers CRUD
```markdown
Utilise outil Task avec subagent_type="general-purpose"

Prompt : [Copier INTÉGRALEMENT section "Prompt d'instanciation" de docs/agents/agent-frontend-providers-crud.md]

Description : "Agent Providers CRUD - Créer module complet"
```

#### Commande 2 : Lancer Agent Sites Connectivity
```markdown
Utilise outil Task avec subagent_type="general-purpose"

Prompt : [Copier INTÉGRALEMENT section "Prompt d'instanciation" de docs/agents/agent-frontend-sites-connectivity.md]

Description : "Agent Sites Connectivity - Ajouter 3 champs form"
```

#### Commande 3 : Lancer Agent Tasks Checklist
```markdown
Utilise outil Task avec subagent_type="general-purpose"

Prompt : [Copier INTÉGRALEMENT section "Prompt d'instanciation" de docs/agents/agent-frontend-tasks-checklist.md]

Description : "Agent Tasks Checklist - Interactive toggle/add/delete"
```

**⚠️ CRITIQUE : Lance les 3 agents dans UN SEUL message (3 appels Task en parallèle)**

### Étape 3 : Suivi Agents (Toutes les 2h)

**Pendant que les agents travaillent :**

1. [ ] Vérifier avancement Agent Providers (le plus long, 16-24h)
2. [ ] Vérifier avancement Agent Sites (6-8h)
3. [ ] Vérifier avancement Agent Tasks (4-6h)
4. [ ] Répondre aux questions agents si blocages
5. [ ] Valider livrables intermédiaires si demandés

**Rendez-vous dans 6-8h pour intégration finale**

### Étape 4 : Intégration Livrables (2h après agents terminés)

**Quand les 3 agents ont terminé :**

1. [ ] Récupérer livrables Agent Providers (5 fichiers créés)
2. [ ] Récupérer livrables Agent Sites (2 fichiers modifiés)
3. [ ] Récupérer livrables Agent Tasks (1 fichier modifié)
4. [ ] Code review (TypeScript strict, TanStack Query, invalidateQueries, shadcn/ui)
5. [ ] Résoudre conflits Git si nécessaires
6. [ ] Merger code dans branche main

### Étape 5 : Déploiement Production (1h)

**Commandes bash déploiement :**

```bash
# 1. Commit code
git add .
git commit -m "feat: Complete 3 MVP frontend gaps (Tasks Checklist, Sites Connectivity, Providers CRUD)

- Tasks: Interactive checklist (toggle/add/delete items)
- Sites: Connectivity form complete (internet, backup, procedure)
- Providers: Full CRUD module (list, detail, create, edit, delete)

Co-Authored-By: Agent Providers CRUD <noreply@anthropic.com>
Co-Authored-By: Agent Sites Connectivity <noreply@anthropic.com>
Co-Authored-By: Agent Tasks Checklist <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main

# 2. SSH serveur production
ssh xch-deploy

# 3. Pull code
cd /opt/xch-dev/XCH
git pull origin main

# 4. Rebuild frontend Docker
docker stop xch-frontend
docker rm xch-frontend
cd frontend
docker build -t xch_frontend .

# 5. Redémarrer frontend
docker run -d --name xch-frontend \
  --network xch_xch-network \
  -p 3001:3001 \
  --env-file .env.production \
  xch_frontend

# 6. Valider déploiement
curl -I https://xch.eoncom.io
curl -I https://xch.eoncom.io/dashboard/providers

# 7. Logs si erreur
docker logs -f xch-frontend
```

### Étape 6 : Tests Manuels (1h)

**Tests à effectuer en production :**

#### Test 1 : Checklist Tasks Interactive
```
URL : https://xch.eoncom.io/dashboard/tasks/[id]
1. Ouvrir tâche existante
2. Cliquer checkbox → vérifier toggle
3. Ajouter nouvel item → vérifier ajout
4. Supprimer item → vérifier suppression
5. Rafraîchir page → vérifier persistence
✅ Attendu : Checklist interactive fonctionnelle
```

#### Test 2 : Connectivity Form Sites
```
URL : https://xch.eoncom.io/dashboard/sites/new
1. Remplir formulaire création
2. Ajouter champs : internet, backup, procedure
3. Soumettre formulaire
4. Vérifier site créé avec connectivity
5. Éditer site → vérifier champs connectivity sauvegardés
✅ Attendu : 3 champs connectivity fonctionnels
```

#### Test 3 : Providers Module CRUD
```
URL : https://xch.eoncom.io/dashboard/providers
1. Accéder liste providers
2. Créer nouveau provider (type: integrator)
3. Voir détail provider
4. Éditer provider (modifier nom)
5. Supprimer provider
✅ Attendu : CRUD complet fonctionnel
```

### Étape 7 : Validation Finale (30 min)

**Checklist finale avant déclarer MVP 100% :**

#### Fonctionnel
- [ ] Checklist Tasks interactive fonctionne (toggle/add/delete)
- [ ] Connectivity form Sites sauvegarde 3 champs
- [ ] Providers CRUD complet (liste/détail/create/edit/delete)
- [ ] Aucune erreur console critique
- [ ] Responsive mobile validé

#### Technique
- [ ] Build frontend sans erreurs TypeScript
- [ ] `invalidateQueries()` présent dans toutes mutations
- [ ] Error handling toast sur toutes erreurs API
- [ ] Validation Zod sur tous formulaires
- [ ] Composants shadcn/ui utilisés (pas UI custom)

#### Documentation
- [ ] PROJECT_STATUS.md mis à jour (Frontend 100% ✅)
- [ ] TODO.md nettoyé (retirer tâches terminées)
- [ ] CHANGELOG.md updated (v1.0.3)
- [ ] DEVELOPMENT_LOG.md session ajoutée

#### Déploiement
- [ ] Code pushed GitHub (branch main)
- [ ] Frontend rebuild production OK
- [ ] Tests production validés (https://xch.eoncom.io)
- [ ] Aucun bug critique identifié

**Si TOUTES les cases cochées :**

```markdown
🎊 MVP XCH 100% FRONTEND COMPLET ! 🎊

**Frontend :** 100% ✅ (8/8 modules)
- Sites (carte + CRUD + connectivity form ✅)
- Assets (QR codes + scanner PWA)
- Tasks (Kanban + checklist interactive ✅)
- Racks (montage 4U-42U)
- FloorPlans (viewer + pins)
- Users (RBAC 4 rôles)
- Settings (profil + intégrations)
- Providers (CRUD complet ✅)

**Backend :** 100% ✅ (10 modules, ~100 endpoints)
**Production :** ✅ Déployée (https://xch.eoncom.io)

🚀 MVP PRODUCTION-READY COMPLET 🚀
```

## 📊 MÉTRIQUES ATTENDUES

| Métrique | Avant | Après |
|----------|-------|-------|
| **Modules Frontend** | 7/8 (87%) | 8/8 (100%) |
| **Pages Fonctionnelles** | 17 | 21 (+4 Providers) |
| **Features MVP** | 27/30 (90%) | 30/30 (100%) |
| **Gaps Critiques** | 3 | 0 |
| **Effort Développement** | 26-38h séq. | 6-8h parallèle |

## 🎯 RÉSULTAT FINAL ATTENDU

**Après Session Multi-Agent :**

```
Backend      ████████████████████ 100% (10/10 modules)
Frontend     ████████████████████ 100% (8/8 modules) ✅
Tests        ███░░░░░░░░░░░░░░░░░  15% (2/57 E2E)
Docs         ████████████████████ 100%
CI/CD        ██████████░░░░░░░░░░  50%

MVP TOTAL    ████████████████████ 100% ✅
```

**Fonctionnalités MVP COMPLÈTES :**
- ✅ Gestion chantiers (carte + CRUD + connectivity ✅)
- ✅ Inventaire assets (QR codes + scanner PWA)
- ✅ Plans d'étage (upload + viewer + pins)
- ✅ Gestion baies 4U-42U (montage équipements)
- ✅ Tâches Kanban (drag & drop + checklist interactive ✅)
- ✅ Providers (CRUD complet ✅)
- ✅ Auth + RBAC (4 rôles)
- ✅ Mobile-first responsive + PWA

## 🚨 CONTRAINTES CRITIQUES (NON-NÉGOCIABLES)

**Patterns Frontend Obligatoires :**
- ✅ TanStack Query v5 (`useQuery`, `useMutation`)
- ✅ `invalidateQueries()` après TOUTES mutations
- ✅ shadcn/ui composants uniquement (pas UI custom)
- ✅ Validation Zod sur tous formulaires
- ✅ TypeScript strict (pas de `any`)
- ✅ Error handling toast complet
- ✅ Responsive design mobile-first

**Architecture Next.js 15 :**
- Next.js App Router (pas Pages Router)
- Server Components par défaut
- Client Components avec `'use client'`
- Cookies HTTP-only pour auth (domain: '.eoncom.io')
- API calls via services/ (pas fetch direct)

**Problèmes SSR connus à éviter :**
- Konva/canvas → webpack externalize (déjà résolu)
- @zxing/library → dynamic import (déjà résolu)
- Middleware Next.js auth → désactivé (auth client-side)

## 📚 RESSOURCES DISPONIBLES

**Documentation :**
- DEVELOPMENT_TEAM_READY.md - Guide complet (⭐ LIRE EN PREMIER)
- docs/agents/ - 4 fiches agents (lead + 3 spécialisés)
- frontend/README.md - Stack technique
- docs/architecture/tech-stack.md - Stack complète

**Exemples Code :**
- frontend/src/app/dashboard/sites/new/page.tsx - Formulaire création
- frontend/src/app/dashboard/assets/page.tsx - Liste avec recherche
- frontend/src/services/sites.ts - API client pattern

**Backend API :**
- Swagger : https://xchapi.eoncom.io/api
- Tasks : PATCH /api/tasks/:id
- Sites : POST/PATCH /api/sites
- Providers : GET/POST/PATCH/DELETE /api/providers

## ✅ FORMAT RÉPONSE ATTENDU

**Quand tu lances les agents, réponds avec :**

```markdown
🚀 LANCEMENT MULTI-AGENT - 3 Agents Spécialisés

**Pré-lancement :** ✅ Validé
- Fichiers lus : 5/5 ✅
- Gaps compris : 3/3 ✅
- Backend API ready : 3/3 ✅
- Infrastructure production : ✅

**Agents lancés en parallèle :**

1. ✅ Agent Providers CRUD (16-24h)
   - Agent ID : [ID]
   - Mission : Créer module complet (4 pages + service)
   - Statut : ⏳ En cours

2. ✅ Agent Sites Connectivity (6-8h)
   - Agent ID : [ID]
   - Mission : Ajouter 3 champs form
   - Statut : ⏳ En cours

3. ✅ Agent Tasks Checklist (4-6h)
   - Agent ID : [ID]
   - Mission : Checklist interactive
   - Statut : ⏳ En cours

**Rendez-vous :** Dans 6-8h pour intégration livrables

**Prochaine action :** Suivi agents toutes les 2h
```

---

**TU ES PRÊT À LANCER LE MODE MULTI-AGENT ! 🚀**
```

---

## 📌 NOTES IMPORTANTES

**Ce prompt fait :**
- ✅ Lance 3 agents spécialisés en parallèle (outil Task)
- ✅ Coordonne développement frontend (Development Team Lead)
- ✅ Gère intégration livrables (code review + merge)
- ✅ Déploie production (Docker rebuild)
- ✅ Valide tests manuels (3 fonctionnalités)
- ✅ Met à jour documentation (PROJECT_STATUS, CHANGELOG)

**Ce prompt NE fait PAS :**
- ❌ Coder directement (délégué aux 3 agents)
- ❌ Déployer sans validation (attend tests manuels OK)
- ❌ Skipper code review (qualité obligatoire)

**Délai estimé :** 6-8h total (au lieu de 26-38h séquentiels)

---

**Date création :** 2026-02-01
**Prochaine utilisation :** Copier-coller dans nouvelle session Claude Code
**Objectif :** Frontend XCH 90% → 100% MVP ✅
