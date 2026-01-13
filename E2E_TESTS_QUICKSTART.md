# Tests E2E XCH - Quick Start Guide

Guide rapide pour lancer les tests E2E Playwright sur le projet XCH.

## ⚡ Démarrage rapide (5 minutes)

### 1. Prérequis

```bash
# Naviguer vers frontend
cd C:\xampp\htdocs\XCH\frontend

# Vérifier que Playwright est installé
npm list @playwright/test
```

### 2. Installer les navigateurs Playwright

```bash
npx playwright install
```

Ceci télécharge Chromium, Firefox et WebKit (~1.5 GB).

### 3. Préparer la base de données

Les tests nécessitent 4 utilisateurs de test. Créer manuellement ou via seed:

```sql
-- Admin
INSERT INTO "User" (id, email, password, name, role, "tenantId")
VALUES (gen_random_uuid(), 'admin@xch.local', '<hash>', 'Admin Test', 'ADMIN', '<tenant-id>');

-- Manager
INSERT INTO "User" (id, email, password, name, role, "tenantId")
VALUES (gen_random_uuid(), 'manager@xch.local', '<hash>', 'Manager Test', 'MANAGER', '<tenant-id>');

-- Technicien
INSERT INTO "User" (id, email, password, name, role, "tenantId")
VALUES (gen_random_uuid(), 'tech@xch.local', '<hash>', 'Tech Test', 'TECHNICIEN', '<tenant-id>');

-- Viewer
INSERT INTO "User" (id, email, password, name, role, "tenantId")
VALUES (gen_random_uuid(), 'viewer@xch.local', '<hash>', 'Viewer Test', 'VIEWER', '<tenant-id>');
```

**Mots de passe :** Admin123!, Manager123!, Tech123!, Viewer123!

### 4. Démarrer l'application

```bash
# Terminal 1 - Backend
cd C:\xampp\htdocs\XCH\backend
npm run start:dev

# Terminal 2 - Frontend
cd C:\xampp\htdocs\XCH\frontend
npm run dev
```

Vérifier que l'application est accessible sur http://localhost:3001

### 5. Lancer les tests

#### Option A: UI Mode (Recommandé pour première fois)

```bash
npm run test:e2e:ui
```

Interface graphique interactive qui permet de:
- ✅ Voir tous les tests disponibles
- ✅ Lancer tests individuellement
- ✅ Voir chaque étape en temps réel
- ✅ Time-travel debugging

#### Option B: Mode Headless (CLI)

```bash
npm run test:e2e
```

Tous les tests s'exécutent en arrière-plan (~10 minutes).

#### Option C: Mode Headed (Voir le navigateur)

```bash
npm run test:e2e:headed
```

Tests s'exécutent dans un navigateur visible.

---

## 📊 Résultats attendus

### Succès

```bash
Running 53 tests using 4 workers

✓ e2e/tests/auth/login.spec.ts (10 passed)
✓ e2e/tests/auth/logout.spec.ts (4 passed)
✓ e2e/tests/sites/sites-crud.spec.ts (8 passed)
✓ e2e/tests/assets/assets-crud.spec.ts (9 passed)
✓ e2e/tests/tasks/tasks-kanban.spec.ts (8 passed)
✓ e2e/tests/racks/racks-crud.spec.ts (9 passed)
✓ e2e/tests/floorplans/floorplans-crud.spec.ts (5 passed)

53 passed (10m 23s)
```

Rapport HTML généré automatiquement : `playwright-report/index.html`

### Voir le rapport

```bash
npm run test:e2e:report
```

Ouvre le navigateur avec rapport détaillé (screenshots, timings, traces).

---

## 🐛 Troubleshooting

### Erreur: "No tests found"

```bash
# Vérifier structure
ls e2e/tests/

# Lister tests détectés
npx playwright test --list
```

### Erreur: "Login failed: No token stored"

**Cause:** Utilisateurs de test n'existent pas en base de données.

**Solution:** Créer les 4 utilisateurs (voir étape 3).

### Erreur: "Timeout waiting for http://localhost:3001"

**Cause:** Application frontend pas démarrée.

**Solution:**
```bash
cd frontend
npm run dev
```

### Erreur: "Cannot find module '@playwright/test'"

**Solution:**
```bash
npm install --save-dev @playwright/test --legacy-peer-deps
npx playwright install
```

### Tests flaky (passent parfois, échouent parfois)

**Solutions:**
1. Augmenter timeout dans `playwright.config.ts`:
```typescript
timeout: 60000, // 60s au lieu de 30s
```

2. Lancer avec un seul worker:
```bash
npx playwright test --workers=1
```

3. Activer mode headed pour voir ce qui se passe:
```bash
npm run test:e2e:headed
```

---

## 🚀 Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run test:e2e` | Lance tous les tests (headless) |
| `npm run test:e2e:ui` | Interface UI interactive |
| `npm run test:e2e:headed` | Tests avec navigateur visible |
| `npm run test:e2e:debug` | Mode debug avec breakpoints |
| `npm run test:e2e:chromium` | Tests Chrome uniquement |
| `npm run test:e2e:firefox` | Tests Firefox uniquement |
| `npm run test:e2e:webkit` | Tests Safari uniquement |
| `npm run test:e2e:mobile` | Tests mobile (iOS + Android) |
| `npm run test:e2e:report` | Ouvre rapport HTML |
| `npm run test:e2e:codegen` | Génère tests automatiquement |

### Lancer un seul test

```bash
npx playwright test auth/login.spec.ts
```

### Lancer tests d'un module

```bash
npx playwright test tests/sites/
```

### Lancer un test spécifique par nom

```bash
npx playwright test -g "devrait se connecter avec admin"
```

### Mode debug d'un seul test

```bash
npx playwright test auth/login.spec.ts --debug
```

---

## 📖 Documentation complète

- **README complet:** `frontend/e2e/README.md`
- **ADR Tests E2E:** `docs/decisions/adr-007-e2e-testing-playwright.md`
- **Config Playwright:** `frontend/playwright.config.ts`
- **Documentation officielle:** https://playwright.dev

---

## ✅ Checklist avant commit

Avant de committer du code frontend, lancer:

```bash
# 1. Build frontend
npm run build

# 2. Tests E2E critiques (auth + 1 module)
npx playwright test auth/ sites/

# 3. Si tous passent, commit
git add .
git commit -m "feat: nouvelle fonctionnalité"
```

---

## 🎯 Prochaines étapes

1. **Intégration CI/CD**
   - Configurer `.gitlab-ci.yml` ou `.github/workflows/e2e.yml`
   - Tests automatiques sur chaque PR/commit

2. **Expansion tests**
   - Tests performance (Lighthouse)
   - Tests accessibilité (axe-core)
   - Tests visuels (screenshots comparison)

3. **Monitoring**
   - Dashboard Playwright en ligne
   - Alertes si taux échec > 5%

---

**Dernière mise à jour:** 2026-01-12
**Support:** Consulter `e2e/README.md` pour troubleshooting détaillé
