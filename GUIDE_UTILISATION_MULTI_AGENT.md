# 📖 GUIDE UTILISATION MULTI-AGENT - XCH

**Version :** 1.0 Final
**Date :** 2026-02-01
**Pour :** Utilisateur final (toi !)

---

## 🎯 CE QUE TU AS MAINTENANT

Un **système complet multi-agent orchestration** pour finaliser XCH MVP à 100%.

### 📁 Fichiers Créés Aujourd'hui

| Fichier | Rôle | Taille |
|---------|------|--------|
| **START_SESSION.md** ⭐ | Prompt universel standard | 13 Ko |
| **GIT_AUTO_COMMIT_PROTOCOL.md** 🔄 | Règles commit automatique | 12 Ko |
| **DEVELOPMENT_TEAM_READY.md** 📚 | Guide Development Team | 11 Ko |
| PROMPT_CONTINUATION_SESSION.md | Prompt continuation (obsolète) | 6 Ko |
| PROMPT_MULTI_AGENT_LAUNCH.md | Prompt multi-agent (obsolète) | 15 Ko |
| docs/ANALYSE_FINALISATION_PRODUCTION.md | Analyse gaps MVP | 13 Ko |
| docs/agents/agent-dev-team-lead.md | Fiche orchestrateur | 8 Ko |
| docs/agents/agent-frontend-tasks-checklist.md | Fiche agent Tasks | 7 Ko |
| docs/agents/agent-frontend-sites-connectivity.md | Fiche agent Sites | 7 Ko |
| docs/agents/agent-frontend-providers-crud.md | Fiche agent Providers | 9 Ko |

**Total :** 11 fichiers, ~100 Ko documentation

---

## 🚀 UTILISATION SIMPLE (3 Étapes)

### Étape 1 : Ouvrir START_SESSION.md

```bash
# Chemin complet
C:\xampp\htdocs\XCH\START_SESSION.md

# Ou avec VS Code
cd C:\xampp\htdocs\XCH
code START_SESSION.md
```

### Étape 2 : Copier le Prompt

**Copie TOUT le contenu entre les ````markdown ... ````**

Le prompt commence par :
```markdown
# SESSION XCH - Mode Multi-Agent Orchestration

Bonjour ! Tu reprends le projet **XCH**...
```

Et finit par :
```markdown
**TU ES L'ORCHESTRATEUR. DÉCIDE. COORDONNE. LIVRE. 🚀**
```

**Taille :** ~454 lignes

### Étape 3 : Coller dans Nouvelle Session Claude Code

1. Ouvrir **nouvelle conversation** Claude Code
2. Coller le prompt (Ctrl+V)
3. Envoyer (Enter)
4. **L'orchestrateur fait TOUT automatiquement !**

---

## 🤖 CE QUE L'ORCHESTRATEUR FAIT AUTOMATIQUEMENT

### Phase 1 : Analyse (15-20 min)

```markdown
✅ Lecture automatique fichiers :
- CLAUDE.md (rôle, règles, conventions)
- PROJECT_STATUS.md (état projet - SOURCE VÉRITÉ)
- DEVELOPMENT_TEAM_READY.md (guide team)
- DEVELOPMENT_LOG.md (3 dernières sessions)
- Fichiers racine récents (29 jan → 01 fév)
- ANALYSE_FINALISATION_PRODUCTION.md (gaps MVP)
```

### Phase 2 : Diagnostic (5-10 min)

```markdown
📊 Diagnostic complet :

Backend : 100% ✅
Frontend : 90% ⚠️ (3 gaps : Tasks, Sites, Providers)
Tests : 15% ⚠️
Documentation : 100% ✅
CI/CD : 50% ⚠️
Production : ✅ Déployée

Prochaine action : Lancer 3 agents en parallèle
```

### Phase 3 : Orchestration (0 min - Décision automatique)

```markdown
🎯 Stratégie choisie : A - Multi-Agent Parallèle ⚡

Justification :
- 3 gaps MVP indépendants
- Fiches agents déjà créées
- Backend API 100% prêt
- Gain temps 70% (6-8h au lieu de 26-38h)
```

### Phase 4 : Exécution (6-8h)

```markdown
🚀 Lancement 3 agents en parallèle :

Agent 1 : Frontend Providers CRUD (16-24h)
Agent 2 : Frontend Sites Connectivity (6-8h)
Agent 3 : Frontend Tasks Checklist (4-6h)

Rendez-vous dans 6-8h pour intégration
```

### Phase 5 : Intégration (2h)

```markdown
🔄 Intégration automatique :

1. Code review (TypeScript, patterns, qualité)
2. Résoudre conflits Git
3. ⚠️ COMMIT + PUSH AUTOMATIQUE (NOUVEAU !)
   - Validation build TypeScript
   - git add <fichiers>
   - git commit avec message + co-authors
   - git push origin main
   - 🔔 Notification serveur pour git pull
```

### Phase 6 : Déploiement (1h)

```markdown
🚢 Rappel serveur :

ssh xch-deploy
cd /opt/xch-dev/XCH
git pull origin main  ← Code à jour automatiquement !
docker stop xch-frontend && docker rm xch-frontend
cd frontend
docker build -t xch_frontend .
docker run -d --name xch-frontend ...
```

### Phase 7 : Validation (1h)

```markdown
✅ Tests manuels + Mise à jour docs

Tests production :
- Checklist Tasks interactive
- Connectivity form Sites
- Providers CRUD

Documentation :
- PROJECT_STATUS.md → Frontend 100% ✅
- CHANGELOG.md → v1.0.3
- DEVELOPMENT_LOG.md → Session 16
```

---

## 🔄 GIT AUTO-COMMIT (NOUVEAU !)

### Ce qui change maintenant :

**AVANT (manuel) :**
```bash
# Agent termine
# Tu faisais manuellement :
git add fichiers
git commit -m "message"
git push origin main

# Serveur
ssh xch-deploy
git pull
```

**MAINTENANT (automatique) :**
```bash
# Agent termine
# L'orchestrateur fait automatiquement :
✅ Validation build TypeScript
✅ git add fichiers
✅ git commit avec message conventionnel + co-authors
✅ git push origin main
✅ Notification : "Code synchronisé, serveur peut git pull"

# Serveur (toi)
ssh xch-deploy && cd /opt/xch-dev/XCH && git pull origin main
# ✅ Code à jour immédiatement !
```

### Exemple Commit Automatique

```bash
# L'orchestrateur génère automatiquement :

git commit -m "$(cat <<'EOF'
feat(tasks): Add interactive checklist functionality

- Toggle checkbox to mark items as completed
- Add new checklist items with input field
- Delete checklist items with trash button
- Real-time persistence via PATCH /api/tasks/:id
- TanStack Query invalidation for auto-refresh

Technical:
TypeScript: ✅ Strict mode
TanStack Query: ✅ With invalidateQueries
shadcn/ui: ✅ Form components
Validation: ✅ Zod schemas
Responsive: ✅ Mobile tested

Co-Authored-By: Agent Frontend Tasks <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

git push origin main

echo "✅ Code synchronisé sur GitHub"
echo "🔔 Serveur peut git pull"
```

**Avantage :** GitHub toujours à jour, tu fais juste `git pull` sur le serveur !

---

## 📊 TIMELINE COMPLÈTE (1-2 Jours)

### Jour 1 (6-8h)

**Matin (9h-12h) :**
```
09:00 - Copier START_SESSION.md dans Claude Code
09:15 - Orchestrateur analyse projet (15 min)
09:20 - Orchestrateur lance 3 agents en parallèle
09:25 - Agents travaillent (toi peux faire autre chose)
12:00 - Check avancement agents (50% complet)
```

**Après-midi (14h-18h) :**
```
14:00 - Check avancement agents (80% complet)
16:00 - Agents terminent
16:30 - Orchestrateur intègre livrables
17:00 - ✅ COMMIT + PUSH AUTOMATIQUE (3 agents)
17:10 - Toi : ssh serveur + git pull + rebuild Docker
18:00 - Tests manuels production (3 fonctionnalités)
```

**Soir (19h-20h) :**
```
19:00 - Mise à jour documentation
19:30 - ✅ COMMIT + PUSH AUTOMATIQUE (docs)
19:40 - Validation finale
20:00 - 🎊 MVP 100% FRONTEND COMPLET !
```

---

## 🎯 RÉSULTAT FINAL ATTENDU

### Avant (aujourd'hui)

```
Backend      ████████████████████ 100% (10/10 modules)
Frontend     ████████████████░░░░  90% (7/8 modules, 3 gaps)
Tests        ███░░░░░░░░░░░░░░░░░  15% (2/57 E2E)
Docs         ████████████████████ 100%
CI/CD        ██████████░░░░░░░░░░  50%

MVP TOTAL    ████████████████░░░░  85%
```

### Après (demain)

```
Backend      ████████████████████ 100% (10/10 modules)
Frontend     ████████████████████ 100% (8/8 modules) ✅
Tests        ███░░░░░░░░░░░░░░░░░  15% (2/57 E2E)
Docs         ████████████████████ 100%
CI/CD        ██████████░░░░░░░░░░  50%

MVP TOTAL    ████████████████████ 100% ✅
```

**Fonctionnalités MVP COMPLÈTES :**
- ✅ Gestion chantiers (carte + CRUD + **connectivity** ✅)
- ✅ Inventaire assets (QR codes + scanner PWA)
- ✅ Plans d'étage (upload + viewer + pins)
- ✅ Gestion baies 4U-42U (montage équipements)
- ✅ Tâches Kanban (drag & drop + **checklist interactive** ✅)
- ✅ **Providers (CRUD complet)** ✅
- ✅ Auth + RBAC (4 rôles)
- ✅ Mobile-first responsive + PWA

---

## 📚 DOCUMENTATION RÉFÉRENCE

### Pour Toi (Utilisateur)

| Fichier | Usage |
|---------|-------|
| **START_SESSION.md** ⭐ | Prompt universel (utilise celui-ci) |
| **GIT_AUTO_COMMIT_PROTOCOL.md** 🔄 | Comprendre commits automatiques |
| **DEVELOPMENT_TEAM_READY.md** 📚 | Guide complet (lecture recommandée) |
| **GUIDE_UTILISATION_MULTI_AGENT.md** 📖 | Ce fichier (aide-mémoire) |

### Pour L'Orchestrateur (Claude)

| Fichier | Usage |
|---------|-------|
| CLAUDE.md | Rôle lead technique |
| PROJECT_STATUS.md | État projet (SOURCE VÉRITÉ) |
| ANALYSE_FINALISATION_PRODUCTION.md | Gaps MVP |
| docs/agents/agent-*.md | Fiches agents (4 fichiers) |

---

## ✅ CHECKLIST AVANT DE LANCER

### Préparation (5 min)

- [ ] J'ai lu ce guide (GUIDE_UTILISATION_MULTI_AGENT.md)
- [ ] J'ai accès à START_SESSION.md
- [ ] J'ai une nouvelle session Claude Code prête
- [ ] Je comprends que l'orchestrateur va commit automatiquement
- [ ] Je sais que je devrai faire `git pull` sur le serveur après

### Après Lancement (6-8h)

- [ ] Les 3 agents travaillent en parallèle
- [ ] Je check toutes les 2h pour voir avancement
- [ ] Je réponds aux questions agents si blocages

### Après Intégration (1h)

- [ ] Code committé et pushé automatiquement sur GitHub ✅
- [ ] Je fais `ssh xch-deploy && cd /opt/xch-dev/XCH && git pull`
- [ ] Je rebuild Docker frontend
- [ ] Je teste 3 fonctionnalités en production

### Validation Finale (30 min)

- [ ] Checklist Tasks fonctionne (toggle/add/delete)
- [ ] Connectivity form Sites sauvegarde 3 champs
- [ ] Providers CRUD complet fonctionnel
- [ ] Documentation mise à jour (PROJECT_STATUS, CHANGELOG)
- [ ] 🎊 MVP 100% Frontend ✅

---

## 🚨 PROBLÈMES FRÉQUENTS

### Problème 1 : "Je ne trouve pas START_SESSION.md"

**Solution :**
```bash
cd C:\xampp\htdocs\XCH
ls -lh START_SESSION.md
# Doit afficher : -rw-r--r-- 1 me 197121 13K févr. 1 13:22 START_SESSION.md
```

### Problème 2 : "L'orchestrateur ne commit pas automatiquement"

**Solution :**
Vérifier qu'il a bien lu GIT_AUTO_COMMIT_PROTOCOL.md. Si non, rappelle-lui :
```
Rappel : Tu DOIS commit + push automatiquement après chaque livrable agent.
Voir GIT_AUTO_COMMIT_PROTOCOL.md pour protocole exact.
```

### Problème 3 : "Conflit Git lors du pull serveur"

**Solution :**
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
git stash  # Sauvegarder modifications locales
git pull origin main
git stash pop  # Récupérer modifications si nécessaires
```

### Problème 4 : "Build TypeScript échoue après pull"

**Solution :**
```bash
cd frontend
npm install  # Réinstaller dépendances si package.json modifié
npm run build  # Vérifier erreurs
```

---

## 🎊 MESSAGE FINAL

**Tu as maintenant :**

✅ **1 prompt universel** (START_SESSION.md) - Utilise uniquement celui-ci
✅ **Orchestrateur intelligent** - Analyse + décide + exécute automatiquement
✅ **4 agents spécialisés** - Travaillent en parallèle (gain temps 70%)
✅ **Git auto-commit** - GitHub toujours à jour (tu fais juste git pull)
✅ **Documentation complète** - 11 fichiers, ~100 Ko

**Prochaine action :**

1. Copier `START_SESSION.md`
2. Coller dans nouvelle session Claude Code
3. Envoyer
4. **L'orchestrateur fait TOUT le reste !**

**Objectif :** Frontend XCH 90% → 100% en 6-8h (au lieu de 26-38h)

---

## 📞 AIDE RAPIDE

**Serveur production :**
- Frontend : https://xch.eoncom.io
- Backend API : https://xchapi.eoncom.io
- SSH : `ssh xch-deploy` → `/opt/xch-dev/XCH`

**Git après commit auto :**
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
git pull origin main
cd frontend
docker stop xch-frontend && docker rm xch-frontend
docker build -t xch_frontend .
docker run -d --name xch-frontend --network xch_xch-network -p 3001:3001 --env-file .env.production xch_frontend
```

**Tests production :**
- Tasks : https://xch.eoncom.io/dashboard/tasks/[id]
- Sites : https://xch.eoncom.io/dashboard/sites/new
- Providers : https://xch.eoncom.io/dashboard/providers

---

**🚀 BONNE FINALISATION MVP ! 🚀**

*Document créé le 2026-02-01 par Claude Sonnet 4.5*
