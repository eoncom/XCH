# Guide CI/CD - GitHub Actions

**Date**: 2026-01-17
**Version**: 1.0.0
**Pipeline**: Tests E2E Playwright

---

## Vue d'Ensemble

XCH utilise **GitHub Actions** pour l'intégration continue automatique avec tests E2E Playwright exécutés dans des containers Docker.

### Caractéristiques

- ✅ **100% Docker** - Aucune dépendance npm sur le runner GitHub
- ✅ **Tests E2E complets** - Playwright avec Chromium
- ✅ **Artefacts automatiques** - HTML reports, traces, screenshots
- ✅ **Exit code fiable** - 0 (succès) ou 1 (échec)
- ✅ **Documentation Known Issues** - Problèmes architecturaux documentés

---

## Workflow: Tests E2E

**Fichier**: `.github/workflows/tests-e2e.yml`

### Déclencheurs

```yaml
on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main
      - develop
```

### Étapes du Pipeline

| # | Étape | Durée | Description |
|---|-------|-------|-------------|
| 1 | Checkout code | ~5s | Clone repository |
| 2 | Create directories | ~1s | Création dossiers artefacts |
| 3 | Start infrastructure | ~15s | PostgreSQL + Redis + MinIO |
| 4 | Check health | ~5s | Vérification services ready |
| 5 | Run migrations | ~20s | Prisma migrate + seed |
| 6 | Start backend | ~15s | NestJS API |
| 7 | Start frontend | ~25s | Next.js 15 |
| 8 | Verify services | ~5s | Health checks HTTP |
| 9 | Create test users | ~3s | 4 utilisateurs SQL |
| 10 | Build E2E image | ~60s | Playwright Docker image |
| 11 | Run E2E tests | ~3-5min | Tests Playwright Chromium |
| 12 | Upload artifacts | ~10s | HTML report + traces |

**Durée totale estimée**: ~5-7 minutes

### Variables d'Environnement

Le workflow configure automatiquement:

```yaml
env:
  # URLs XCH (localhost car GitHub runner)
  PLAYWRIGHT_BASE_URL: http://localhost:3001
  PLAYWRIGHT_API_URL: http://localhost:3002

  # Base de données
  POSTGRES_DB: xch_dev
  POSTGRES_USER: xch_user
  POSTGRES_PASSWORD: xch_password_secure_2024
  DATABASE_URL: postgresql://xch_user:xch_password_secure_2024@localhost:5432/xch_dev

  # Redis
  REDIS_URL: redis://localhost:6379

  # MinIO
  MINIO_ROOT_USER: minioadmin
  MINIO_ROOT_PASSWORD: minioadmin123

  # JWT Secrets
  JWT_SECRET: test_jwt_secret_for_ci_only_not_production
  JWT_REFRESH_SECRET: test_refresh_secret_for_ci_only

  # Mode CI
  CI: true
  NODE_ENV: test
```

---

## Artefacts Collectés

En cas de succès **ou** d'échec, le workflow collecte automatiquement:

### 1. Playwright HTML Report

**Nom**: `playwright-report`
**Contenu**: Rapport HTML interactif
**Chemin**: `frontend/playwright-report-host/`
**Rétention**: 30 jours

**Visualisation**:
1. Aller dans l'onglet **Actions** du repository
2. Cliquer sur le workflow (succès ou échec)
3. Télécharger `playwright-report.zip`
4. Dézipper et ouvrir `index.html` dans un navigateur

### 2. Test Results

**Nom**: `test-results`
**Contenu**: Screenshots, traces vidéo, logs
**Chemin**: `frontend/test-results-host/`
**Rétention**: 30 jours

**Structure**:
```
test-results/
├── screenshots/
│   └── test-failed-1.png
├── traces/
│   └── trace-xxxx.zip
└── videos/
    └── video.webm
```

### 3. JUnit Report

**Nom**: `junit-report`
**Contenu**: XML JUnit (intégration CI/CD)
**Chemin**: `frontend/test-results-host/*.xml`
**Rétention**: 30 jours

---

## Commandes Locales

### Reproduire Pipeline CI Complet

```bash
# 1. Démarrer infrastructure
cd backend
docker compose up -d postgres redis minio
sleep 10

# 2. Démarrer backend
docker compose up -d backend
sleep 15

# 3. Démarrer frontend
docker compose up -d frontend
sleep 20

# 4. Créer utilisateurs de test
docker compose exec -T postgres psql -U xch_user -d xch_dev < create-test-users.sql

# 5. Lancer tests E2E
cd ..
docker compose -f docker-compose.e2e.yml run --rm \
  -e PLAYWRIGHT_BASE_URL=http://localhost:3001 \
  -e PLAYWRIGHT_API_URL=http://localhost:3002 \
  playwright-tests \
  npx playwright test --project=chromium --reporter=html,junit

# 6. Cleanup
cd backend
docker compose down -v
```

### Tests Chromium Uniquement (Mode CI)

```bash
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test --project=chromium
```

### Tests avec UI (Debug)

```bash
docker compose -f docker-compose.e2e.yml run --rm playwright-tests \
  npx playwright test --ui
```

---

## Résultats et Statuts

### Badge Statut

Ajouter au README:

```markdown
[![Tests E2E](https://github.com/your-org/xch/actions/workflows/tests-e2e.yml/badge.svg)](https://github.com/your-org/xch/actions/workflows/tests-e2e.yml)
```

### Interpréter les Résultats

#### ✅ Succès (Exit Code 0)

- Badge vert dans GitHub
- Tous les tests sont passés
- Artefacts disponibles pour consultation

#### ❌ Échec (Exit Code 1)

- Badge rouge dans GitHub
- Au moins un test a échoué
- **Action requise**:
  1. Télécharger artefact `playwright-report`
  2. Ouvrir `index.html`
  3. Analyser tests échoués (screenshots + traces)
  4. Corriger code ou tests
  5. Push fix → nouveau workflow

### Exemple Analyse Échec

```bash
# 1. Télécharger playwright-report.zip depuis GitHub Actions
# 2. Dézipper
unzip playwright-report.zip

# 3. Ouvrir rapport
cd playwright-report
open index.html  # macOS
# ou
start index.html # Windows

# 4. Dans le rapport:
#    - Voir tests échoués (rouge)
#    - Cliquer sur test → voir screenshot moment échec
#    - Voir trace complète (timeline d'actions)
#    - Identifier cause: timeout, sélecteur, assertion
```

---

## Known Issues

### Tests Avancés Auth (8/14 Échouent)

**Problème**: Architecture hybride SSR (Next.js middleware) + CSR (Zustand store)

**Impact**:
- ✅ Login basique: 6/14 tests passent (43%)
- ❌ Persistance session: Échec (cookies JavaScript non persistés)
- ❌ Logout: Échec (redirection avant action)

**Documentation complète**: [E2E_VALIDATION_REPORT.md](E2E_VALIDATION_REPORT.md)

**Solutions proposées**:
1. **Option 1** (Rapide): Désactiver middleware SSR → protection CSR uniquement
2. **Option 2** (Recommandé): Refonte architecture auth avec cookies HTTP-only
3. **Option 3** (Déconseillé): Token dans URL → faille sécurité

**Status MVP**: Accepté comme Known Issue, tests de base validés

### Exclusion Tests Known Issues

Pour désactiver temporairement tests problématiques:

```typescript
// frontend/e2e/tests/auth/login.spec.ts
test.skip('devrait persister la session après rechargement', async () => {
  // Test skippé - Known Issue architectural
});
```

---

## Optimisations

### Accélérer le Pipeline

1. **Réduire retries** (actuellement 1):
   ```yaml
   --retries=0
   ```

2. **Augmenter workers** (actuellement 2):
   ```yaml
   --workers=4
   ```

3. **Cache Docker layers**:
   ```yaml
   - uses: docker/setup-buildx-action@v3
   - uses: docker/build-push-action@v5
     with:
       cache-from: type=gha
       cache-to: type=gha,mode=max
   ```

### Paralléliser Tests

```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
```

---

## Troubleshooting

### Pipeline Échoue: "Services Not Ready"

**Cause**: PostgreSQL/Redis/MinIO pas prêts

**Solution**: Augmenter sleep times
```yaml
sleep 15  # au lieu de 10
```

### Pipeline Échoue: "Frontend Not Accessible"

**Cause**: Next.js build trop long

**Solution**: Augmenter timeout frontend
```yaml
sleep 30  # au lieu de 20
```

### Tests Timeout Systématiquement

**Cause**: Network issues ou services lents

**Solution**: Augmenter timeout Playwright
```typescript
// playwright.config.ts
timeout: 60000  // 60s au lieu de 30s
```

### Artefacts Non Collectés

**Cause**: Chemins incorrects

**Solution**: Vérifier paths dans workflow
```yaml
path: frontend/playwright-report-host/  # Slash final important
```

---

## Maintenance

### Mise à Jour Playwright

```bash
cd frontend
npm install --save-dev @playwright/test@latest
npx playwright install
```

Puis rebuild Docker image:
```bash
docker compose -f docker-compose.e2e.yml build --no-cache playwright-tests
```

### Mise à Jour Utilisateurs Test

Modifier workflow section "Create E2E test users":
```yaml
- name: Create E2E test users
  run: |
    docker compose exec -T postgres psql -U xch_user -d xch_dev <<'EOF'
    -- Nouveaux utilisateurs ici
    EOF
```

### Ajouter Nouveaux Tests

1. Créer spec dans `frontend/e2e/tests/`
2. Tests automatiquement inclus dans CI
3. Push → workflow se lance

---

## Intégrations Futures

### GitLab CI/CD

Adapter `.github/workflows/tests-e2e.yml` vers `.gitlab-ci.yml`:

```yaml
test-e2e:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker compose -f docker-compose.e2e.yml run --rm playwright-tests
  artifacts:
    paths:
      - frontend/playwright-report-host/
    when: always
    expire_in: 30 days
```

### Notifications Slack

Ajouter à la fin du workflow:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Sécurité

### Secrets GitHub

**Requis** (si production):
- `POSTGRES_PASSWORD`: Mot de passe PostgreSQL
- `JWT_SECRET`: Secret JWT
- `MINIO_ROOT_PASSWORD`: Password MinIO

**Configuration**:
1. Repository → Settings → Secrets and variables → Actions
2. New repository secret
3. Utiliser dans workflow: `${{ secrets.POSTGRES_PASSWORD }}`

### Isolation Tests

Les tests E2E utilisent:
- Base de données éphémère (détruite après tests)
- Secrets non-production (suffixe `_test_`)
- Network Docker isolé
- Pas d'accès internet (sauf NPM registry Docker build)

---

## Ressources

- **Workflow complet**: `.github/workflows/tests-e2e.yml`
- **Validation E2E**: [E2E_VALIDATION_REPORT.md](E2E_VALIDATION_REPORT.md)
- **README CI/CD**: [README.md#ci-cd](../../README.md#ci-cd)
- **Playwright Docs**: https://playwright.dev/docs/ci-intro

---

**Dernière mise à jour**: 2026-01-17
**Auteur**: Équipe XCH
**Contact**: [GitHub Issues](../../issues)
