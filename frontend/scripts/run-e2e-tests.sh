#!/bin/bash
# Script d'exécution tests E2E Playwright sur serveur
# Usage: bash scripts/run-e2e-tests.sh

set -e

echo "========================================="
echo "XCH - Exécution Tests E2E Playwright"
echo "========================================="
echo ""

# 1. Vérifier environnement
echo "📋 1/6 - Vérification environnement..."
if [ ! -f ".env.e2e" ]; then
  echo "❌ Erreur: .env.e2e manquant"
  echo "   Créer depuis .env.e2e.example"
  exit 1
fi

# Afficher URLs configurées
echo "✅ .env.e2e trouvé"
echo "   URLs configurées:"
grep "PLAYWRIGHT_" .env.e2e | sed 's/^/   /'
echo ""

# 2. Installer dotenv si manquant
echo "📦 2/6 - Installation dépendances..."
if ! npm list dotenv > /dev/null 2>&1; then
  echo "   Installation dotenv..."
  npm install --save-dev dotenv
fi
echo "✅ dotenv installé"
echo ""

# 3. Vérifier Playwright browsers
echo "🎭 3/6 - Vérification Playwright browsers..."
if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ]; then
  echo "   Installation Playwright browsers..."
  npx playwright install --with-deps chromium
fi
echo "✅ Chromium installé"
echo ""

# 4. Vérifier services accessibles
echo "🌐 4/6 - Vérification services..."
FRONTEND_URL=$(grep PLAYWRIGHT_BASE_URL .env.e2e | cut -d'=' -f2)
BACKEND_URL=$(grep PLAYWRIGHT_API_URL .env.e2e | cut -d'=' -f2)

echo "   Test Frontend: $FRONTEND_URL"
if curl -sSf "$FRONTEND_URL" > /dev/null 2>&1; then
  echo "   ✅ Frontend accessible"
else
  echo "   ❌ Frontend non accessible"
  echo "   Vérifier: docker ps | grep xch-frontend"
  exit 1
fi

echo "   Test Backend: $BACKEND_URL/api/health"
if curl -sSf "$BACKEND_URL/api/health" > /dev/null 2>&1; then
  echo "   ✅ Backend accessible"
else
  echo "   ❌ Backend non accessible"
  echo "   Vérifier: docker ps | grep xch-backend"
  exit 1
fi
echo ""

# 5. Exécuter tests
echo "🧪 5/6 - Exécution tests E2E..."
echo "   Mode: headless chromium"
echo "   Parallèle: 2 workers"
echo ""

# Lancer tests avec timeout augmenté
export PLAYWRIGHT_TIMEOUT=60000
npx playwright test --project=chromium --reporter=list

TEST_EXIT_CODE=$?
echo ""

# 6. Résultats
echo "📊 6/6 - Résultats..."
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ Tous les tests sont passés!"
  echo ""
  echo "📄 Rapport HTML:"
  echo "   npm run test:e2e:report"
else
  echo "❌ Certains tests ont échoué (code: $TEST_EXIT_CODE)"
  echo ""
  echo "🔍 Debug:"
  echo "   npm run test:e2e:ui      # Mode UI interactif"
  echo "   npm run test:e2e:headed  # Voir navigateur"
  echo ""
  echo "📄 Rapport:"
  echo "   npm run test:e2e:report"
fi

echo ""
echo "========================================="
exit $TEST_EXIT_CODE
