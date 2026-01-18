# Tests E2E XCH - Validation et Prochaines Étapes

**Date:** 2026-01-13
**Session:** 11 - E2E Testing Infrastructure Complete
**Statut:** ✅ Infrastructure complète - Prêt pour validation serveur

---

## ✅ Récapitulatif - Ce qui a été livré

### 1. Infrastructure Playwright

**Installation:**
```bash
✅ Playwright v1.57.0 installé
✅ Support cross-browser (Chromium, Firefox, WebKit)
✅ Support mobile (Chrome, Safari)
✅ Configuration legacy-peer-deps (React 19 compatible)
```

**Configuration:**
```bash
✅ frontend/playwright.config.ts - Configuration complète
✅ frontend/.env.e2e - Variables environnement serveur
✅ frontend/.env.e2e.example - Template configuration
```

### 2. Tests E2E (58 tests total)

**Structure créée:**
```
frontend/e2e/
├── fixtures/
│   └── auth.fixture.ts (80 lignes) - Login/logout automation
├── helpers/
│   ├── navigation.ts (70 lignes) - Navigation helper class
│   └── test-data.ts (90 lignes) - Test data avec génération unique
└── tests/
    ├── auth/
    │   ├── login.spec.ts (120 lignes, 10 tests)
    │   └── logout.spec.ts (60 lignes, 4 tests)
    ├── sites/
    │   └── sites-crud.spec.ts (180 lignes, 8 tests)
    ├── assets/
    │   └── assets-crud.spec.ts (210 lignes, 9 tests)
    ├── tasks/
    │   └── tasks-kanban.spec.ts (180 lignes, 8 tests)
    ├── racks/
    │   └── racks-crud.spec.ts (200 lignes, 9 tests)
    └── floorplans/
        └── floorplans-crud.spec.ts (150 lignes, 10 tests)
```

**Couverture fonctionnelle:**
- ✅ Authentification (Login, Logout, Validation, Persistance)
- ✅ Sites (CRUD complet + Recherche + Filtres)
- ✅ Assets (CRUD + QR codes + Rattachement sites)
- ✅ Tasks (Kanban + Drag&Drop + TicketLink + Filtres)
- ✅ Racks (CRUD + Viewer Konva + Montage équipements)
- ✅ FloorPlans (CRUD + Upload + Pins + Édition)

### 3. Configuration Docker

**Fichiers créés:**
```bash
✅ frontend/Dockerfile.e2e - Image Playwright complète
✅ docker-compose.e2e.yml - Orchestration tests
✅ Network: xch_xch-network (même réseau que XCH)
```

**Fonctionnalités Docker:**
- ✅ Tests lancés depuis serveur (pas depuis local)
- ✅ Même réseau Docker que l'application
- ✅ Latence réseau minimale
- ✅ Reproductibilité totale
- ✅ Rapports exportés via volumes
- ✅ 2 workers + 2 retries en mode CI
- ✅ Rapports HTML + JUnit

### 4. Scripts NPM

**10 scripts ajoutés dans package.json:**
```json
✅ test:e2e - Lancer tous les tests
✅ test:e2e:ui - Mode UI interactif
✅ test:e2e:headed - Mode headed (voir navigateur)
✅ test:e2e:debug - Mode debug
✅ test:e2e:chromium - Tests Chrome uniquement
✅ test:e2e:firefox - Tests Firefox uniquement
✅ test:e2e:webkit - Tests Safari uniquement
✅ test:e2e:mobile - Tests mobile uniquement
✅ test:e2e:report - Voir rapport HTML
✅ test:e2e:codegen - Générer tests auto
```

### 5. Documentation

**Guides complets créés:**
```bash
✅ E2E_TESTS_QUICKSTART.md (250 lignes) - Quick start 5 minutes
✅ E2E_TESTS_SERVER_GUIDE.md (467 lignes) - Tests vers serveur distant
✅ E2E_TESTS_DOCKER_GUIDE.md (578 lignes) - Tests Docker sur serveur
✅ frontend/e2e/README.md (400 lignes) - Documentation complète
✅ docs/decisions/adr-007-e2e-testing-playwright.md (350 lignes) - ADR
✅ SESSION_11_E2E_TESTS.md (350 lignes) - Rapport session
```

### 6. Commits Git

```bash
✅ Commit 48236e7 - Session 11: Complete E2E testing system
✅ Commit 87ff84d - Update DEVELOPMENT_LOG Session 11
✅ Commit 4340e32 - Add Docker support for E2E tests
```

---

## 🎯 Prochaines Étapes - Validation Serveur

### Étape 1: Créer utilisateurs de test en base

Les tests nécessitent 4 utilisateurs avec emails spécifiques:

```bash
# Se connecter au serveur
ssh xch-deploy

# Accéder à PostgreSQL
cd /opt/xch-dev/XCH
docker exec -it xch-postgres psql -U xch_user -d xch_dev

# Vérifier utilisateurs actuels
SELECT email, name, role FROM "User" WHERE email LIKE '%@xch.local';
```

**Utilisateurs requis:**
- `admin@xch.local` - Role: ADMIN - Password: `Admin123!`
- `manager@xch.local` - Role: MANAGER - Password: `Manager123!`
- `tech@xch.local` - Role: TECHNICIEN - Password: `Tech123!`
- `viewer@xch.local` - Role: VIEWER - Password: `Viewer123!`

**Si absents, créer via:**
1. Interface admin: http://192.168.0.13:3001/dashboard/users
2. OU via SQL (voir `E2E_TESTS_SERVER_GUIDE.md` section "Création utilisateurs de test")

### Étape 2: Builder image Docker tests

```bash
# Sur le serveur
ssh xch-deploy
cd /opt/xch-dev/XCH

# Build image Playwright
docker compose -f docker-compose.e2e.yml build

# Vérifier image créée
docker images | grep xch-e2e
```

**Temps attendu:** ~5 minutes (première fois, puis cache)
**Taille image:** ~1.8 GB (inclut navigateurs Chromium, Firefox, WebKit)

### Étape 3: Lancer premier test (validation)

```bash
# Lancer un seul test Auth pour valider setup
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test tests/auth/login.spec.ts --project=chromium

# Si succès, lancer tous les tests
docker compose -f docker-compose.e2e.yml up
```

**Durée attendue:**
- 1 test Auth: ~30 secondes
- Suite complète (58 tests): ~10-12 minutes

### Étape 4: Analyser résultats

```bash
# Sur le serveur
cd /opt/xch-dev/XCH

# Voir résumé console
docker compose -f docker-compose.e2e.yml logs

# Liste des rapports générés
ls -lh frontend/playwright-report/
ls -lh frontend/test-results/

# Télécharger rapports en local (depuis Windows)
scp -r xch-deploy:/opt/xch-dev/XCH/frontend/playwright-report ./
start playwright-report/index.html
```

### Étape 5: Valider rapports

**Rapport HTML (playwright-report/index.html):**
- ✅ Tous les tests passés (58/58)
- ❌ Si échecs: voir screenshots dans `test-results/`

**Rapport JUnit (results.xml):**
- Pour intégration CI/CD future

### Étape 6: Cleanup

```bash
# Supprimer container tests
docker compose -f docker-compose.e2e.yml down

# Garder image pour prochaines exécutions
# (ou supprimer si rebuild complet nécessaire)
docker rmi xch-e2e-tests
```

---

## 📋 Checklist Validation

### Prérequis Serveur

- [ ] Serveur accessible: `ping 192.168.0.13`
- [ ] Frontend répond: `curl http://192.168.0.13:3001`
- [ ] Backend répond: `curl http://192.168.0.13:3002/api/health`
- [ ] Containers XCH running: `docker compose ps`
- [ ] PostgreSQL healthy: `docker compose ps xch-postgres`
- [ ] Redis healthy: `docker compose ps xch-redis`

### Utilisateurs de Test

- [ ] Admin créé: `admin@xch.local` (ADMIN)
- [ ] Manager créé: `manager@xch.local` (MANAGER)
- [ ] Technicien créé: `tech@xch.local` (TECHNICIEN)
- [ ] Viewer créé: `viewer@xch.local` (VIEWER)
- [ ] Mots de passe configurés selon `auth.fixture.ts`

### Docker E2E

- [ ] Image buildée: `docker images | grep xch-e2e`
- [ ] Réseau existe: `docker network ls | grep xch_xch-network`
- [ ] Volume playwright-report accessible
- [ ] Volume test-results accessible

### Premier Test

- [ ] Test Auth login passe (1 test)
- [ ] Token stocké correctement
- [ ] Redirection dashboard OK
- [ ] Aucune erreur console

### Suite Complète

- [ ] 58 tests exécutés
- [ ] Aucun timeout
- [ ] Aucun crash navigateur
- [ ] Rapports générés (HTML + JUnit)
- [ ] Screenshots uniquement sur échecs

---

## 🐛 Troubleshooting Prévisible

### Problème 1: "Cannot find module @playwright/test"

**Cause:** Dépendances pas installées dans image Docker

**Solution:**
```bash
# Rebuild image sans cache
docker compose -f docker-compose.e2e.yml build --no-cache
```

### Problème 2: "Network xch_xch-network not found"

**Cause:** Container tests pas sur même réseau que XCH

**Solution:**
```bash
# Vérifier réseau existe
docker network ls | grep xch

# Créer réseau si absent
docker network create xch_xch-network

# Vérifier containers XCH sur ce réseau
docker network inspect xch_xch-network
```

### Problème 3: "Login failed: No token stored"

**Cause:** Utilisateurs de test n'existent pas ou mots de passe incorrects

**Solution:**
1. Vérifier utilisateurs en DB (voir Étape 1)
2. Créer utilisateurs manquants
3. Vérifier mots de passe correspondent à `auth.fixture.ts`:
   - Admin123!
   - Manager123!
   - Tech123!
   - Viewer123!

### Problème 4: "Timeout waiting for http://192.168.0.13:3001"

**Cause:** Container tests ne peut pas accéder à XCH

**Solution 1: Utiliser nom de service Docker**
```yaml
# docker-compose.e2e.yml
environment:
  - PLAYWRIGHT_BASE_URL=http://xch-frontend:3001
  - PLAYWRIGHT_API_URL=http://xch-backend:3002
```

**Solution 2: Vérifier firewall/ports**
```bash
# Depuis container tests
docker compose -f docker-compose.e2e.yml run --rm --entrypoint /bin/bash playwright-tests
curl http://192.168.0.13:3001
curl http://192.168.0.13:3002/api/health
```

### Problème 5: Tests très lents

**Cause:** Resources limitées pour container

**Solution:**
```yaml
# docker-compose.e2e.yml
services:
  playwright-tests:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
    command: npx playwright test --workers=1  # Réduire workers
```

---

## 📊 Métriques Attendues

| Métrique | Valeur Cible | Note |
|----------|--------------|------|
| **Temps build image** | ~5 minutes | Première fois, puis cache |
| **Temps exécution totale** | 10-12 minutes | 58 tests, 2 workers |
| **Taux de succès** | 100% (58/58) | Si prérequis OK |
| **Taille rapports** | ~5 MB | HTML + screenshots |
| **RAM utilisée** | ~4 GB | Pendant exécution |
| **Workers** | 2 | Balance performance/stabilité |
| **Retries** | 2 | Mode CI, tolérance erreurs réseau |

---

## 🚀 Commandes Rapides

### Build + Run complet

```bash
# Sur le serveur
cd /opt/xch-dev/XCH

# Tout en une fois
docker compose -f docker-compose.e2e.yml up --build

# Ou en 2 temps
docker compose -f docker-compose.e2e.yml build
docker compose -f docker-compose.e2e.yml up
```

### Run tests spécifiques

```bash
# Tests Auth uniquement
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test tests/auth/

# Tests Sites uniquement
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test tests/sites/

# Un seul fichier
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test tests/auth/login.spec.ts

# Chrome uniquement
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test --project=chromium
```

### Voir logs en temps réel

```bash
# Terminal 1: Tests
docker compose -f docker-compose.e2e.yml up

# Terminal 2: Logs container tests
docker logs -f xch-e2e-tests

# Terminal 3: Logs backend (voir requêtes API)
docker logs -f xch-backend

# Terminal 4: Logs frontend
docker logs -f xch-frontend
```

### Debug interactif

```bash
# Accéder au container
docker compose -f docker-compose.e2e.yml run --rm --entrypoint /bin/bash playwright-tests

# Dans le container
npx playwright test --list  # Lister tous les tests
npx playwright test tests/auth/login.spec.ts --headed  # Un test en mode headed
npx playwright test --debug  # Mode debug
```

---

## 📈 Plan d'Amélioration Future

### Court terme (Session 12)

1. **Validation serveur complète**
   - Créer utilisateurs de test
   - Lancer suite complète
   - Analyser résultats
   - Corriger éventuels bugs

2. **Documentation validation**
   - Capturer screenshots résultats
   - Documenter bugs trouvés
   - Créer rapport validation

### Moyen terme (Sessions 13-14)

3. **Intégration CI/CD**
   - GitLab CI / GitHub Actions
   - Tests automatiques sur commits
   - Rapports JUnit intégrés

4. **Expansion couverture**
   - Tests permissions détaillés (RBAC)
   - Tests edge cases
   - Tests performance
   - Augmenter couverture 50% → 80%

### Long terme (Post-MVP)

5. **Tests avancés**
   - Tests visuels (screenshot comparison)
   - Tests accessibilité (axe-core)
   - Tests performance (Lighthouse)
   - Tests API directes (Playwright API testing)

6. **Optimisations**
   - Réduire durée exécution (parallélisation)
   - Mise en cache intelligente
   - Shard tests (multiple containers)

---

## ✅ Critères de Succès

### Validation Réussie Si:

1. ✅ **Build image Docker OK**
   - Image créée sans erreur
   - Taille ~1.8 GB
   - Navigateurs installés

2. ✅ **Tests exécutés OK**
   - 58 tests lancés
   - Aucun timeout
   - Aucun crash

3. ✅ **Résultats corrects**
   - Taux succès ≥ 95% (55/58 tests)
   - Rapports générés (HTML + JUnit)
   - Screenshots uniquement sur échecs

4. ✅ **Performance acceptable**
   - Durée totale < 15 minutes
   - Aucun test > 2 minutes
   - RAM < 6 GB

5. ✅ **Reproductibilité**
   - Même résultats sur 3 exécutions
   - Pas de flaky tests
   - Cleanup complet après tests

---

## 📞 Support

**Documentation complète:**
- Quick start: `E2E_TESTS_QUICKSTART.md`
- Guide serveur: `E2E_TESTS_SERVER_GUIDE.md`
- Guide Docker: `E2E_TESTS_DOCKER_GUIDE.md`
- README tests: `frontend/e2e/README.md`

**Problèmes Docker:**
- Logs: `docker compose -f docker-compose.e2e.yml logs`
- Inspect: `docker inspect xch-e2e-tests`
- Shell: `docker compose -f docker-compose.e2e.yml run --rm --entrypoint /bin/bash playwright-tests`

**Problèmes tests:**
- Mode debug: `npm run test:e2e:debug` (local)
- UI mode: `npm run test:e2e:ui` (local)
- Traces: `npx playwright show-trace test-results/<trace>.zip`

---

**Dernière mise à jour:** 2026-01-13
**Statut:** ✅ Infrastructure E2E complète - Prêt pour validation serveur
**Action suivante:** Créer utilisateurs de test + Build Docker + Premier test

---

**RÉSUMÉ SESSION 11:**

✅ **58 tests E2E créés** couvrant 6 modules principaux
✅ **Configuration Docker complète** pour exécution serveur
✅ **Documentation exhaustive** (4 guides, >1500 lignes)
✅ **Fixtures réutilisables** (auth, navigation, test-data)
✅ **Scripts NPM** (10 commandes)
✅ **Commits Git** (3 commits, tout versionné)

**Le système de tests E2E est prêt pour validation production.**
