#!/bin/bash

# Script de déploiement production XCH
# Usage: bash scripts/deploy-prod.sh

set -e  # Arrêter en cas d'erreur

echo "========================================="
echo "🚀 Déploiement XCH - Production"
echo "========================================="
echo ""

# Configuration
SERVER_USER="xch-deploy"
SERVER_HOST="192.168.0.13"
PROJECT_PATH="/var/www/xch"
STACK_NAME="xch"

echo "📡 Connexion au serveur $SERVER_HOST..."
echo ""

# Connexion SSH et exécution des commandes
ssh ${SERVER_USER}@${SERVER_HOST} << 'ENDSSH'
set -e

echo "📂 Navigation vers le projet..."
cd /var/www/xch

echo "📥 Pull derniers commits..."
git pull origin main

echo "🔍 Vérification derniers commits..."
git log --oneline -3

echo ""
echo "🐳 Rebuild Frontend (sans cache)..."
docker compose -p xch down frontend
docker compose -p xch build --no-cache frontend
docker compose -p xch up -d frontend

echo ""
echo "⏳ Attente démarrage frontend (30s)..."
sleep 30

echo ""
echo "📊 Statut des conteneurs XCH..."
docker compose -p xch ps

echo ""
echo "📝 Logs frontend (dernières 20 lignes)..."
docker logs xch-frontend --tail=20

echo ""
echo "========================================="
echo "✅ Déploiement terminé avec succès !"
echo "========================================="
echo ""
echo "🌐 URLs :"
echo "  Frontend : https://xch.eoncom.io"
echo "  Backend  : https://xchapi.eoncom.io"
echo ""
echo "📋 Commandes utiles :"
echo "  Logs frontend : docker logs xch-frontend -f"
echo "  Logs backend  : docker logs xch-backend -f"
echo "  Restart stack : docker compose -p xch restart"
echo ""

ENDSSH

echo ""
echo "🎉 Déploiement distant terminé !"
echo ""
echo "🧪 Tests à effectuer :"
echo "  1. Ouvrir https://xch.eoncom.io"
echo "  2. Tester création site avec GPS auto"
echo "  3. Vérifier couleurs pins sur floor plans"
echo "  4. Tester formulaires édition (sites, baies, équipements)"
echo ""
