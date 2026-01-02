#!/bin/bash

# ============================================
# XCH - Vérification Documentation
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  XCH - Vérification Documentation${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

ERRORS=0
WARNINGS=0

# 1. Vérifier structure dossiers
echo -e "${BLUE}[1/4] Vérification structure dossiers...${NC}"
echo "─────────────────────────────────────────"

REQUIRED_DIRS=(
    "docs/installation"
    "docs/guides"
    "docs/status"
    "docs/archive/backend"
    "docs/archive/frontend"
    "docs/archive/livraisons"
    "docs/business"
    "docs/architecture"
    "docs/decisions"
)

MISSING_DIRS=0
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "  ${RED}❌ Dossier manquant : $dir${NC}"
        ((MISSING_DIRS++))
        ((ERRORS++))
    fi
done

if [ $MISSING_DIRS -eq 0 ]; then
    echo -e "  ${GREEN}✅ Tous les dossiers requis existent${NC}"
fi

echo ""

# 2. Vérifier fichiers requis
echo -e "${BLUE}[2/4] Vérification fichiers requis...${NC}"
echo "─────────────────────────────────────────"

REQUIRED_FILES=(
    "README.md"
    "CLAUDE.md"
    "LIVRAISON_MVP_100.md"
    "docs/00-INDEX.md"
    "docs/installation/INSTALL_DEV.md"
    "docs/installation/INSTALL_PROD.md"
    "docs/installation/DOCKER_PORTS.md"
    "docs/guides/DEVELOPMENT_GUIDE.md"
    "docs/status/PROJECT_STATUS.md"
    "docs/status/ROADMAP.md"
    "docs/business/CAHIER_DES_CHARGES.md"
    "docs/architecture/tech-stack.md"
    "docs/architecture/database-schema.md"
)

MISSING_FILES=0
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "  ${RED}❌ Fichier manquant : $file${NC}"
        ((MISSING_FILES++))
        ((ERRORS++))
    fi
done

if [ $MISSING_FILES -eq 0 ]; then
    echo -e "  ${GREEN}✅ Tous les fichiers requis existent${NC}"
fi

echo ""

# 3. Vérifier dates "Dernière mise à jour"
echo -e "${BLUE}[3/4] Vérification dates...${NC}"
echo "─────────────────────────────────────────"

MISSING_DATES=0
for file in $(find . -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"); do
    # Ignorer certains fichiers qui n'ont pas besoin de date
    if [[ "$file" == *"CHANGELOG"* ]] || [[ "$file" == *"LICENSE"* ]]; then
        continue
    fi

    if ! grep -q "Dernière mise à jour" "$file" && ! grep -q "Date.*:" "$file"; then
        echo -e "  ${YELLOW}⚠️  Pas de date dans : $file${NC}"
        ((MISSING_DATES++))
        ((WARNINGS++))
    fi
done

if [ $MISSING_DATES -eq 0 ]; then
    echo -e "  ${GREEN}✅ Tous les fichiers ont une date${NC}"
else
    echo -e "  ${YELLOW}⚠️  $MISSING_DATES fichier(s) sans date${NC}"
fi

echo ""

# 4. Vérifier absence de doublons
echo -e "${BLUE}[4/4] Vérification absence doublons...${NC}"
echo "─────────────────────────────────────────"

OBSOLETE_FILES=(
    "DEVELOPMENT_STATUS.md"
    "PROJECT_STATUS_FINAL.md"
    "MVP_COMPLET.md"
    "INSTALL_DEV.md"
    "INSTALL_PROD.md"
    "DOCKER_PORTS.md"
    "DEVELOPMENT_GUIDE.md"
    "DOCS_INDEX.md"
    "CHECKPOINT_MODULES_1-4.md"
    "CHECKPOINT_MODULES_6-8.md"
    "CHECKPOINT_BACKEND_FINAL.md"
    "CHECKPOINT_FRONTEND_PHASE1.md"
    "CHECKPOINT_FRONTEND_FINAL.md"
    "LIVRAISON_FINALE.md"
    "DOCUMENTATION_COMPLETE.md"
    "docs/roadmap.md"
    "docs/cahier-des-charges.md"
)

FOUND_OBSOLETE=0
for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${RED}❌ Fichier obsolète trouvé : $file (devrait être déplacé/archivé)${NC}"
        ((FOUND_OBSOLETE++))
        ((ERRORS++))
    fi
done

if [ $FOUND_OBSOLETE -eq 0 ]; then
    echo -e "  ${GREEN}✅ Aucun fichier obsolète à la racine${NC}"
fi

echo ""
echo -e "${BLUE}=========================================${NC}"

# Résumé final
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ RÉSULTAT : Documentation parfaitement organisée${NC}"
    echo ""
    echo "Statistiques :"
    echo "  - Structure : ✅ Conforme"
    echo "  - Fichiers requis : ✅ Tous présents"
    echo "  - Dates : ✅ Toutes ajoutées"
    echo "  - Doublons : ✅ Aucun"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  RÉSULTAT : Documentation OK avec $WARNINGS avertissement(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ RÉSULTAT : $ERRORS erreur(s), $WARNINGS avertissement(s)${NC}"
    echo ""
    echo "Actions recommandées :"
    echo "1. Vérifier les fichiers/dossiers manquants"
    echo "2. Déplacer les fichiers obsolètes vers docs/archive/"
    echo "3. Ajouter dates dans les fichiers sans date"
    exit 1
fi
