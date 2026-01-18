# Tests E2E XCH - Guide Docker (Serveur)

Guide pour lancer les tests E2E Playwright directement sur le serveur via Docker.

**Avantages:**
- ✅ Tests lancés depuis le même réseau que l'application
- ✅ Latence réseau minimale
- ✅ Pas besoin d'installer Playwright en local
- ✅ Reproductibilité totale (même environnement partout)
- ✅ Intégration CI/CD simple

---

## 🚀 Lancer tests sur serveur (Docker)

### Méthode 1: Docker Compose (Recommandé)

```bash
# 1. Se connecter au serveur
ssh xch-deploy

# 2. Aller dans le projet
cd /opt/xch-dev/XCH

# 3. Builder l'image de tests
docker compose -f docker-compose.e2e.yml build

# 4. Lancer les tests
docker compose -f docker-compose.e2e.yml up

# 5. Voir les résultats
ls -lh frontend/playwright-report/
```

**Temps d'exécution:** ~10-12 minutes (58 tests, 2 workers, 2 retries)

### Méthode 2: Docker direct

```bash
# Sur le serveur
cd /opt/xch-dev/XCH

# Build image
docker build -f frontend/Dockerfile.e2e -t xch-e2e-tests ./frontend

# Lancer tests
docker run --rm \
  --name xch-e2e-tests \
  --network xch_xch-network \
  -e PLAYWRIGHT_BASE_URL=http://192.168.0.13:3001 \
  -e PLAYWRIGHT_API_URL=http://192.168.0.13:3002 \
  -e CI=true \
  -v $(pwd)/frontend/playwright-report:/app/playwright-report \
  -v $(pwd)/frontend/test-results:/app/test-results \
  xch-e2e-tests
```

---

## 📊 Voir les résultats

### Rapports générés

Après exécution, les rapports sont dans:

```bash
# Sur le serveur
cd /opt/xch-dev/XCH

# Liste des rapports
ls -lh frontend/playwright-report/
ls -lh frontend/test-results/

# Rapport HTML principal
cat frontend/playwright-report/index.html

# Rapport JUnit (pour CI/CD)
cat frontend/playwright-report/results.xml
```

### Télécharger rapports en local

```bash
# Depuis machine locale (Windows)
scp -r xch-deploy:/opt/xch-dev/XCH/frontend/playwright-report ./

# Ouvrir rapport HTML
start playwright-report/index.html
```

### Voir rapport via serveur web

```bash
# Sur le serveur, démarrer serveur HTTP temporaire
cd /opt/xch-dev/XCH/frontend/playwright-report
python3 -m http.server 8080

# Depuis navigateur local
# http://192.168.0.13:8080
```

---

## ⚙️ Configuration tests Docker

### Fichiers impliqués

**`frontend/Dockerfile.e2e`** - Image Docker tests
```dockerfile
FROM mcr.microsoft.com/playwright:v1.57.0-jammy
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY playwright.config.ts .env.e2e ./
COPY e2e/ ./e2e/
CMD ["npx", "playwright", "test"]
```

**`docker-compose.e2e.yml`** - Configuration Docker Compose
```yaml
services:
  playwright-tests:
    build:
      context: ./frontend
      dockerfile: Dockerfile.e2e
    environment:
      - PLAYWRIGHT_BASE_URL=http://192.168.0.13:3001
      - PLAYWRIGHT_API_URL=http://192.168.0.13:3002
      - CI=true
    volumes:
      - ./frontend/playwright-report:/app/playwright-report
      - ./frontend/test-results:/app/test-results
    command: npx playwright test --reporter=html,junit --retries=2 --workers=2
```

### Variables d'environnement

| Variable | Valeur | Description |
|----------|--------|-------------|
| `PLAYWRIGHT_BASE_URL` | http://192.168.0.13:3001 | URL frontend |
| `PLAYWRIGHT_API_URL` | http://192.168.0.13:3002 | URL backend API |
| `CI` | true | Mode CI (2 retries) |

### Options Playwright

| Option | Valeur | Raison |
|--------|--------|--------|
| `--workers=2` | 2 workers | Balance performance/stabilité |
| `--retries=2` | 2 retries | Tolérance erreurs réseau |
| `--reporter=html,junit` | HTML + JUnit | Rapports multiples |
| `--output=test-results` | Dossier résultats | Screenshots/vidéos |

---

## 🎯 Commandes avancées

### Lancer tests spécifiques

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

# Tests Chrome uniquement
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test --project=chromium
```

### Lancer en mode debug

```bash
# Lancer container interactif
docker compose -f docker-compose.e2e.yml run --rm \
  -e PWDEBUG=1 \
  playwright-tests \
  npx playwright test --debug

# Ou accéder au container pour debug manuel
docker compose -f docker-compose.e2e.yml run --rm --entrypoint /bin/bash playwright-tests

# Dans le container
npx playwright test --list  # Lister tests
npx playwright test tests/auth/login.spec.ts --headed  # Un test en mode headed
```

### Voir logs en temps réel

```bash
# Terminal 1: Tests
docker compose -f docker-compose.e2e.yml up

# Terminal 2: Logs container
docker logs -f xch-e2e-tests

# Terminal 3: Logs backend (pour voir requêtes API)
docker logs -f xch-backend

# Terminal 4: Logs frontend
docker logs -f xch-frontend
```

---

## 📦 Prérequis serveur

### 1. Vérifier utilisateurs de test

```bash
# Se connecter à PostgreSQL
docker exec -it xch-postgres psql -U xch_user -d xch_dev

# Vérifier utilisateurs
SELECT email, name, role FROM "User" WHERE email LIKE '%@xch.local';
```

**Attendu:**
```
email                | name              | role
---------------------|-------------------|----------
admin@xch.local      | Admin Test E2E    | ADMIN
manager@xch.local    | Manager Test E2E  | MANAGER
tech@xch.local       | Tech Test E2E     | TECHNICIEN
viewer@xch.local     | Viewer Test E2E   | VIEWER
```

Si manquants, créer via:
```sql
-- Voir E2E_TESTS_SERVER_GUIDE.md section "Création utilisateurs de test"
```

### 2. Vérifier containers XCH running

```bash
docker compose ps

# Attendu:
# xch-backend    running
# xch-frontend   running
# xch-postgres   running (healthy)
# xch-redis      running (healthy)
# xch-minio      running (healthy)
```

### 3. Vérifier réseau Docker

```bash
# Lister réseaux
docker network ls | grep xch

# Attendu:
# xch_xch-network

# Inspecter réseau
docker network inspect xch_xch-network
```

---

## 🔄 Workflow complet

### 1. Déployer nouvelle version

```bash
# Sur serveur
cd /opt/xch-dev/XCH

# Pull dernières modifications
git pull

# Rebuild et restart application
docker compose down
docker compose build
docker compose up -d

# Attendre démarrage
sleep 30
docker compose ps
```

### 2. Lancer tests E2E

```bash
# Builder image de tests (première fois ou si changements)
docker compose -f docker-compose.e2e.yml build

# Lancer tests
docker compose -f docker-compose.e2e.yml up

# Attendre fin (10-12 minutes)
```

### 3. Analyser résultats

```bash
# Résumé console
docker compose -f docker-compose.e2e.yml logs

# Rapport HTML
ls -lh frontend/playwright-report/index.html

# Si échecs, voir screenshots
ls -lh frontend/test-results/

# Télécharger rapports localement si besoin
```

### 4. Cleanup

```bash
# Supprimer container tests
docker compose -f docker-compose.e2e.yml down

# Optionnel: Supprimer image (pour rebuild complet)
docker rmi xch-e2e-tests
```

---

## 📈 Intégration CI/CD

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

# ... autres stages ...

test:e2e:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker compose version
  script:
    # Build image de tests
    - docker compose -f docker-compose.e2e.yml build

    # Lancer tests
    - docker compose -f docker-compose.e2e.yml up --exit-code-from playwright-tests

    # Les tests doivent passer (exit code 0)
  after_script:
    # Cleanup
    - docker compose -f docker-compose.e2e.yml down
  artifacts:
    when: always
    paths:
      - frontend/playwright-report/
      - frontend/test-results/
    reports:
      junit: frontend/playwright-report/results.xml
    expire_in: 7 days
  only:
    - develop
    - main
  tags:
    - docker
```

### GitHub Actions

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Build E2E test image
        run: docker compose -f docker-compose.e2e.yml build

      - name: Run E2E tests
        run: docker compose -f docker-compose.e2e.yml up --exit-code-from playwright-tests

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: frontend/test-results/

      - name: Cleanup
        if: always()
        run: docker compose -f docker-compose.e2e.yml down
```

---

## 🐛 Troubleshooting Docker

### Erreur: "Cannot find module @playwright/test"

**Cause:** Dépendances pas installées dans l'image.

**Solution:**
```bash
# Rebuild image complète
docker compose -f docker-compose.e2e.yml build --no-cache
```

### Erreur: "Network xch_xch-network not found"

**Cause:** Container tests pas sur même réseau que XCH.

**Solution:**
```bash
# Vérifier réseau existe
docker network ls | grep xch

# Créer réseau si absent
docker network create xch_xch-network

# Ou modifier docker-compose.e2e.yml:
networks:
  xch-network:
    name: xch_xch-network  # Nom exact du réseau XCH
```

### Erreur: "Timeout waiting for http://192.168.0.13:3001"

**Cause:** Container tests ne peut pas accéder à XCH sur 192.168.0.13.

**Solution 1: Utiliser nom de service Docker**
```yaml
# docker-compose.e2e.yml
environment:
  - PLAYWRIGHT_BASE_URL=http://xch-frontend:3001
  - PLAYWRIGHT_API_URL=http://xch-backend:3002
```

**Solution 2: Utiliser host.docker.internal**
```yaml
environment:
  - PLAYWRIGHT_BASE_URL=http://host.docker.internal:3001
  - PLAYWRIGHT_API_URL=http://host.docker.internal:3002
```

### Tests très lents dans Docker

**Cause:** Resources limitées pour container.

**Solution:**
```yaml
# docker-compose.e2e.yml
services:
  playwright-tests:
    # Allouer plus de ressources
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
    # Réduire workers
    command: npx playwright test --workers=1
```

### Pas d'accès aux rapports HTML

**Cause:** Permissions ou volumes mal configurés.

**Solution:**
```bash
# Vérifier volumes montés
docker inspect xch-e2e-tests | grep -A 10 Mounts

# Fixer permissions
sudo chown -R $USER:$USER frontend/playwright-report/
sudo chmod -R 755 frontend/playwright-report/
```

---

## ✅ Checklist pré-tests Docker

Avant de lancer les tests:

- [ ] Serveur accessible (ssh xch-deploy OK)
- [ ] Containers XCH running (docker compose ps)
- [ ] Utilisateurs de test créés (psql query OK)
- [ ] Réseau Docker existe (docker network ls)
- [ ] Image E2E buildée (docker images | grep xch-e2e)
- [ ] Volumes configurés (ls frontend/playwright-report/)
- [ ] Espace disque suffisant (df -h > 10GB libre)

---

## 📊 Métriques tests Docker

| Métrique | Valeur | Note |
|----------|--------|------|
| **Temps build image** | ~5 minutes | Première fois, puis cache |
| **Temps exécution** | 10-12 minutes | 58 tests, 2 workers |
| **Taille image** | ~1.8 GB | Inclut navigateurs Playwright |
| **RAM utilisée** | ~4 GB | Pendant exécution tests |
| **Workers** | 2 | Balance performance/stabilité |
| **Retries** | 2 | Mode CI, tolérance erreurs |

---

## 🎯 Commandes rapides

```bash
# Build + Run
docker compose -f docker-compose.e2e.yml up --build

# Run sans rebuild
docker compose -f docker-compose.e2e.yml up

# Run en arrière-plan
docker compose -f docker-compose.e2e.yml up -d

# Voir logs
docker compose -f docker-compose.e2e.yml logs -f

# Stop
docker compose -f docker-compose.e2e.yml down

# Cleanup complet
docker compose -f docker-compose.e2e.yml down --rmi all -v
```

---

## 📞 Support

**Problèmes Docker:**
- Logs: `docker compose -f docker-compose.e2e.yml logs`
- Inspect: `docker inspect xch-e2e-tests`
- Shell: `docker compose -f docker-compose.e2e.yml run --rm --entrypoint /bin/bash playwright-tests`

**Problèmes réseau:**
- Vérifier: `docker network inspect xch_xch-network`
- Tester: `docker run --rm --network xch_xch-network alpine ping xch-frontend`

**Documentation:**
- Guide serveur: `E2E_TESTS_SERVER_GUIDE.md`
- Guide rapide: `E2E_TESTS_QUICKSTART.md`
- README complet: `frontend/e2e/README.md`

---

**Dernière mise à jour:** 2026-01-12
**Statut:** ✅ Tests E2E Docker configurés et prêts
**Recommandation:** Lancer tests après chaque déploiement
