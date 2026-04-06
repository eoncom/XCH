#!/bin/bash

# Deploy Bug Fixes - Session 24/01/2026
# Corrections critiques: Formulaires, QR Code, GPS, Checklist

set -e  # Exit on error

echo "================================================"
echo "🚀 Déploiement Corrections Bugs - 24/01/2026"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if on server
if [[ ! -d "/opt/xch-dev/XCH" ]]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté sur le serveur (ssh xch-deploy)${NC}"
    echo "   Chemin attendu: /opt/xch-dev/XCH"
    exit 1
fi

cd /opt/xch-dev/XCH

echo -e "${YELLOW}📥 Step 1/5 - Pull modifications depuis Git${NC}"
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors du git pull${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Git pull réussi${NC}"
echo ""

echo -e "${YELLOW}🔧 Step 2/5 - Backend - Installation dépendances${NC}"
cd backend
npm install --production
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors de npm install${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Backend dependencies installées${NC}"
echo ""

echo -e "${YELLOW}🗄️  Step 3/5 - Re-seed Base de Données (CRITIQUE)${NC}"
echo "   Cette étape va recharger les données de démo avec:"
echo "   - Coordonnées GPS pour les 5 sites"
echo "   - Checklists complètes pour les tâches"
echo ""
read -p "⚠️  Confirmer le re-seed de la base? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db seed
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Erreur lors du seed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Base de données re-seedée avec succès${NC}"
else
    echo -e "${YELLOW}⚠️  Re-seed annulé - Les bugs #3 et #4 (checklist) ne seront pas corrigés${NC}"
fi
echo ""

echo -e "${YELLOW}🌐 Step 4/5 - Frontend - Build production${NC}"
cd ../frontend
npm install --production
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors du build frontend${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend buildé avec succès${NC}"
echo ""

echo -e "${YELLOW}🔄 Step 5/5 - Redémarrage services${NC}"
cd ..

# Check if using PM2 or Docker
if command -v pm2 &> /dev/null; then
    echo "   Redémarrage via PM2..."
    pm2 restart xch-backend || echo -e "${YELLOW}⚠️  Backend PM2 non trouvé${NC}"
    pm2 restart xch-frontend || echo -e "${YELLOW}⚠️  Frontend PM2 non trouvé${NC}"
elif command -v docker-compose &> /dev/null; then
    echo "   Redémarrage via Docker Compose..."
    cd backend
    docker-compose restart
else
    echo -e "${YELLOW}⚠️  PM2 et Docker Compose non trouvés - Redémarrage manuel requis${NC}"
fi

echo -e "${GREEN}✅ Services redémarrés${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}✅ Déploiement terminé avec succès!${NC}"
echo "================================================"
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. ✅ Tester la création d'un nouveau site"
echo "   → /dashboard/sites → Nouveau chantier"
echo "   → Remplir Code, Nom, Statut (laisser GPS vides)"
echo "   → Vérifier: soumission réussie sans erreur"
echo ""
echo "2. ✅ Tester la génération QR Code"
echo "   → Ouvrir un asset → Onglet QR Code"
echo "   → Cliquer \"Générer un QR Code\""
echo "   → Vérifier: QR Code affiché"
echo ""
echo "3. ✅ Tester la carte des sites"
echo "   → /dashboard → Carte"
echo "   → Vérifier: 5 marqueurs visibles (Paris, Lyon, Marseille, Bordeaux, Toulouse)"
echo ""
echo "4. ✅ Tester les checklists (si re-seed effectué)"
echo "   → Ouvrir une tâche → Vérifier texte items visible"
echo "   → Cocher un item → Vérifier compteur mis à jour"
echo ""
echo "5. ✅ Test refresh automatique complet"
echo "   → Voir BUG_FIX_REPORT_24012026.md section \"Test du Refresh Automatique\""
echo ""
echo "📄 Rapport détaillé: BUG_FIX_REPORT_24012026.md"
echo ""
