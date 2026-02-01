# 🔄 GIT AUTO-COMMIT PROTOCOL - XCH Multi-Agent

**Version :** 1.0
**Date :** 2026-02-01
**Objectif :** Commit/Push automatique après chaque livrable agent

---

## 🎯 PRINCIPE

**Problème :** Agents travaillent en parallèle, code doit être synchronisé sur serveur en temps réel.

**Solution :** L'orchestrateur commit et push automatiquement après chaque livrable d'agent.

**Avantage :** Serveur fait juste `git pull` pour récupérer code à jour.

---

## 📋 RÈGLES AUTO-COMMIT

### Quand Commit Automatiquement ?

1. ✅ **Après livrable agent terminé**
   - Agent Frontend Tasks → Commit immédiat
   - Agent Frontend Sites → Commit immédiat
   - Agent Frontend Providers → Commit immédiat

2. ✅ **Après correction bug**
   - Fix CORS MinIO → Commit immédiat
   - Fix validation → Commit immédiat

3. ✅ **Après mise à jour documentation**
   - PROJECT_STATUS.md → Commit immédiat
   - CHANGELOG.md → Commit immédiat

4. ✅ **Après modification fichier code**
   - Backend (.ts) → Commit immédiat
   - Frontend (.tsx, .ts) → Commit immédiat

### Quand NE PAS Commit ?

1. ❌ **Fichiers temporaires**
   - .env (ignoré par .gitignore)
   - node_modules/ (ignoré)
   - dist/, build/ (ignorés)

2. ❌ **Fichiers sensibles**
   - CREDENTIALS_ET_TOKEN.md (ignoré)
   - Clés privées (.key, .pem)

3. ❌ **Travail en cours non fonctionnel**
   - Code avec erreurs TypeScript
   - Tests qui échouent
   - Build qui plante

---

## 🔧 COMMANDES GIT STANDARD

### Template Commit Message

**Format conventionnel :**
```
<type>(<scope>): <description courte>

<description détaillée optionnelle>

<footer co-authors>
```

**Types valides :**
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction bug
- `docs` : Documentation
- `refactor` : Refactoring code
- `test` : Ajout tests
- `chore` : Maintenance

**Exemples :**
```bash
feat(tasks): Add interactive checklist (toggle/add/delete items)
fix(sites): Correct connectivity form validation
docs: Update PROJECT_STATUS to Frontend 100%
refactor(providers): Improve API client error handling
```

### Workflow Automatique

```bash
# 1. Vérifier modifications
git status

# 2. Ajouter fichiers modifiés
git add <fichiers>

# 3. Commit avec message conventionnel + co-authors
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<détails>

Co-Authored-By: Agent <Name> <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# 4. Push vers GitHub
git push origin main

# 5. Confirmer
echo "✅ Code synchronisé sur GitHub"
```

---

## 🤖 PROTOCOLE ORCHESTRATEUR

### Phase 1 : Réception Livrable Agent

**Quand un agent termine :**

```markdown
Agent Frontend Tasks terminé
Livrables :
- frontend/src/app/dashboard/tasks/[id]/page.tsx (modifié)
```

**Actions orchestrateur :**

1. **Code Review Rapide (2 min)**
   ```bash
   # Vérifier TypeScript compile
   cd frontend
   npm run build

   # Si erreurs → Demander correction agent
   # Si OK → Continuer
   ```

2. **Commit Automatique (1 min)**
   ```bash
   git add frontend/src/app/dashboard/tasks/[id]/page.tsx

   git commit -m "$(cat <<'EOF'
   feat(tasks): Add interactive checklist functionality

   - Toggle checkbox to mark items as completed
   - Add new checklist items with input field
   - Delete checklist items with trash button
   - Real-time persistence via PATCH /api/tasks/:id
   - TanStack Query invalidation for auto-refresh

   Co-Authored-By: Agent Frontend Tasks <noreply@anthropic.com>
   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```

3. **Push Automatique (30 sec)**
   ```bash
   git push origin main

   echo "✅ Agent Frontend Tasks livrable synchronisé"
   ```

4. **Notification Serveur (optionnel)**
   ```bash
   # Si webhook GitHub configuré, serveur reçoit notification auto
   # Sinon, rappeler utilisateur de faire git pull

   echo "🔔 Serveur peut faire: ssh xch-deploy && cd /opt/xch-dev/XCH && git pull origin main"
   ```

---

### Phase 2 : Commit Multiples Agents Parallèles

**Si 3 agents terminent en même temps :**

**Option A : 1 Commit Global (Recommandé)**

```bash
git add frontend/src/app/dashboard/tasks/[id]/page.tsx \
        frontend/src/app/dashboard/sites/new/page.tsx \
        frontend/src/app/dashboard/sites/[id]/edit/page.tsx \
        frontend/src/app/dashboard/providers/ \
        frontend/src/services/providers.ts

git commit -m "$(cat <<'EOF'
feat(frontend): Complete 3 MVP gaps (Tasks, Sites, Providers)

Tasks Module:
- Interactive checklist (toggle/add/delete items)
- Real-time persistence PATCH /api/tasks/:id

Sites Module:
- Connectivity form complete (internet, backup, procedure fields)
- Validation Zod schemas updated

Providers Module:
- Full CRUD implementation (list, detail, create, edit, delete)
- API client service with TanStack Query
- 4 pages created (page.tsx, new, [id], [id]/edit)

All modules:
- TypeScript strict mode ✅
- TanStack Query v5 with invalidateQueries ✅
- shadcn/ui components ✅
- Error handling with toast ✅
- Responsive design ✅

Co-Authored-By: Agent Frontend Tasks <noreply@anthropic.com>
Co-Authored-By: Agent Frontend Sites <noreply@anthropic.com>
Co-Authored-By: Agent Frontend Providers <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

git push origin main
```

**Option B : 3 Commits Séparés**

```bash
# Commit 1 : Agent Tasks
git add frontend/src/app/dashboard/tasks/[id]/page.tsx
git commit -m "feat(tasks): Add interactive checklist
Co-Authored-By: Agent Frontend Tasks <noreply@anthropic.com>"
git push origin main

# Commit 2 : Agent Sites
git add frontend/src/app/dashboard/sites/new/page.tsx frontend/src/app/dashboard/sites/[id]/edit/page.tsx
git commit -m "feat(sites): Add connectivity form fields
Co-Authored-By: Agent Frontend Sites <noreply@anthropic.com>"
git push origin main

# Commit 3 : Agent Providers
git add frontend/src/app/dashboard/providers/ frontend/src/services/providers.ts
git commit -m "feat(providers): Add complete CRUD module
Co-Authored-By: Agent Frontend Providers <noreply@anthropic.com>"
git push origin main
```

**Recommandation :** Option A (1 commit global) pour éviter spam commits.

---

## 🚀 DÉPLOIEMENT SERVEUR AUTOMATISÉ

### Webhook GitHub (Optionnel - Avancé)

**Si configuré :**
```bash
# Serveur reçoit notification automatique après push
# Script /opt/xch-dev/deploy-hook.sh s'exécute :

#!/bin/bash
cd /opt/xch-dev/XCH
git pull origin main
docker stop xch-frontend
docker rm xch-frontend
cd frontend
docker build -t xch_frontend .
docker run -d --name xch-frontend \
  --network xch_xch-network \
  -p 3001:3001 \
  --env-file .env.production \
  xch_frontend
echo "✅ Déploiement automatique terminé"
```

### Pull Manuel (Standard - Actuel)

**Sans webhook :**
```bash
# Après chaque push GitHub, utilisateur fait :
ssh xch-deploy
cd /opt/xch-dev/XCH
git pull origin main

# Si frontend modifié
docker stop xch-frontend && docker rm xch-frontend
cd frontend
docker build -t xch_frontend .
docker run -d --name xch-frontend \
  --network xch_xch-network \
  -p 3001:3001 \
  --env-file .env.production \
  xch_frontend

# Si backend modifié
docker stop xch-backend && docker rm xch-backend
cd backend
docker build -t xch_backend .
docker run -d --name xch-backend \
  --network xch_xch-network \
  -p 3002:3002 \
  --env-file .env \
  xch_backend
```

---

## 📋 CHECKLIST ORCHESTRATEUR (Avant Commit)

### Validation Code (2 min)

- [ ] Build TypeScript sans erreurs (`npm run build`)
- [ ] Pas de `console.log()` oubliés (sauf debug intentionnel)
- [ ] Pas de `any` TypeScript (strict mode)
- [ ] Imports corrects (pas de paths cassés)
- [ ] Patterns respectés (TanStack Query, shadcn/ui, Zod)

### Validation Git (1 min)

- [ ] `git status` → Uniquement fichiers attendus
- [ ] Pas de fichiers sensibles (.env, credentials)
- [ ] Message commit descriptif et conventionnel
- [ ] Co-authors ajoutés (agents + Claude)

### Validation Push (30 sec)

- [ ] Branch correcte (`git branch` → main)
- [ ] Remote correct (`git remote -v` → origin GitHub)
- [ ] Push réussi (pas de conflits)

---

## 🎯 SCÉNARIOS FRÉQUENTS

### Scénario 1 : Agent Frontend Tasks Terminé

```bash
# 1. Vérifier build
cd frontend
npm run build
# ✅ Build réussi

# 2. Vérifier fichiers modifiés
git status
# modified: src/app/dashboard/tasks/[id]/page.tsx

# 3. Commit + Push
git add src/app/dashboard/tasks/[id]/page.tsx
git commit -m "feat(tasks): Add interactive checklist

- Toggle checkbox completion
- Add new items
- Delete items
- TanStack Query invalidation

Co-Authored-By: Agent Frontend Tasks <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main

# 4. Notification
echo "✅ Tasks checklist synchronisé sur GitHub"
echo "🔔 Serveur peut git pull pour récupérer"
```

---

### Scénario 2 : Fix Bug CORS MinIO

```bash
# 1. Vérifier fichiers modifiés
git status
# modified: CONFIGURATION_NGINX.md

# 2. Commit + Push
git add CONFIGURATION_NGINX.md
git commit -m "docs: Add CORS configuration for MinIO (xchstr.eoncom.io)

Added Nginx headers configuration to fix floor-plans viewer
CORS blocking issue.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main

# 3. Notification
echo "✅ CORS config documenté sur GitHub"
```

---

### Scénario 3 : Mise à Jour Documentation Post-Agents

```bash
# 1. Vérifier fichiers modifiés
git status
# modified: docs/status/PROJECT_STATUS.md
# modified: CHANGELOG.md
# modified: DEVELOPMENT_LOG.md

# 2. Commit + Push
git add docs/status/PROJECT_STATUS.md CHANGELOG.md DEVELOPMENT_LOG.md
git commit -m "docs: Update project status to Frontend 100%

- PROJECT_STATUS.md: Frontend 90% → 100% (3 gaps completed)
- CHANGELOG.md: Add v1.0.3 with Tasks/Sites/Providers features
- DEVELOPMENT_LOG.md: Add Session 16 multi-agent completion

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main

# 3. Notification
echo "✅ Documentation synchronisée sur GitHub"
```

---

## 🚨 ERREURS FRÉQUENTES & SOLUTIONS

### Erreur 1 : Conflit Git

```bash
# Erreur
! [rejected] main -> main (fetch first)

# Solution
git pull origin main --rebase
git push origin main
```

### Erreur 2 : Fichiers Sensibles Détectés

```bash
# Erreur
warning: adding embedded git repository: .env

# Solution
# Vérifier .gitignore contient .env
cat .gitignore | grep .env

# Retirer fichier sensible
git reset HEAD .env
echo "⚠️ Fichier .env non committé (sensible)"
```

### Erreur 3 : Build TypeScript Échoue

```bash
# Erreur
ERROR in src/app/dashboard/tasks/[id]/page.tsx
TS2345: Argument of type 'string' is not assignable to parameter of type 'number'

# Solution
# NE PAS commit code cassé
echo "❌ Build échoue - Correction nécessaire avant commit"
# Demander agent de corriger
# Ou corriger directement
# Puis commit après build OK
```

---

## 📊 MÉTRIQUES AUTO-COMMIT

**Objectif :** Commits fréquents, petits, atomiques

**Bon rythme :**
- 1 commit par agent terminé (3 commits si 3 agents)
- 1 commit par bug fix
- 1 commit par mise à jour docs
- ~5-10 commits par session multi-agent

**Mauvais rythme :**
- 1 mega-commit avec 50 fichiers (difficile review)
- 0 commit pendant 8h puis tout d'un coup (perd historique)

---

## ✅ TEMPLATE COMMIT MESSAGE COMPLET

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description courte < 70 caractères>

<paragraphe 1: Pourquoi ce changement>
<paragraphe 2: Quoi a été modifié>
<paragraphe 3: Comment ça fonctionne>

<liste bullet points features si applicable>
- Feature 1
- Feature 2
- Feature 3

<footer technique si applicable>
TypeScript: ✅ Strict mode
Tests: ✅ Manuels passants
Responsive: ✅ Mobile validé

<co-authors OBLIGATOIRE>
Co-Authored-By: Agent <Name> <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Exemple concret :**

```bash
git commit -m "$(cat <<'EOF'
feat(providers): Implement complete CRUD module for providers management

Added comprehensive providers management system to track external
service providers (integrators, security, datacenter, network).

This completes the last MVP frontend gap, bringing frontend to 100%.

Features:
- List providers with search and filters
- Create provider with type selection and validation
- View provider details with contact information
- Edit provider with form pre-population
- Delete provider with confirmation dialog
- API client service with TanStack Query integration
- Full TypeScript strict mode compliance
- Responsive design mobile-first
- Error handling with toast notifications

Technical:
TypeScript: ✅ Strict mode (0 any, 0 errors)
TanStack Query: ✅ With invalidateQueries
shadcn/ui: ✅ Form, Input, Select, Button, Card
Validation: ✅ Zod schemas
Responsive: ✅ Mobile tested
Error handling: ✅ Toast on all errors

Files:
- frontend/src/app/dashboard/providers/page.tsx (new)
- frontend/src/app/dashboard/providers/new/page.tsx (new)
- frontend/src/app/dashboard/providers/[id]/page.tsx (new)
- frontend/src/app/dashboard/providers/[id]/edit/page.tsx (new)
- frontend/src/services/providers.ts (new)

Co-Authored-By: Agent Frontend Providers <noreply@anthropic.com>
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## 🎯 RÉSUMÉ PROTOCOLE

**L'orchestrateur DOIT :**

1. ✅ **Commit après chaque livrable agent** (immédiat)
2. ✅ **Push vers GitHub** (immédiat après commit)
3. ✅ **Valider build TypeScript avant commit** (2 min)
4. ✅ **Messages conventionnels + co-authors** (toujours)
5. ✅ **Notifier utilisateur pour git pull serveur** (après push)

**L'orchestrateur NE DOIT PAS :**

1. ❌ Commit code avec erreurs TypeScript
2. ❌ Commit fichiers sensibles (.env, credentials)
3. ❌ Commit fichiers temporaires (node_modules, dist)
4. ❌ Skip validation build
5. ❌ Oublier co-authors

---

**Date création :** 2026-02-01
**Statut :** Protocole standard obligatoire pour tous orchestrateurs
