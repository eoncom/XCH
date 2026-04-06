#!/bin/bash
#
# Script de déploiement - React 19.2.3 Security Patch
# Serveur: xch-deploy (192.168.0.13)
# Date: 2026-01-21
#

set -e  # Exit on error

echo "=================================="
echo "XCH - Déploiement React 19.2.3"
echo "Security Patch CVE-2025-55182"
echo "=================================="
echo ""

# Variables
PROJECT_DIR="/opt/xch-dev/XCH"
BACKUP_DIR="/opt/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[1/10]${NC} Navigation vers projet..."
cd $PROJECT_DIR || exit 1
pwd

echo ""
echo -e "${YELLOW}[2/10]${NC} Vérification Git status..."
git status

echo ""
echo -e "${YELLOW}[3/10]${NC} Backup code frontend..."
sudo mkdir -p $BACKUP_DIR
sudo tar -czf $BACKUP_DIR/xch-frontend-$TIMESTAMP.tar.gz frontend/
echo -e "${GREEN}✅ Backup créé: $BACKUP_DIR/xch-frontend-$TIMESTAMP.tar.gz${NC}"

echo ""
echo -e "${YELLOW}[4/10]${NC} Backup base de données..."
docker exec xch-postgres pg_dump -U xch_user xch_dev > $BACKUP_DIR/xch-db-$TIMESTAMP.sql 2>/dev/null || echo "DB backup skipped (container stopped?)"
if [ -f "$BACKUP_DIR/xch-db-$TIMESTAMP.sql" ]; then
    echo -e "${GREEN}✅ DB backup créé: $BACKUP_DIR/xch-db-$TIMESTAMP.sql${NC}"
fi

echo ""
echo -e "${YELLOW}[5/10]${NC} Pull dernières modifications Git..."
git fetch origin
git pull origin main
echo -e "${GREEN}✅ Git pull terminé${NC}"

echo ""
echo -e "${YELLOW}[6/10]${NC} Vérification changements..."
echo "Dernier commit:"
git log -1 --oneline
echo ""
echo "Fichiers modifiés:"
git show --stat HEAD

echo ""
echo -e "${YELLOW}[7/10]${NC} Arrêt container frontend..."
docker-compose down frontend 2>/dev/null || echo "Container déjà arrêté"

echo ""
echo -e "${YELLOW}[8/10]${NC} Rebuild frontend (React 19.2.3)..."
echo -e "${YELLOW}⏳ Cela peut prendre 2-3 minutes...${NC}"
docker-compose build --no-cache frontend

echo ""
echo -e "${YELLOW}[9/10]${NC} Démarrage container frontend..."
docker-compose up -d frontend
sleep 5

echo ""
echo -e "${YELLOW}[10/10]${NC} Vérification logs frontend..."
docker logs xch-frontend --tail 30

echo ""
echo "=================================="
echo -e "${GREEN}✅ DÉPLOIEMENT TERMINÉ${NC}"
echo "=================================="
echo ""
echo "📊 Informations:"
echo "  - Backup code: $BACKUP_DIR/xch-frontend-$TIMESTAMP.tar.gz"
echo "  - Backup DB: $BACKUP_DIR/xch-db-$TIMESTAMP.sql"
echo "  - Commit déployé: $(git rev-parse --short HEAD)"
echo ""
echo "🧪 Tests manuels requis:"
echo "  1. Ouvrir https://xch.eoncom.io"
echo "  2. Login: admin@xch.demo / admin123"
echo "  3. Tester Baies (react-konva)"
echo "  4. Tester FloorPlans (react-konva)"
echo ""
echo "🔍 Health check:"
echo "  curl -I http://192.168.0.13:3001"
echo ""
echo "📝 Logs temps réel:"
echo "  docker logs -f xch-frontend"
echo ""
