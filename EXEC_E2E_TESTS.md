# 🎭 XCH - Exécution Tests E2E sur Serveur

**Date:** 2026-01-27
**Serveur:** 192.168.0.13

---

## 🚀 Exécution Rapide

```bash
# 1. Se connecter au serveur
ssh xch-deploy

# 2. Aller dans frontend
cd /opt/xch-dev/XCH/frontend

# 3. Exécuter le script
bash scripts/run-e2e-tests.sh
```

Le script fait automatiquement:
- ✅ Vérification .env.e2e
- ✅ Installation dotenv si besoin
- ✅ Installation Playwright browsers
- ✅ Vérification Frontend/Backend accessibles
- ✅ Exécution tests Playwright
- ✅ Affichage résultats

---

## 📊 Résultat Attendu

```
🧪 5/6 - Exécution tests E2E...
   Mode: headless chromium
   Parallèle: 2 workers

Running 79 tests using 2 workers...

✅ dashboard-tiles.spec.ts (8/8 passed)
✅ sites-sections.spec.ts (12/12 passed)
✅ settings.spec.ts (11/11 passed)
...

79 passed (3.2 minutes)

✅ Tous les tests sont passés!
```

---

## 🐛 Si Échecs

### Erreur: "No accessToken cookie"

**Cause:** Users de test pas dans DB

**Solution:**
```bash
cd /opt/xch-dev/XCH/backend
docker compose exec backend npm run prisma:seed
```

### Erreur: "Navigation timeout"

**Cause:** Services lents ou non démarrés

**Solution:**
```bash
# Vérifier containers
docker compose ps

# Redémarrer si besoin
docker compose restart backend frontend
```

### Erreur: "Self-signed certificate"

**Cause:** SSL local

**Solution:** Déjà géré dans `playwright.config.ts` avec `ignoreHTTPSErrors: true`

---

## 📄 Consulter Rapport HTML

```bash
# Sur serveur
cd /opt/xch-dev/XCH/frontend
npm run test:e2e:report

# Ou télécharger rapport localement
scp -r xch-deploy:/opt/xch-dev/XCH/frontend/playwright-report .
firefox playwright-report/index.html
```

---

## 🔧 Modes Debug

```bash
# Mode UI (interactif) - nécessite X11 forward
npm run test:e2e:ui

# Mode headed (voir navigateur) - nécessite display
npm run test:e2e:headed

# Test spécifique
npx playwright test e2e/tests/dashboard/dashboard-tiles.spec.ts

# Avec debug
npx playwright test --debug
```

---

## ✅ Validation

Critère succès: **≥ 95% tests pass (75+/79)**

Si < 95%:
1. Lire rapport HTML détaillé
2. Vérifier seed data complet
3. Ajuster timeouts si nécessaire
4. Corriger data-testid manquants
