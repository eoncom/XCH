#!/bin/bash

# Automated Deployment Script for XCH
# Handles: Git pull, Docker rebuild, Database seed, Service restart

set -e

echo "🚀 Déploiement Automatique XCH"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/xch-dev/XCH"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_FILE="/tmp/xch-deploy-$(date +%Y%m%d-%H%M%S).log"

# Redirect output to log file
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}📝 Log file: ${NC}$LOG_FILE"
echo ""

# Check if running on server
if [[ ! -d "$PROJECT_DIR" ]]; then
    echo -e "${RED}❌ Erreur: Répertoire projet non trouvé${NC}"
    echo "   Attendu: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required commands
echo -e "${BLUE}🔍 Vérification des prérequis...${NC}"
MISSING_DEPS=()

if ! command_exists git; then MISSING_DEPS+=("git"); fi
if ! command_exists docker; then MISSING_DEPS+=("docker"); fi
if ! command_exists npm; then MISSING_DEPS+=("npm"); fi

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Commandes manquantes: ${MISSING_DEPS[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Tous les prérequis sont installés${NC}"
echo ""

# Step 1: Git Pull
echo -e "${BLUE}📥 Step 1/6 - Git Pull${NC}"
echo "----------------------------------------"

CURRENT_BRANCH=$(git branch --show-current)
echo "   Branche actuelle: $CURRENT_BRANCH"

# Stash local changes if any
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}   ⚠️  Modifications locales détectées, stash...${NC}"
    git stash
fi

echo "   Pull de origin/$CURRENT_BRANCH..."
if git pull origin "$CURRENT_BRANCH"; then
    echo -e "${GREEN}   ✅ Git pull réussi${NC}"

    # Show latest commits
    echo "   Derniers commits:"
    git log -3 --oneline --decorate
else
    echo -e "${RED}   ❌ Échec du git pull${NC}"
    exit 1
fi
echo ""

# Step 2: Backend Dependencies
echo -e "${BLUE}📦 Step 2/6 - Backend Dependencies${NC}"
echo "----------------------------------------"
cd "$BACKEND_DIR"

if [ -f "package.json" ]; then
    echo "   Installation des dépendances backend..."
    npm install --production
    echo -e "${GREEN}   ✅ Dependencies backend installées${NC}"
else
    echo -e "${YELLOW}   ⚠️  package.json non trouvé${NC}"
fi
echo ""

# Step 3: Prisma Client Regeneration
echo -e "${BLUE}🔄 Step 3/6 - Prisma Client${NC}"
echo "----------------------------------------"

if [ -f "prisma/schema.prisma" ]; then
    echo "   Génération du Prisma Client..."
    npx prisma generate
    echo -e "${GREEN}   ✅ Prisma Client regénéré${NC}"

    # Show Prisma schema hash
    SCHEMA_HASH=$(md5sum prisma/schema.prisma | cut -d' ' -f1)
    echo "   Schema hash: $SCHEMA_HASH"
else
    echo -e "${YELLOW}   ⚠️  Schema Prisma non trouvé${NC}"
fi
echo ""

# Step 4: Database Sync
echo -e "${BLUE}🗄️  Step 4/6 - Database Sync${NC}"
echo "----------------------------------------"

echo "   Options de synchronisation:"
echo "   1) db push (rapide, dev)"
echo "   2) migrate deploy (production, safe)"
echo "   3) reset + seed (complet, DESTRUCTIF)"
echo "   4) skip (garder DB actuelle)"
echo ""

if [[ -n "$AUTO_DEPLOY_DB_ACTION" ]]; then
    DB_ACTION="$AUTO_DEPLOY_DB_ACTION"
    echo -e "${BLUE}   Mode automatique: $DB_ACTION${NC}"
else
    read -p "   Choisir [1-4]: " -n 1 -r DB_CHOICE
    echo ""
    case $DB_CHOICE in
        1) DB_ACTION="push" ;;
        2) DB_ACTION="migrate" ;;
        3) DB_ACTION="reset" ;;
        4) DB_ACTION="skip" ;;
        *) DB_ACTION="skip" ;;
    esac
fi

case $DB_ACTION in
    "push")
        echo "   Exécution: prisma db push..."
        npx prisma db push --accept-data-loss
        echo -e "${GREEN}   ✅ Database schema synchronisé${NC}"
        ;;
    "migrate")
        echo "   Exécution: prisma migrate deploy..."
        npx prisma migrate deploy
        echo -e "${GREEN}   ✅ Migrations appliquées${NC}"
        ;;
    "reset")
        echo -e "${YELLOW}   ⚠️  ATTENTION: Reset va SUPPRIMER toutes les données${NC}"
        if [[ "$AUTO_DEPLOY_CONFIRM_RESET" != "yes" ]]; then
            read -p "   Confirmer reset ? (y/N): " -n 1 -r CONFIRM_RESET
            echo ""
            if [[ ! $CONFIRM_RESET =~ ^[Yy]$ ]]; then
                echo "   Reset annulé"
                DB_ACTION="skip"
            fi
        fi

        if [[ "$DB_ACTION" == "reset" ]]; then
            echo "   Exécution: prisma migrate reset..."
            npx prisma migrate reset --force
            echo -e "${GREEN}   ✅ Database reset + seed complété${NC}"
        fi
        ;;
    "skip")
        echo -e "${YELLOW}   ⏭️  Synchronisation DB ignorée${NC}"
        ;;
esac
echo ""

# Step 5: Frontend Build
echo -e "${BLUE}🌐 Step 5/6 - Frontend Build${NC}"
echo "----------------------------------------"
cd "$FRONTEND_DIR"

if [ -f "package.json" ]; then
    echo "   Installation des dépendances frontend..."
    npm install --production

    echo "   Build frontend..."
    npm run build
    echo -e "${GREEN}   ✅ Frontend buildé${NC}"
else
    echo -e "${YELLOW}   ⚠️  Frontend package.json non trouvé${NC}"
fi
echo ""

# Step 6: Services Restart
echo -e "${BLUE}🔄 Step 6/6 - Services Restart${NC}"
echo "----------------------------------------"
cd "$PROJECT_DIR"

# Detect service manager
if command_exists docker && [ -f "docker-compose.yml" ]; then
    echo "   Redémarrage via Docker Compose..."
    docker compose restart backend frontend
    echo -e "${GREEN}   ✅ Services Docker redémarrés${NC}"

    # Show container status
    echo ""
    echo "   Status des containers:"
    docker compose ps | grep -E '(backend|frontend|postgres)' || true

elif command_exists pm2; then
    echo "   Redémarrage via PM2..."
    pm2 restart xch-backend || echo -e "${YELLOW}   ⚠️  Backend PM2 non trouvé${NC}"
    pm2 restart xch-frontend || echo -e "${YELLOW}   ⚠️  Frontend PM2 non trouvé${NC}"
    echo -e "${GREEN}   ✅ Services PM2 redémarrés${NC}"

    # Show PM2 status
    echo ""
    pm2 status | grep -E '(xch-backend|xch-frontend)' || true

else
    echo -e "${YELLOW}   ⚠️  Aucun gestionnaire de services détecté (Docker/PM2)${NC}"
    echo "   Redémarrage manuel requis"
fi
echo ""

# Final Summary
echo "================================================"
echo -e "${GREEN}✅ Déploiement terminé avec succès !${NC}"
echo "================================================"
echo ""
echo "📊 Résumé du déploiement:"
echo "   • Branche: $CURRENT_BRANCH"
echo "   • Commit: $(git rev-parse --short HEAD)"
echo "   • Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "   • Database action: $DB_ACTION"
echo "   • Log: $LOG_FILE"
echo ""

# Health Check
echo -e "${BLUE}🏥 Health Check${NC}"
echo "----------------------------------------"

# Check backend
if curl -sf http://localhost:3002/health > /dev/null 2>&1 || \
   curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Backend: OK${NC}"
else
    echo -e "${YELLOW}   ⚠️  Backend: Non accessible${NC}"
fi

# Check frontend
if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Frontend: OK${NC}"
else
    echo -e "${YELLOW}   ⚠️  Frontend: Non accessible${NC}"
fi

echo ""
echo "🎯 Prochaines étapes recommandées:"
echo "   1. Tester l'application: http://votre-domaine.com"
echo "   2. Vérifier les logs: tail -f $LOG_FILE"
echo "   3. Monitorer les services: docker compose logs -f"
echo ""
