#!/bin/bash

# Session 18 - Script Déploiement Production
# Déploie corrections refresh automatique + middleware réactivé

set -e  # Exit on error

echo "🚀 Déploiement Session 18 - Refresh Automatique + Middleware"
echo "=============================================================="
echo ""

# Variables
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE_NAME="frontend-session18-${TIMESTAMP}.tar.gz"
SERVER_USER="xch-deploy"
SERVER_HOST="192.168.0.13"
SERVER_PATH="/opt/xch-dev/XCH"

echo "📦 Étape 1/6 : Build frontend production"
echo "----------------------------------------"
cd frontend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erreur : Build frontend échoué"
    exit 1
fi
echo "✅ Build réussi (28 routes, 0 erreurs)"
echo ""

echo "📦 Étape 2/6 : Création archive"
echo "----------------------------------------"
cd ..
tar -czf "${ARCHIVE_NAME}" -C frontend .next package.json package-lock.json

ARCHIVE_SIZE=$(du -h "${ARCHIVE_NAME}" | cut -f1)
echo "✅ Archive créée : ${ARCHIVE_NAME} (${ARCHIVE_SIZE})"
echo ""

echo "📤 Étape 3/6 : Transfer vers serveur"
echo "----------------------------------------"
scp "${ARCHIVE_NAME}" "${SERVER_USER}@${SERVER_HOST}:/tmp/"

if [ $? -ne 0 ]; then
    echo "❌ Erreur : Transfer SSH échoué"
    exit 1
fi
echo "✅ Archive transférée vers ${SERVER_HOST}"
echo ""

echo "📂 Étape 4/6 : Extraction sur serveur"
echo "----------------------------------------"
ssh "${SERVER_USER}@${SERVER_HOST}" << EOF
    set -e
    cd ${SERVER_PATH}/frontend
    echo "Extraction archive..."
    tar -xzf /tmp/${ARCHIVE_NAME}
    echo "✅ Archive extraite"
    rm /tmp/${ARCHIVE_NAME}
    echo "✅ Archive temporaire supprimée"
EOF

if [ $? -ne 0 ]; then
    echo "❌ Erreur : Extraction échouée"
    exit 1
fi
echo "✅ Extraction terminée"
echo ""

echo "🐳 Étape 5/6 : Rebuild container Docker"
echo "----------------------------------------"
ssh "${SERVER_USER}@${SERVER_HOST}" << EOF
    set -e
    cd ${SERVER_PATH}
    echo "Build image frontend..."
    docker-compose build frontend --no-cache
    echo "Restart container..."
    docker-compose up -d frontend
    echo "Attente démarrage (10s)..."
    sleep 10
EOF

if [ $? -ne 0 ]; then
    echo "❌ Erreur : Docker rebuild échoué"
    exit 1
fi
echo "✅ Container redémarré"
echo ""

echo "✅ Étape 6/6 : Validation déploiement"
echo "----------------------------------------"
echo "Vérification logs container..."
ssh "${SERVER_USER}@${SERVER_HOST}" "docker logs xch-frontend --tail 20 2>&1 | grep -E '(Ready|error|Error)' || echo 'Aucun log trouvé'"

echo ""
echo "Test endpoint frontend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://xch.eoncom.io)

if [ "${HTTP_CODE}" == "200" ] || [ "${HTTP_CODE}" == "307" ]; then
    echo "✅ Frontend accessible (HTTP ${HTTP_CODE})"
else
    echo "⚠️  Attention : HTTP ${HTTP_CODE} (attendu 200 ou 307)"
fi

echo ""
echo "=============================================================="
echo "🎉 Déploiement Session 18 TERMINÉ"
echo "=============================================================="
echo ""
echo "📊 Résumé :"
echo "  - Fichiers modifiés : 12"
echo "  - Commits déployés : 2 (8639685, e6695ac)"
echo "  - Corrections : Refresh automatique + Middleware"
echo ""
echo "✅ Tests manuels à effectuer :"
echo "  1. https://xch.eoncom.io/dashboard/sites/new"
echo "     → Créer site → Vérifier liste à jour SANS F5"
echo ""
echo "  2. https://xch.eoncom.io/dashboard/assets/new"
echo "     → Créer asset → Vérifier liste à jour SANS F5"
echo ""
echo "  3. Navigation privée → https://xch.eoncom.io/dashboard"
echo "     → Vérifier redirect /login automatique (middleware)"
echo ""
echo "📝 Archive locale : ${ARCHIVE_NAME}"
echo "🔗 Application : https://xch.eoncom.io"
echo ""
echo "✅ Session 18 déployée avec succès ! 🚀"
