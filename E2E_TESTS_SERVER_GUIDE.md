# Tests E2E XCH - Guide Serveur Production

**Application XCH déployée sur:** http://192.168.0.13:3001
**Backend API:** http://192.168.0.13:3002

Ce guide explique comment lancer les tests E2E depuis votre machine locale vers le serveur distant.

---

## ⚡ Prérequis

### 1. Vérifier que le serveur est accessible

```bash
# Test ping serveur
ping 192.168.0.13

# Test frontend accessible
curl http://192.168.0.13:3001

# Test backend accessible
curl http://192.168.0.13:3002/api/health
```

Si l'un de ces tests échoue, vérifier:
- Connexion réseau
- Containers Docker sur serveur: `ssh xch-deploy "docker compose ps"`
- Firewall/ports ouverts (3001, 3002)

### 2. Vérifier les utilisateurs de test en base

Les tests nécessitent 4 utilisateurs:

```sql
-- Se connecter au serveur et PostgreSQL
ssh xch-deploy
docker exec -it xch-postgres psql -U xch_user -d xch_dev

-- Vérifier utilisateurs
SELECT email, role FROM "User" WHERE email LIKE '%@xch.local';
```

**Utilisateurs requis:**
- `admin@xch.local` (ADMIN)
- `manager@xch.local` (MANAGER)
- `tech@xch.local` (TECHNICIEN)
- `viewer@xch.local` (VIEWER)

Si absents, les créer (voir section "Création utilisateurs de test" ci-dessous).

### 3. Installer Playwright en local

```bash
cd C:\xampp\htdocs\XCH\frontend

# Installer navigateurs (si pas déjà fait)
npx playwright install
```

---

## 🚀 Lancer les tests

### Vérifier configuration

Le fichier `.env.e2e` doit pointer vers le serveur:

```bash
# frontend/.env.e2e
PLAYWRIGHT_BASE_URL=http://192.168.0.13:3001
PLAYWRIGHT_API_URL=http://192.168.0.13:3002
```

✅ Ce fichier est déjà configuré correctement.

### Lancer tous les tests

```bash
cd frontend

# Mode UI (recommandé pour voir ce qui se passe)
npm run test:e2e:ui

# Mode CLI headless
npm run test:e2e

# Mode headed (voir navigateur)
npm run test:e2e:headed
```

**Temps d'exécution:** ~10-15 minutes (58 tests)

### Lancer tests spécifiques

```bash
# Tests Auth uniquement
npx playwright test tests/auth/

# Tests Sites uniquement
npx playwright test tests/sites/

# Un seul fichier
npx playwright test tests/auth/login.spec.ts

# Un test spécifique
npx playwright test -g "devrait se connecter avec admin"
```

### Résultat attendu

```bash
Running 58 tests using 4 workers

✓ e2e/tests/auth/login.spec.ts (10 passed)
✓ e2e/tests/auth/logout.spec.ts (4 passed)
✓ e2e/tests/sites/sites-crud.spec.ts (8 passed)
✓ e2e/tests/assets/assets-crud.spec.ts (9 passed)
✓ e2e/tests/tasks/tasks-kanban.spec.ts (8 passed)
✓ e2e/tests/racks/racks-crud.spec.ts (9 passed)
✓ e2e/tests/floorplans/floorplans-crud.spec.ts (5 passed)

58 passed (12m 15s)

Serving HTML report at http://localhost:9323
```

### Voir le rapport

```bash
npm run test:e2e:report
```

Ouvre le navigateur avec rapport détaillé.

---

## 👥 Création utilisateurs de test

Si les utilisateurs n'existent pas en base, les créer via backend:

### Option 1: Via API (Recommandé)

```bash
# Se connecter au serveur
ssh xch-deploy

# Accéder au backend container
docker exec -it xch-backend bash

# Lancer Node.js
node

# Dans Node.js console
const bcrypt = require('bcrypt');

// Générer hash pour 'Admin123!'
bcrypt.hash('Admin123!', 10).then(hash => console.log(hash));
// Copier le hash généré

// Répéter pour les autres mots de passe:
// Manager123!, Tech123!, Viewer123!
```

Puis insérer en SQL:

```sql
-- Se connecter à PostgreSQL
docker exec -it xch-postgres psql -U xch_user -d xch_dev

-- Récupérer tenant ID
SELECT id FROM "Tenant" LIMIT 1;
-- Copier le tenant_id

-- Insérer Admin
INSERT INTO "User" (id, email, password, name, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@xch.local',
  '<hash-copié>',
  'Admin Test E2E',
  'ADMIN',
  '<tenant-id>',
  NOW(),
  NOW()
);

-- Insérer Manager
INSERT INTO "User" (id, email, password, name, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'manager@xch.local',
  '<hash-manager>',
  'Manager Test E2E',
  'MANAGER',
  '<tenant-id>',
  NOW(),
  NOW()
);

-- Insérer Technicien
INSERT INTO "User" (id, email, password, name, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'tech@xch.local',
  '<hash-tech>',
  'Technicien Test E2E',
  'TECHNICIEN',
  '<tenant-id>',
  NOW(),
  NOW()
);

-- Insérer Viewer
INSERT INTO "User" (id, email, password, name, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'viewer@xch.local',
  '<hash-viewer>',
  'Viewer Test E2E',
  'VIEWER',
  '<tenant-id>',
  NOW(),
  NOW()
);

-- Vérifier insertion
SELECT email, name, role FROM "User" WHERE email LIKE '%@xch.local';
```

### Option 2: Via interface admin

1. Se connecter sur http://192.168.0.13:3001 avec ADMIN existant
2. Aller dans `/dashboard/users`
3. Créer manuellement les 4 utilisateurs de test
4. Noter les mots de passe exacts (Admin123!, etc.)

---

## 🐛 Troubleshooting

### Erreur: "Timeout waiting for http://192.168.0.13:3001"

**Cause:** Serveur pas accessible ou containers arrêtés.

**Solutions:**
```bash
# Vérifier containers sur serveur
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose ps"

# Redémarrer si nécessaire
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose restart frontend backend"

# Vérifier logs
ssh xch-deploy "docker logs xch-frontend --tail=50"
ssh xch-deploy "docker logs xch-backend --tail=50"
```

### Erreur: "Login failed: No token stored"

**Cause:** Utilisateurs de test n'existent pas ou mots de passe incorrects.

**Solutions:**
1. Vérifier utilisateurs en DB (voir section Prérequis #2)
2. Créer utilisateurs manquants (voir section Création utilisateurs)
3. Vérifier que les mots de passe correspondent à `auth.fixture.ts`

### Tests flaky (échouent parfois)

**Cause:** Latence réseau entre machine locale et serveur.

**Solutions:**
```bash
# Augmenter timeouts dans playwright.config.ts
timeout: 60000,  # 60s au lieu de 30s
actionTimeout: 15000,  # 15s au lieu de 10s

# Lancer avec 1 seul worker (moins parallèle = plus stable)
npx playwright test --workers=1

# Lancer avec retry
npx playwright test --retries=2
```

### Erreur: "Target closed" ou "Browser disconnected"

**Cause:** Connexion réseau instable ou timeout.

**Solution:**
```bash
# Lancer en mode headed pour voir ce qui se passe
npm run test:e2e:headed

# Lancer un seul test pour débugger
npx playwright test tests/auth/login.spec.ts --headed

# Vérifier connexion réseau stable
ping -t 192.168.0.13
```

---

## 📊 Tests sur serveur vs local

### Différences importantes

| Aspect | Local (non supporté) | Serveur (production) |
|--------|---------------------|----------------------|
| **URL** | http://localhost:3001 | http://192.168.0.13:3001 |
| **Latence** | < 10ms | 50-200ms (réseau) |
| **Stability** | Très stable | Dépend réseau |
| **Timeouts** | 30s suffisant | 60s recommandé |
| **Workers** | 4 workers OK | 2-3 workers recommandé |

### Recommandations serveur

```typescript
// playwright.config.ts - Optimisé serveur distant
{
  timeout: 60000,        // 60s (latence réseau)
  actionTimeout: 15000,  // 15s (actions)
  navigationTimeout: 20000, // 20s (navigation)
  workers: 2,            // Moins de parallélisme
  retries: 1,            // 1 retry en cas échec réseau
}
```

---

## 🔄 Workflow recommandé

### 1. Avant de lancer tests

```bash
# Vérifier serveur accessible
curl http://192.168.0.13:3001

# Vérifier containers running
ssh xch-deploy "docker compose ps"
```

### 2. Lancer tests progressivement

```bash
# D'abord tests Auth (rapide, critique)
npx playwright test tests/auth/

# Si Auth OK, tests Sites
npx playwright test tests/sites/

# Si tout OK, tous les tests
npm run test:e2e
```

### 3. Après tests

```bash
# Voir rapport détaillé
npm run test:e2e:report

# Vérifier logs serveur si échecs
ssh xch-deploy "docker logs xch-backend --tail=100"
ssh xch-deploy "docker logs xch-frontend --tail=100"
```

---

## 📈 Monitoring pendant tests

### Console serveur (Terminal 1)

```bash
# Surveiller logs backend en temps réel
ssh xch-deploy "docker logs -f xch-backend"
```

### Console serveur (Terminal 2)

```bash
# Surveiller logs frontend en temps réel
ssh xch-deploy "docker logs -f xch-frontend"
```

### Machine locale (Terminal 3)

```bash
# Lancer tests avec verbose
npx playwright test --reporter=line
```

---

## ✅ Checklist pré-tests

Avant chaque session de tests:

- [ ] Serveur accessible (ping 192.168.0.13)
- [ ] Frontend répond (curl http://192.168.0.13:3001)
- [ ] Backend répond (curl http://192.168.0.13:3002/api/health)
- [ ] Containers running (docker compose ps)
- [ ] Utilisateurs de test existent (psql query)
- [ ] `.env.e2e` configuré (PLAYWRIGHT_BASE_URL)
- [ ] Playwright installé (npx playwright --version)
- [ ] Aucune maintenance serveur planifiée

---

## 🎯 Tests critiques à valider

### Priority 1 (Après déploiement)

```bash
# Tests Auth (critique pour accès)
npx playwright test tests/auth/login.spec.ts

# Tests Sites (fonctionnalité principale)
npx playwright test tests/sites/sites-crud.spec.ts
```

### Priority 2 (Validation fonctionnelle)

```bash
# Tests Assets (QR codes critiques)
npx playwright test tests/assets/

# Tests Tasks (Kanban drag & drop)
npx playwright test tests/tasks/
```

### Priority 3 (Fonctionnalités avancées)

```bash
# Tests Racks (viewer Konva)
npx playwright test tests/racks/

# Tests FloorPlans (upload + pins)
npx playwright test tests/floorplans/
```

---

## 📞 Support

**Problème réseau:**
- Vérifier connexion réseau local
- Tester ping et curl vers 192.168.0.13

**Problème serveur:**
- SSH: `ssh xch-deploy`
- Logs: `docker logs xch-backend xch-frontend`
- Restart: `docker compose restart`

**Problème tests:**
- Mode debug: `npm run test:e2e:debug`
- UI mode: `npm run test:e2e:ui`
- Traces: `npx playwright show-trace test-results/<trace>.zip`

**Documentation:**
- Guide complet: `frontend/e2e/README.md`
- Quick start: `E2E_TESTS_QUICKSTART.md`
- Configuration: `frontend/playwright.config.ts`

---

**Dernière mise à jour:** 2026-01-12
**Application:** XCH Production (192.168.0.13)
**Statut:** ✅ Tests E2E configurés pour serveur distant
