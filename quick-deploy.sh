#!/bin/bash

# Quick Deploy - One-liner pour déploiement depuis machine locale
# Usage: bash quick-deploy.sh [skip|push|migrate|reset]

DB_ACTION=${1:-"push"}

echo "🚀 Quick Deploy XCH"
echo "Database action: $DB_ACTION"
echo ""

# Deploy sur le serveur
ssh xch-deploy "cd /opt/xch-dev/XCH && AUTO_DEPLOY_DB_ACTION=$DB_ACTION AUTO_DEPLOY_CONFIRM_RESET=yes bash scripts/deploy-auto.sh"

echo ""
echo "✅ Déploiement terminé !"
echo ""
echo "📊 Vérifier:"
echo "   Frontend: http://votre-domaine.com"
echo "   Backend: http://votre-domaine.com/api/health"
echo ""
