#!/bin/bash
# =============================================================================
# XCH — Deploy Production (local)
# Runs locally on the production server where the repo is cloned.
#
# Usage: bash scripts/deploy-prod.sh [--backend-only | --frontend-only]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  XCH — Deploy Production (local)"
echo "  $(date)"
echo "========================================="
echo ""

# Parse arguments
BUILD_BACKEND=true
BUILD_FRONTEND=true

if [ "${1:-}" = "--backend-only" ]; then
  BUILD_FRONTEND=false
  echo -e "${YELLOW}Mode: backend uniquement${NC}"
elif [ "${1:-}" = "--frontend-only" ]; then
  BUILD_BACKEND=false
  echo -e "${YELLOW}Mode: frontend uniquement${NC}"
fi

cd "$PROJECT_DIR"

# ── Step 1: Pull latest code ────────────────────────────────────────────────
echo ""
echo "[1/5] Pull derniers commits..."
git pull origin main || git pull origin master || echo -e "${YELLOW}Pas de remote configure — skip git pull${NC}"
echo ""
git log --oneline -3

# ── Step 2: Build images ────────────────────────────────────────────────────
echo ""
echo "[2/5] Build des images Docker (--no-cache)..."

SERVICES=""
if [ "$BUILD_BACKEND" = true ]; then
  SERVICES="$SERVICES backend"
fi
if [ "$BUILD_FRONTEND" = true ]; then
  SERVICES="$SERVICES frontend"
fi

docker compose -f "$COMPOSE_FILE" build --no-cache $SERVICES

# ── Step 3: Restart services ────────────────────────────────────────────────
echo ""
echo "[3/5] Redemarrage des services..."
docker compose -f "$COMPOSE_FILE" up -d $SERVICES

# ── Step 4: Wait and health check ───────────────────────────────────────────
echo ""
echo "[4/5] Attente demarrage (30s)..."
sleep 30

# Check backend health
if [ "$BUILD_BACKEND" = true ]; then
  echo "  Verification backend..."
  if docker compose -f "$COMPOSE_FILE" exec -T backend wget -qO- http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}Backend: OK${NC}"
  else
    echo -e "  ${YELLOW}Backend: pas encore pret (verifier les logs)${NC}"
  fi
fi

# Check frontend
if [ "$BUILD_FRONTEND" = true ]; then
  echo "  Verification frontend..."
  if docker compose -f "$COMPOSE_FILE" exec -T frontend wget -qO- http://localhost:3001 > /dev/null 2>&1; then
    echo -e "  ${GREEN}Frontend: OK${NC}"
  else
    echo -e "  ${YELLOW}Frontend: pas encore pret (verifier les logs)${NC}"
  fi
fi

# ── Step 5: Restart Nginx Proxy Manager (DNS cache) ────────────────────────
echo ""
echo "[5/5] Redemarrage Nginx Proxy Manager (cache DNS)..."
# NPM caches container IPs — must restart after rebuild
NPM_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i "nginx-proxy-manager" | head -1) || true
if [ -n "$NPM_CONTAINER" ]; then
  docker restart "$NPM_CONTAINER"
  echo -e "  ${GREEN}NPM redemarre: $NPM_CONTAINER${NC}"
else
  echo -e "  ${YELLOW}NPM non trouve — skip (si proxy externe, redemarrez-le manuellement)${NC}"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
echo -e "  ${GREEN}Deploiement termine !${NC}"
echo "========================================="
echo ""
echo "  Statut des conteneurs:"
docker compose -f "$COMPOSE_FILE" ps
echo ""
echo "  Commandes utiles:"
echo "    Logs backend  : docker compose -f $COMPOSE_FILE logs -f backend"
echo "    Logs frontend : docker compose -f $COMPOSE_FILE logs -f frontend"
echo "    Restart tout  : docker compose -f $COMPOSE_FILE restart"
echo ""
