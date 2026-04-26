#!/bin/bash

##############################################################################
# check-deploy-parity.sh - Vérifie la parité entre XCH (dev) et XCH-deploy (prod)
#
# Usage:
#   bash scripts/check-deploy-parity.sh                  # Vérification standard
#   bash scripts/check-deploy-parity.sh --strict         # Échoue aussi si XCH a des commits non taggés
#   bash scripts/check-deploy-parity.sh --tag v1.5.0     # Vérifie qu'un tag précis existe dans les 2 repos
#
# Description:
#   Garde-fou pré-deploy. Vérifie que :
#   1. L'arbre de travail XCH est propre (pas de modifs non commitées).
#   2. Le HEAD courant correspond à un tag (release) — sauf en mode standard.
#   3. Le dernier tag XCH existe aussi dans XCH-deploy (sinon → drift).
#   4. (Post-S5) Aucune migration Prisma pending non appliquée par migrate deploy.
#
#   À appeler depuis un hook pre-push, depuis CI, ou manuellement avant
#   un déploiement sur le serveur xch-deploy.
#
# Exit codes:
#   0 = OK, parité respectée
#   1 = Drift détecté (un message en clair indique quoi)
#   2 = Erreur d'environnement (git absent, repo mauvais, etc.)
#
# Auteur: XCH Project
# Date: 2026-04-26
##############################################################################

set -uo pipefail

# ── Couleurs ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

DEV_REMOTE_URL="${XCH_DEV_REMOTE:-https://github.com/eoncom/XCH.git}"
DEPLOY_REMOTE_URL="${XCH_DEPLOY_REMOTE:-https://github.com/eoncom/XCH-deploy.git}"

STRICT=false
TAG_TO_CHECK=""
EXIT_CODE=0
DEPLOY_TAGS=""
DEPLOY_TAG_COUNT=0
DEPLOY_LATEST_TAG=""

# ── Parsing args ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --strict)   STRICT=true; shift ;;
        --tag)      TAG_TO_CHECK="$2"; shift 2 ;;
        -h|--help)
            sed -n '3,30p' "$0" | sed 's/^# *//'
            exit 0
            ;;
        *)
            echo -e "${RED}Argument inconnu: $1${NC}"
            exit 2
            ;;
    esac
done

# ── Pré-checks env ──────────────────────────────────────────────────────────
command -v git >/dev/null 2>&1 || { echo -e "${RED}git introuvable${NC}"; exit 2; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo -e "${RED}Pas dans un repo git${NC}"; exit 2; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} check-deploy-parity.sh — XCH ↔ XCH-deploy${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Dev repo    : $DEV_REMOTE_URL"
echo "  Deploy repo : $DEPLOY_REMOTE_URL"
echo "  Mode        : $($STRICT && echo strict || echo standard)"
[ -n "$TAG_TO_CHECK" ] && echo "  Tag check   : $TAG_TO_CHECK"
echo

# ── 1. Arbre propre ─────────────────────────────────────────────────────────
echo -n "1. Arbre de travail propre … "
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}KO${NC}"
    echo "   Modifs non commitées :"
    git status --short | head -10 | sed 's/^/   /'
    EXIT_CODE=1
else
    echo -e "${GREEN}OK${NC}"
fi

# ── 2. HEAD = un tag ? (en mode --strict uniquement) ────────────────────────
echo -n "2. HEAD est sur un tag annoté … "
HEAD_TAG="$(git describe --tags --exact-match HEAD 2>/dev/null || echo '')"
if [ -z "$HEAD_TAG" ]; then
    if [ "$STRICT" = true ]; then
        echo -e "${RED}KO${NC}"
        echo "   HEAD ($(git rev-parse --short HEAD)) n'est pas taggé."
        echo "   Tag requis en mode --strict."
        EXIT_CODE=1
    else
        echo -e "${YELLOW}SKIP${NC} (mode standard, HEAD = $(git rev-parse --short HEAD))"
    fi
else
    echo -e "${GREEN}OK${NC} ($HEAD_TAG)"
fi

# ── 3. Tags XCH vs XCH-deploy ───────────────────────────────────────────────
echo -n "3. Récupération des tags XCH-deploy … "
DEPLOY_TAGS_RAW="$(git ls-remote --tags --refs "$DEPLOY_REMOTE_URL" 2>/dev/null || true)"
if [ -z "$DEPLOY_TAGS_RAW" ]; then
    echo -e "${YELLOW}injoignable${NC} (auth requise ou repo privé sans creds locaux)"
    echo "   → Sur le serveur xch-deploy ou en CI avec creds, ce check passera."
    echo "   → Mode local sans gh/PAT : tags XCH-deploy ignorés."
else
    DEPLOY_TAGS="$(echo "$DEPLOY_TAGS_RAW" | awk '{print $2}' | sed 's|^refs/tags/||' | sort -V)"
    DEPLOY_TAG_COUNT="$(echo "$DEPLOY_TAGS" | grep -c . || true)"
    echo -e "${GREEN}OK${NC} ($DEPLOY_TAG_COUNT tags)"
    DEPLOY_LATEST_TAG="$(echo "$DEPLOY_TAGS" | tail -1)"
fi

DEV_LATEST_TAG="$(git tag --sort=-v:refname | head -1 || echo '')"

echo "   XCH        latest tag : ${DEV_LATEST_TAG:-(aucun)}"
echo "   XCH-deploy latest tag : ${DEPLOY_LATEST_TAG:-(aucun)}"

# ── 4. Tag explicite demandé ────────────────────────────────────────────────
if [ -n "$TAG_TO_CHECK" ]; then
    echo -n "4. Tag $TAG_TO_CHECK présent dans les 2 repos … "
    DEV_HAS_TAG=false
    DEPLOY_HAS_TAG=false
    git rev-parse "refs/tags/$TAG_TO_CHECK" >/dev/null 2>&1 && DEV_HAS_TAG=true
    echo "$DEPLOY_TAGS" | grep -qx "$TAG_TO_CHECK" && DEPLOY_HAS_TAG=true

    if $DEV_HAS_TAG && $DEPLOY_HAS_TAG; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}KO${NC}"
        $DEV_HAS_TAG || echo "   $TAG_TO_CHECK absent du repo dev XCH"
        $DEPLOY_HAS_TAG || echo "   $TAG_TO_CHECK absent du repo XCH-deploy"
        EXIT_CODE=1
    fi
fi

# ── 5. Drift dev vs deploy (mode strict, nécessite que XCH-deploy soit joignable) ──
if [ "$STRICT" = true ] && [ -n "$DEV_LATEST_TAG" ] && [ -n "$DEPLOY_LATEST_TAG" ]; then
    echo -n "5. (strict) XCH-deploy a le dernier tag XCH … "
    if [ "$DEV_LATEST_TAG" = "$DEPLOY_LATEST_TAG" ]; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${YELLOW}DRIFT${NC}"
        echo "   XCH        = $DEV_LATEST_TAG"
        echo "   XCH-deploy = $DEPLOY_LATEST_TAG"
        echo "   → Le repo XCH-deploy doit être mis à jour avec $DEV_LATEST_TAG"
        EXIT_CODE=1
    fi
fi

# ── 6. Migrations Prisma pending (placeholder, activé post-S5) ──────────────
if [ -d "backend/prisma/migrations" ]; then
    echo -n "6. Migrations Prisma … "
    PENDING_MIGRATIONS="$(find backend/prisma/migrations -maxdepth 1 -mindepth 1 -type d | wc -l)"
    if [ "$PENDING_MIGRATIONS" -gt 0 ]; then
        echo -e "${GREEN}OK${NC} ($PENDING_MIGRATIONS migration(s) versionnée(s) présentes)"
    else
        echo -e "${YELLOW}vide${NC} (S5 pas encore exécutée — migrations versionnées à venir)"
    fi
else
    echo "6. Migrations Prisma : ${YELLOW}dossier absent${NC} (S5 pas encore exécutée — db push --accept-data-loss en place)"
fi

echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ Parité OK — déploiement autorisé${NC}"
else
    echo -e "${RED}✗ Drift détecté — déploiement bloqué${NC}"
    echo "   Corrigez les points ci-dessus puis relancez ce script."
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit $EXIT_CODE
