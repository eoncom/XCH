# XCH - Tests E2E Playwright

Tests End-to-End automatisés pour valider les fonctionnalités de l'application XCH.

## Vue d'ensemble

Cette suite de tests E2E couvre:
- 7 modules fonctionnels (Dashboard, Sites, Settings, Tasks, Assets, Racks, RBAC)
- ~40 scénarios de test
- 4 rôles utilisateurs (ADMIN, SUPERUSER, USER, VIEWER)
- 3 navigateurs (Chrome, Firefox, Safari)

## Installation

```bash
cd frontend
npm install
npx playwright install --with-deps
```

## Configuration

1. Copier le fichier d'environnement:
```bash
cp .env.e2e.example .env.e2e
```

2. Éditer .env.e2e avec vos URLs:
```bash
PLAYWRIGHT_BASE_URL=http://192.168.0.13:3001
PLAYWRIGHT_API_URL=http://192.168.0.13:3002
```

## Exécution

```bash
# Tous les tests
npm run test:e2e

# Mode UI interactif
npm run test:e2e:ui

# Mode debug
npm run test:e2e:debug

# Rapport HTML
npm run test:e2e:report
```

## Tests disponibles

1. Dashboard Tiles Navigation (8 tests)
2. Sites Sections CRUD (12 tests)
3. Settings Page (11 tests)
4. Demo Data Management (8 tests)
5. Tasks Checklist (8 tests)
6. Status Badges Colors (12 tests)
7. RBAC Enforcement (20 tests)

TOTAL: ~80 tests E2E

## Utilisateurs de test

```
admin@xch.demo / admin123         # ADMIN
manager@xch.demo / manager123     # SUPERUSER
tech@xch.demo / tech123           # USER
viewer@xch.demo / viewer123       # VIEWER
```

## Dépannage

### Tests échouent avec "Navigation timeout"
```bash
# Vérifier backend/frontend démarrés
curl http://localhost:3002/health
curl http://localhost:3001
```

### "No accessToken cookie found"
```bash
# Vérifier seed a créé users
psql -U xch_user -d xch_dev -c "SELECT email, role FROM \"User\";"
```

## CI/CD

Workflow GitHub Actions: `.github/workflows/e2e-tests.yml`

Déclenché sur:
- Push main/develop
- Pull Request vers main
- Manuel (workflow_dispatch)

Artifacts uploadés (30 jours):
- playwright-report (HTML)
- test-results (JUnit XML)
- test-screenshots (failures only, 7 jours)
