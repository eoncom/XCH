#!/bin/bash

# Setup Git Credentials on Server
# This script configures GitHub authentication for automatic deployments

set -e

echo "🔐 Configuration Git Credentials pour XCH"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running on server
if [[ ! -d "/opt/xch-dev/XCH" ]]; then
    echo -e "${RED}❌ Ce script doit être exécuté sur le serveur${NC}"
    echo "   Utilisation: ssh xch-deploy 'bash -s' < scripts/setup-git-credentials.sh"
    exit 1
fi

cd /opt/xch-dev/XCH

echo -e "${BLUE}📋 Configuration Git actuelle:${NC}"
git config --list | grep -E '(user\.|credential\.|remote\.origin)' || echo "Aucune configuration Git trouvée"
echo ""

# Check if GitHub PAT is provided as environment variable
if [[ -z "$GITHUB_TOKEN" ]]; then
    echo -e "${YELLOW}⚠️  Variable GITHUB_TOKEN non définie${NC}"
    echo ""
    echo "Pour configurer Git avec authentification GitHub:"
    echo ""
    echo "1. Créer un Personal Access Token sur GitHub:"
    echo "   https://github.com/settings/tokens/new"
    echo "   Permissions requises: repo (full)"
    echo ""
    echo "2. Exécuter ce script avec le token:"
    echo "   export GITHUB_TOKEN='ghp_xxxxxxxxxxxxx'"
    echo "   bash scripts/setup-git-credentials.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Token GitHub détecté${NC}"
echo ""

# Configure Git user
echo -e "${BLUE}📝 Configuration utilisateur Git...${NC}"
git config --global user.name "XCH Deploy Bot"
git config --global user.email "deploy@xch.local"
echo -e "${GREEN}✅ Utilisateur Git configuré${NC}"
echo ""

# Configure credential helper
echo -e "${BLUE}🔑 Configuration credential helper...${NC}"
git config --global credential.helper store
echo -e "${GREEN}✅ Credential helper activé${NC}"
echo ""

# Get repository URL
REPO_URL=$(git config --get remote.origin.url)
echo -e "${BLUE}📡 Repository actuel: ${NC}$REPO_URL"

# Convert to HTTPS if SSH
if [[ $REPO_URL == git@github.com:* ]]; then
    HTTPS_URL=$(echo $REPO_URL | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
    echo -e "${YELLOW}⚠️  URL SSH détectée, conversion en HTTPS...${NC}"
    git remote set-url origin "$HTTPS_URL.git"
    REPO_URL="$HTTPS_URL.git"
    echo -e "${GREEN}✅ URL convertie: ${NC}$REPO_URL"
fi

# Extract repository path (owner/repo)
REPO_PATH=$(echo $REPO_URL | sed -n 's|https://github.com/\(.*\)\.git|\1|p')
if [[ -z "$REPO_PATH" ]]; then
    REPO_PATH=$(echo $REPO_URL | sed -n 's|https://github.com/\(.*\)|\1|p')
fi

echo -e "${BLUE}📦 Repository: ${NC}$REPO_PATH"
echo ""

# Create credentials file with token
echo -e "${BLUE}💾 Sauvegarde des credentials...${NC}"
CREDENTIALS_FILE="$HOME/.git-credentials"

# Create URL with token
AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"

# Save to credentials file
echo "$AUTH_URL" > "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"
echo -e "${GREEN}✅ Credentials sauvegardés dans ${NC}$CREDENTIALS_FILE"
echo ""

# Test Git access
echo -e "${BLUE}🧪 Test de l'accès Git...${NC}"
if git ls-remote origin &> /dev/null; then
    echo -e "${GREEN}✅ Accès Git fonctionnel !${NC}"
    echo ""

    # Test pull
    echo -e "${BLUE}🔄 Test git pull...${NC}"
    git fetch origin main
    echo -e "${GREEN}✅ Fetch réussi !${NC}"
    echo ""
else
    echo -e "${RED}❌ Échec de l'accès Git${NC}"
    echo "   Vérifiez le token GitHub et les permissions"
    exit 1
fi

echo "================================================"
echo -e "${GREEN}✅ Configuration Git terminée avec succès !${NC}"
echo "================================================"
echo ""
echo "📋 Résumé de la configuration:"
echo "   • User: XCH Deploy Bot"
echo "   • Email: deploy@xch.local"
echo "   • Repository: $REPO_PATH"
echo "   • Credential helper: store"
echo "   • Credentials file: $CREDENTIALS_FILE"
echo ""
echo "🚀 Vous pouvez maintenant utiliser:"
echo "   • git pull origin main"
echo "   • bash scripts/deploy-auto.sh"
echo ""
