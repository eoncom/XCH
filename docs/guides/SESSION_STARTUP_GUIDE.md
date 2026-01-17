# Guide de Démarrage Session - Projet XCH

**Objectif :** Procédure standardisée pour démarrer chaque nouvelle session de travail efficacement.

**Gain de temps :** ~10-15 minutes par session (procédure automatisée)

---

## 🚀 Démarrage Nouvelle Session (2 minutes)

### Option 1 : Prompt Rapide (Recommandé)

**Copier-coller ce prompt au démarrage de chaque session :**

```
Projet XCH - Démarrage Session

Contexte :
- Chemin local : C:\xampp\htdocs\XCH
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH

Lis d'abord pour contexte complet :
1. CLAUDE.md (rôle + règles)
2. docs/status/PROJECT_STATUS.md (SOURCE DE VÉRITÉ)
3. TODO.md (tâches en cours)
4. DEVELOPMENT_LOG.md (dernières sessions)

Ensuite :
- Résume l'état actuel du projet (1 paragraphe)
- Liste les 3 prochaines tâches prioritaires
- Demande confirmation avant de commencer
```

---

### Option 2 : Prompt Détaillé (Pour sessions complexes)

```
Projet XCH - Démarrage Session Détaillé

📁 Contexte Projet :
- Chemin local : C:\xampp\htdocs\XCH
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH
- Permissions docker : ✅

📚 Fichiers à Lire (dans cet ordre) :
1. CLAUDE.md - Instructions lead technique (rôle, règles, conventions)
2. docs/status/PROJECT_STATUS.md - État du projet (SOURCE DE VÉRITÉ)
3. TODO.md - Tâches en cours + priorités
4. DEVELOPMENT_LOG.md - Historique sessions (10 dernières entrées)
5. AUTO_DOC_SYSTEM_SUMMARY.md - Système documentation automatique

🎯 Ta Mission :
1. Lire les 5 fichiers ci-dessus
2. Analyser l'état actuel du projet
3. Identifier les blocages éventuels
4. Proposer 3 prochaines tâches prioritaires avec justification
5. Attendre ma confirmation avant de commencer

🤖 Documentation Automatique :
Système actif (zéro maintenance manuelle) :
- Niveau 1 : Git Hook post-commit ✅
- Niveau 2 : Agent local (./scripts/auto-doc-agent.sh start)
- Niveau 3 : GitHub Actions ✅

📊 Informations Utiles :
- MVP : 100% terminé (production-ready)
- Tests E2E : 58 tests Playwright créés
- CI/CD : GitHub Actions opérationnelle
- Déploiement : Serveur 192.168.0.13 (prod)

⚠️ Rappels Importants :
- Toujours consulter PROJECT_STATUS.md en premier (source de vérité unique)
- Documentation maintenue automatiquement (ne PAS mettre à jour manuellement)
- Commits conventionnels (feat/fix/docs/test/refactor/chore)
- Tests E2E à valider après modifications frontend/backend

🚦 Statut Attendu :
- Résumé état projet (1-2 paragraphes)
- Top 3 tâches prioritaires
- Estimation complexité (faible/moyenne/élevée)
- Demande confirmation avant démarrage
```

---

## 📋 Checklist Démarrage Session

### Étape 1 : Vérifier Infrastructure (30 secondes)

**Local (Windows/WSL2) :**
```bash
cd /c/xampp/htdocs/XCH

# Vérifier git status
git status

# Vérifier git branch
git branch

# Pull derniers changements
git pull

# Vérifier agent documentation
./scripts/auto-doc-agent.sh status
```

**Serveur Production (si nécessaire) :**
```bash
ssh xch-deploy

cd /opt/xch-dev/XCH

# Vérifier containers Docker
docker ps

# Vérifier logs services
docker logs xch-backend --tail 20
docker logs xch-frontend --tail 20
```

---

### Étape 2 : Lire Contexte (1 minute)

**Ordre de lecture prioritaire :**

1. **docs/status/PROJECT_STATUS.md** ⭐ SOURCE DE VÉRITÉ
   - État global projet (%)
   - Modules backend/frontend (statut)
   - Tests (statut)
   - Déploiement (statut)

2. **TODO.md**
   - Tâches URGENT (⚠️)
   - Tâches HIGH (🔴)
   - Tâches en cours

3. **DEVELOPMENT_LOG.md** (dernières entrées)
   - Session précédente (actions, problèmes, résultat)
   - Commits récents

4. **CLAUDE.md** (si nouvelle session ou longue pause)
   - Règles de travail
   - Conventions projet
   - État actuel projet

---

### Étape 3 : Valider Système Documentation (30 secondes)

```bash
# Vérifier agent documentation local
./scripts/auto-doc-agent.sh status

# Si agent non démarré, le démarrer
./scripts/auto-doc-agent.sh start

# Vérifier logs agent
tail -n 10 .claude/auto-doc-agent.log
```

---

### Étape 4 : Demander Résumé à Claude (immédiat)

**Prompt court :**
```
Résume l'état actuel du projet XCH et propose 3 prochaines tâches prioritaires.
```

**Claude va :**
1. Lire PROJECT_STATUS.md
2. Lire TODO.md
3. Lire DEVELOPMENT_LOG.md (dernières entrées)
4. Résumer état projet (1-2 paragraphes)
5. Proposer 3 tâches prioritaires avec justification

---

## 🎯 Workflow Session Type

### Session Développement (2-4h)

```
1. Démarrage session (2 min)
   ↓
2. Lecture contexte (1 min)
   ↓
3. Résumé état + priorités (immédiat)
   ↓
4. Confirmation tâche (30 sec)
   ↓
5. Développement (1-3h)
   ↓
6. Tests manuels (15-30 min)
   ↓
7. Commit + Push (2 min)
   ↓
8. Vérification agent doc (30 sec)
   ↓
9. Update TODO.md si nécessaire (1 min)
   ↓
10. Fin session
```

**Total overhead : ~7 minutes (documentation automatique)**

---

### Session Débogage (1-2h)

```
1. Démarrage session (2 min)
   ↓
2. Lecture contexte (1 min)
   ↓
3. Analyse bug (15-30 min)
   ↓
4. Fix + Tests (30-60 min)
   ↓
5. Commit + Push (2 min)
   ↓
6. Vérification agent doc (30 sec)
   ↓
7. Update TODO.md (bug résolu) (1 min)
   ↓
8. Fin session
```

---

### Session Tests E2E (1-2h)

```
1. Démarrage session (2 min)
   ↓
2. Lecture contexte (1 min)
   ↓
3. Validation tests existants (30 min)
   ↓
4. Corrections tests (30-60 min)
   ↓
5. Exécution tests (10-15 min)
   ↓
6. Analyse résultats (15 min)
   ↓
7. Commit + Push (2 min)
   ↓
8. Update TODO.md (1 min)
   ↓
9. Fin session
```

---

## 🤖 Système Documentation Automatique

### Rappel : ZÉRO Maintenance Manuelle

**Fichiers maintenus automatiquement :**
- ✅ `PROJECT_STATUS.md` - Timestamp mis à jour automatiquement
- ✅ `DEVELOPMENT_LOG.md` - Auto-log commits (Git Hook)
- ✅ `AUTO_PROGRESS_REPORT.md` - Stats code + activité (Agent + GitHub Actions)
- ✅ `CHANGELOG.md` - Historique changements (GitHub Actions)

**❌ NE PAS mettre à jour manuellement ces fichiers !**

**Système actif :**
- Niveau 1 : Git Hook (`.claude/hooks/post-commit`) - À chaque commit
- Niveau 2 : Agent Local (`scripts/auto-doc-agent.sh`) - Toutes les 60s
- Niveau 3 : GitHub Actions (`.github/workflows/auto-doc-update.yml`) - Push + Daily

**Vérification système :**
```bash
# Agent local
./scripts/auto-doc-agent.sh status

# Logs agent
tail -f .claude/auto-doc-agent.log

# GitHub Actions
# Voir sur GitHub → Actions → "Auto-Update Documentation"
```

---

## 📊 Lecture PROJECT_STATUS.md

**Section critique : ÉTAT D'AVANCEMENT DÉTAILLÉ**

**Backend :**
```markdown
| # | Module | Statut | Endpoints | Tests |
|---|--------|--------|-----------|-------|
| 1 | Auth | ✅ | ~10 | Manuel |
| 2 | RBAC | ✅ | ~8 | Manuel |
...
```

**Frontend :**
```markdown
| # | Module | Pages | Features Clés |
|---|--------|-------|---------------|
| 1 | Dashboard | 1 | Stats API, Leaflet, navigation |
| 2 | Sites | 3 | Liste, carte, détail, CRUD |
...
```

**Tests E2E :**
```markdown
- Tests créés : 58
- Tests passants : 6/14 auth (Known Issue SSR/CSR)
- Coverage : 95% scénarios critiques
```

**Déploiement :**
```markdown
- Serveur : 192.168.0.13
- Backend : http://192.168.0.13:3002 ✅
- Frontend : http://192.168.0.13:3001 ✅
- Status : Production-Ready
```

---

## 🔍 Interprétation TODO.md

**Priorités :**

| Symbole | Priorité | Action |
|---------|----------|--------|
| ⚠️ | URGENT | À faire immédiatement |
| 🔴 | HIGH | Cette session ou prochaine |
| 🟡 | MEDIUM | Cette semaine |
| 🟢 | LOW | Quand disponible |
| 📝 | NOTE | Information importante |

**Exemple lecture :**
```markdown
## 🔴 HIGH Priority

- [ ] ⚠️ URGENT : Fix Rack Viewer crash (Bug #1)
  - Cause : Champ `brand` manquant dans assets query
  - Impact : Page d'erreur au clic sur rack
  - Effort : 30 min

- [ ] 🔴 Fix Data inconsistency (Bug #5)
  - Dashboard "25U/216U" mais liste racks "0% tous"
  - Effort : 1h
```

**Interprétation :**
1. Démarrer par URGENT (⚠️)
2. Puis HIGH (🔴)
3. Si multiple URGENT, choisir par impact
4. Si temps restant, MEDIUM (🟡)

---

## 💡 Bonnes Pratiques Session

### 1. Toujours Lire PROJECT_STATUS.md en Premier

**Pourquoi :**
- Source de vérité unique
- État global du projet
- Évite re-check inutiles

**Commande :**
```bash
cat docs/status/PROJECT_STATUS.md
```

---

### 2. Vérifier Agent Documentation Démarré

**Avant chaque session :**
```bash
./scripts/auto-doc-agent.sh status
```

**Si non démarré :**
```bash
./scripts/auto-doc-agent.sh start
```

---

### 3. Commits Conventionnels

**Préfixes standards :**
```bash
feat: Nouvelle fonctionnalité
fix: Correction bug
docs: Documentation
test: Tests
refactor: Refactoring
chore: Maintenance
```

**Exemples :**
```bash
git commit -m "feat: Add user profile editing feature"
git commit -m "fix: Correct RBAC permissions for TECHNICIEN role"
git commit -m "docs: Update SESSION_12 final report"
git commit -m "test: Add E2E tests for assets CRUD"
```

---

### 4. Vérifier Tests E2E Après Modifications

**Si modifications backend/frontend :**
```bash
# Lancer tests E2E locaux
cd frontend
npm run test:e2e

# Ou sur serveur (Docker)
ssh xch-deploy
cd /opt/xch-dev/XCH
docker compose -f docker-compose.e2e.yml run --rm playwright-tests npx playwright test
```

---

### 5. Pull Avant Push

**Toujours :**
```bash
git pull
git push
```

**Évite conflits et perte de travail.**

---

## 🚨 Situations Fréquentes

### Session Après Longue Pause (>7 jours)

**Prompt étendu :**
```
Projet XCH - Reprise après pause

Contexte :
- Dernière session : [date]
- Chemin local : C:\xampp\htdocs\XCH

Lis d'abord :
1. CLAUDE.md (règles + conventions)
2. docs/status/PROJECT_STATUS.md (état actuel)
3. DEVELOPMENT_LOG.md (10 dernières sessions)
4. TODO.md (tâches en cours)
5. AUTO_DOC_SYSTEM_SUMMARY.md (système doc auto)

Ensuite :
- Résume changements depuis dernière session
- État actuel projet (MVP, tests, déploiement)
- Tâches prioritaires (top 3)
- Nouveautés importantes
- Demande confirmation avant démarrage
```

---

### Session Débogage Production

**Prompt spécialisé :**
```
Projet XCH - Débogage Production

Contexte :
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH
- Backend : http://192.168.0.13:3002
- Frontend : http://192.168.0.13:3001

Bug rapporté :
[Description bug]

Ta mission :
1. Lire PROJECT_STATUS.md + DEVELOPMENT_LOG.md
2. Analyser logs serveur (docker logs xch-backend, xch-frontend)
3. Reproduire bug localement si possible
4. Identifier cause racine
5. Proposer fix avec impact estimation
6. Attendre confirmation avant déploiement prod
```

---

### Session Tests E2E

**Prompt spécialisé :**
```
Projet XCH - Validation Tests E2E

Contexte :
- Tests E2E : 58 tests Playwright créés (Session 11)
- Statut actuel : 6/14 tests auth passants (Known Issue SSR/CSR)
- Serveur tests : 192.168.0.13

Ta mission :
1. Lire docs/testing/E2E_VALIDATION_REPORT.md
2. Valider tests modules non-auth (Sites, Assets, Tasks, Racks, FloorPlans)
3. Identifier tests échouants et causes
4. Corriger sélecteurs/assertions si nécessaire
5. Exécuter tests et analyser résultats
6. Mettre à jour rapport validation
```

---

## 📞 Aide Rapide

### Commandes Utiles

**Git :**
```bash
git status                     # Statut fichiers modifiés
git log --oneline -10          # 10 derniers commits
git diff                       # Changements non staged
git pull                       # Pull derniers changements
git push                       # Push commits
```

**Agent Documentation :**
```bash
./scripts/auto-doc-agent.sh start    # Démarrer agent
./scripts/auto-doc-agent.sh stop     # Arrêter agent
./scripts/auto-doc-agent.sh status   # Voir statut
./scripts/auto-doc-agent.sh restart  # Redémarrer
tail -f .claude/auto-doc-agent.log   # Voir logs temps réel
```

**Docker (Serveur) :**
```bash
ssh xch-deploy
docker ps                          # Voir containers actifs
docker logs xch-backend --tail 50  # Logs backend (50 dernières lignes)
docker logs xch-frontend --tail 50 # Logs frontend
docker logs -f xch-backend         # Logs temps réel
```

**Tests E2E :**
```bash
cd frontend
npm run test:e2e                   # Tous tests (local)
npm run test:e2e:headed            # Avec navigateur visible
npm run test:e2e:ui                # UI interactive Playwright
```

---

## 🎯 Template Session Standard

**À copier-coller au démarrage :**

```
Projet XCH - Session [Numéro]

📁 Contexte :
- Chemin local : C:\xampp\htdocs\XCH
- Serveur : ssh xch-deploy → /opt/xch-dev/XCH

📚 Lecture Contexte :
1. docs/status/PROJECT_STATUS.md (source de vérité)
2. TODO.md (tâches prioritaires)
3. DEVELOPMENT_LOG.md (dernière session)

🎯 Mission :
1. Résumer état actuel projet (1 paragraphe)
2. Lister 3 prochaines tâches prioritaires
3. Attendre confirmation avant démarrage

🤖 Documentation automatique :
Agent local : ./scripts/auto-doc-agent.sh status
```

---

## ✅ Checklist Fin Session

Avant de terminer la session :

- [ ] Tous changements committed
- [ ] Push vers GitHub effectué
- [ ] Agent documentation vérifié (./scripts/auto-doc-agent.sh status)
- [ ] TODO.md mis à jour si tâches terminées
- [ ] Tests E2E lancés si modifications backend/frontend
- [ ] Logs serveur vérifiés si déploiement prod

---

**Guide Créé le :** 2026-01-17
**Dernière Mise à Jour :** 2026-01-17
**Version :** 1.0

**Gain de temps : ~10-15 minutes par session (procédure standardisée)**
