#!/bin/bash
set -e

echo "🚀 XCH - Déploiement Session 16"
echo "================================"
echo ""

# Variables
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
DEPLOY_DIR="/opt/xch-dev/XCH"
BACKUP_DIR="/opt/xch-dev/backups"
ARCHIVE_NAME="xch-deploy-${TIMESTAMP}.tar.gz"

echo "📦 Création de l'archive de déploiement..."
tar -czf "${ARCHIVE_NAME}" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='.next' \
  --exclude='*.log' \
  frontend/package.json \
  frontend/src/stores/auth-store.ts \
  frontend/src/app/login/page.tsx \
  frontend/src/app/dashboard/racks/[id]/error.tsx \
  frontend/src/app/dashboard/racks/[id]/page.tsx \
  backend/package.json \
  docs/status/PROJECT_STATUS.md \
  DEVELOPMENT_LOG.md

echo "✅ Archive créée : ${ARCHIVE_NAME}"
echo ""

echo "📊 Contenu de l'archive :"
tar -tzf "${ARCHIVE_NAME}"
echo ""

echo "📈 Taille de l'archive :"
ls -lh "${ARCHIVE_NAME}"
echo ""

echo "📤 Prêt pour transfert vers le serveur"
echo ""
echo "Commandes de déploiement :"
echo "-------------------------"
echo "1. Transférer : scp ${ARCHIVE_NAME} xch-deploy:/tmp/"
echo "2. SSH serveur : ssh xch-deploy"
echo "3. Extraire    : cd ${DEPLOY_DIR} && tar -xzf /tmp/${ARCHIVE_NAME}"
echo "4. Build       : docker compose build backend frontend"
echo "5. Restart     : docker compose up -d --force-recreate backend frontend"
echo "6. Logs        : docker compose logs -f --tail=50 backend frontend"

