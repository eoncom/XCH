# Tests E2E Playwright - XCH

Tests automatisés end-to-end pour l'application XCH utilisant Playwright.

## 📦 Installation

Les dépendances sont déjà installées via npm. Pour installer les navigateurs Playwright:

```bash
cd frontend
npx playwright install
```

## 🚀 Lancer les tests

### Tests complets (headless)
```bash
npm run test:e2e
```

### Interface UI Playwright (recommandé pour développement)
```bash
npm run test:e2e:ui
```

### Mode headed (voir le navigateur)
```bash
npm run test:e2e:headed
```

### Mode debug (avec breakpoints)
```bash
npm run test:e2e:debug
```

### Tests par navigateur
```bash
# Chromium uniquement
npm run test:e2e:chromium

# Firefox uniquement
npm run test:e2e:firefox

# WebKit/Safari uniquement
npm run test:e2e:webkit

# Mobile (Chrome + Safari)
npm run test:e2e:mobile
```

### Voir le rapport HTML
```bash
npm run test:e2e:report
```

### Codegen - Générer des tests automatiquement
```bash
npm run test:e2e:codegen
```

## 📁 Structure

```
e2e/
├── fixtures/
│   └── auth.fixture.ts          # Fixtures authentification (login/logout)
├── helpers/
│   ├── navigation.ts             # Helpers navigation
│   └── test-data.ts              # Données de test
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts         # Tests login
│   │   └── logout.spec.ts        # Tests logout
│   ├── sites/
│   │   └── sites-crud.spec.ts    # Tests CRUD sites
│   ├── assets/
│   │   └── assets-crud.spec.ts   # Tests CRUD assets + QR codes
│   ├── tasks/
│   │   └── tasks-kanban.spec.ts  # Tests Kanban + drag & drop
│   ├── racks/
│   │   └── racks-crud.spec.ts    # Tests CRUD racks + viewer
│   └── floorplans/
│       └── floorplans-crud.spec.ts # Tests upload + viewer + pins
├── playwright.config.ts          # Configuration Playwright
└── README.md                     # Cette documentation
```

## 🧪 Tests couverts

### Authentification (2 specs, ~10 tests)
- ✅ Login avec différents rôles (ADMIN, MANAGER, TECHNICIEN, VIEWER)
- ✅ Logout
- ✅ Validation formulaires
- ✅ Persistance session
- ✅ Protection routes

### Sites (1 spec, ~8 tests)
- ✅ Liste des sites
- ✅ CRUD complet (Create, Read, Update, Delete)
- ✅ Recherche
- ✅ Affichage carte Leaflet
- ✅ Validation champs

### Assets (1 spec, ~9 tests)
- ✅ Liste des assets
- ✅ CRUD complet
- ✅ Types d'équipements (PRINTER, IPAD, SWITCH, etc.)
- ✅ Génération QR codes
- ✅ Download QR code PNG
- ✅ Filtres par type/status
- ✅ Recherche par serial number

### Tasks (1 spec, ~8 tests)
- ✅ Kanban 3 colonnes (TODO, IN_PROGRESS, DONE)
- ✅ CRUD complet
- ✅ Drag & drop entre colonnes
- ✅ Assignation utilisateurs
- ✅ Filtres par priorité
- ✅ Statuts et priorités

### Racks (1 spec, ~9 tests)
- ✅ Liste des racks
- ✅ CRUD complet (4U-42U)
- ✅ Viewer 2D Konva
- ✅ Affichage équipements montés
- ✅ Calcul occupation
- ✅ Metadata (manufacturer, model)
- ✅ Filtres par site

### FloorPlans (1 spec, ~9 tests)
- ✅ Liste des plans
- ✅ Upload PDF/PNG/JPG
- ✅ Viewer Konva avec zoom/pan
- ✅ Ajout pins (4 types: EQUIPMENT, NETWORK, ALERT, INFO)
- ✅ Modification pins
- ✅ Drag & drop pins
- ✅ Filtres par site

**Total: 6 specs, ~53 tests E2E**

## 🔧 Configuration

### Variables d'environnement

Créer un fichier `.env.e2e` (copier depuis `.env.e2e.example`):

```bash
# Local
PLAYWRIGHT_BASE_URL=http://localhost:3001
PLAYWRIGHT_API_URL=http://localhost:3002

# Production/Staging
# PLAYWRIGHT_BASE_URL=http://192.168.0.13:3001
# PLAYWRIGHT_API_URL=http://192.168.0.13:3002
```

### Utilisateurs de test

Les tests nécessitent des utilisateurs existants en base de données:

```typescript
// e2e/fixtures/auth.fixture.ts
export const TEST_USERS = {
  admin: {
    email: 'admin@xch.local',
    password: 'Admin123!',
    role: 'ADMIN',
  },
  manager: {
    email: 'manager@xch.local',
    password: 'Manager123!',
    role: 'MANAGER',
  },
  technicien: {
    email: 'tech@xch.local',
    password: 'Tech123!',
    role: 'TECHNICIEN',
  },
  viewer: {
    email: 'viewer@xch.local',
    password: 'Viewer123!',
    role: 'VIEWER',
  },
};
```

**Important:** Ces utilisateurs doivent être créés via seed ou manuellement avant de lancer les tests.

### Seed database pour tests

```bash
cd backend
npx prisma db seed
```

Le script de seed doit créer les 4 utilisateurs de test.

## 📊 Rapports

Après exécution, les rapports sont générés dans:
- **HTML**: `playwright-report/index.html` (ouvrir avec `npm run test:e2e:report`)
- **JUnit**: `playwright-report/results.xml` (pour CI/CD)
- **Traces**: `test-results/` (traces vidéo en cas d'échec)
- **Screenshots**: `test-results/` (screenshots en cas d'échec)

## 🚦 CI/CD

### GitLab CI

```yaml
test:e2e:
  stage: test
  image: mcr.microsoft.com/playwright:v1.57.0-jammy
  script:
    - cd frontend
    - npm ci --legacy-peer-deps
    - npx playwright install
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - frontend/playwright-report/
      - frontend/test-results/
    reports:
      junit: frontend/playwright-report/results.xml
  only:
    - develop
    - main
```

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - name: Install dependencies
        run: |
          cd frontend
          npm ci --legacy-peer-deps
      - name: Install Playwright browsers
        run: |
          cd frontend
          npx playwright install --with-deps
      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## 🐛 Debugging

### Voir les tests en UI mode
```bash
npm run test:e2e:ui
```
- Interface graphique interactive
- Voir chaque étape
- Time travel debugging
- Screenshots automatiques

### Mode debug avec breakpoints
```bash
npm run test:e2e:debug
```

### Lancer un seul test
```bash
npx playwright test auth/login.spec.ts
```

### Lancer un test spécifique
```bash
npx playwright test -g "devrait se connecter avec admin"
```

### Voir les traces après échec
```bash
npx playwright show-trace test-results/<trace-file>.zip
```

## ✅ Best Practices

1. **Données de test uniques**: Utiliser `generateUniqueData()` pour éviter les collisions
2. **Attendre les éléments**: Toujours utiliser `waitForSelector()`, `waitForLoadState()`
3. **Assertions explicites**: Utiliser `expect().toBeVisible()` plutôt que vérifier existence
4. **Cleanup**: Tests doivent être indépendants, pas de dépendances entre tests
5. **Page Object Model**: Utiliser `NavigationHelper` pour actions répétitives
6. **Fixtures**: Utiliser fixtures auth pour login/logout automatisés

## 🔄 Maintenance

### Mettre à jour Playwright
```bash
npm update @playwright/test
npx playwright install
```

### Ajouter un nouveau test
1. Créer fichier dans `e2e/tests/<module>/<nom>.spec.ts`
2. Importer fixtures: `import { test, expect } from '../../fixtures/auth.fixture'`
3. Utiliser helpers: `import { NavigationHelper } from '../../helpers/navigation'`
4. Suivre pattern existant des autres tests

### Ajouter des données de test
Modifier `e2e/helpers/test-data.ts`:

```typescript
export const TEST_DATA = {
  nouveauModule: {
    exemple: {
      field1: 'value1',
      field2: 'value2',
    },
  },
};
```

## 📝 Notes

- Les tests utilisent des **données réalistes** mais **générées automatiquement**
- Les tests sont **parallélisables** (4 workers par défaut)
- Les tests **nettoient automatiquement** (logout, clear storage)
- Les tests sont **cross-browser** (Chromium, Firefox, WebKit)
- Les tests supportent **mobile** (iOS Safari, Android Chrome)

## 🆘 Troubleshooting

### Erreur "No tests found"
```bash
# Vérifier structure dossiers
ls e2e/tests/

# Relancer avec verbose
npx playwright test --list
```

### Erreur "Login failed"
- Vérifier que les utilisateurs de test existent en DB
- Vérifier que l'application tourne sur `localhost:3001`
- Vérifier les credentials dans `auth.fixture.ts`

### Erreur "Timeout waiting for element"
- Augmenter timeout dans `playwright.config.ts`
- Vérifier que l'élément existe dans l'UI
- Utiliser `--headed` pour voir visuellement

### Tests flaky (instables)
- Augmenter les timeouts (`waitForTimeout`)
- Vérifier les `waitForLoadState('networkidle')`
- Éviter `page.waitForTimeout()`, préférer `waitForSelector()`

---

**Dernière mise à jour:** 2026-01-12
**Version:** 1.0.0
**Auteur:** Claude Sonnet 4.5
