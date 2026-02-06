#!/bin/bash
##############################################################################
# XCH - Script de déploiement rapide
#
# Usage:
#   ./deploy.sh              # Déploiement complet (pull + build + restart)
#   ./deploy.sh --quick      # Quick deploy (pull + restart sans rebuild)
#   ./deploy.sh --frontend   # Rebuild frontend seulement
#   ./deploy.sh --backend    # Rebuild backend seulement
#   ./deploy.sh --all        # Rebuild tout (frontend + backend)
#   ./deploy.sh --status     # Afficher l'état des conteneurs
#   ./deploy.sh --logs       # Afficher les logs en temps réel
#   ./deploy.sh --backup     # Backup DB seulement
##############################################################################

set -e

# Couleurs
G='\033[0;32m'  # Green
R='\033[0;31m'  # Red
Y='\033[1;33m'  # Yellow
B='\033[0;34m'  # Blue
N='\033[0m'     # No color

# Config
PROJECT_DIR="/opt/xch-dev/XCH"
BACKUP_DIR="/opt/xch-backups"

cd "$PROJECT_DIR" || { echo -e "${R}Erreur: $PROJECT_DIR introuvable${N}"; exit 1; }

# Fonctions
info()  { echo -e "${B}[INFO]${N} $1"; }
ok()    { echo -e "${G}[OK]${N} $1"; }
warn()  { echo -e "${Y}[WARN]${N} $1"; }
fail()  { echo -e "${R}[ERREUR]${N} $1"; exit 1; }

backup_db() {
  mkdir -p "$BACKUP_DIR"
  local FILE="$BACKUP_DIR/xch_$(date +%Y%m%d_%H%M%S).sql"
  docker exec xch-postgres pg_dump -U xch_user -d xch_dev > "$FILE" 2>/dev/null
  ok "Backup DB: $FILE ($(du -h "$FILE" | cut -f1))"
  # Garder les 10 derniers backups
  ls -t "$BACKUP_DIR"/xch_*.sql 2>/dev/null | tail -n +11 | xargs -r rm
}

pull_code() {
  info "Git pull..."
  local BEFORE=$(git rev-parse --short HEAD)
  git pull origin main --quiet
  local AFTER=$(git rev-parse --short HEAD)
  if [ "$BEFORE" = "$AFTER" ]; then
    warn "Pas de nouveau code ($BEFORE)"
  else
    ok "Code mis à jour: $BEFORE → $AFTER"
    git log --oneline "$BEFORE".."$AFTER" | head -5
  fi
}

build_frontend() {
  info "Build frontend (--no-cache)..."
  docker compose build --no-cache frontend 2>&1 | tail -3
  ok "Frontend build terminé"
}

build_backend() {
  info "Build backend (--no-cache)..."
  docker compose build --no-cache backend 2>&1 | tail -3
  ok "Backend build terminé"
}

restart_all() {
  info "Redémarrage conteneurs..."
  docker compose up -d
  ok "Conteneurs redémarrés"
}

restart_service() {
  info "Redémarrage $1..."
  docker compose up -d "$1"
  ok "$1 redémarré"
}

health_check() {
  info "Vérification santé..."
  local MAX=15

  # Backend
  for i in $(seq 1 $MAX); do
    if curl -sf http://localhost:3002/api 2>/dev/null | head -c1 | grep -q '{'; then
      ok "Backend OK (port 3002)"
      break
    fi
    [ "$i" -eq "$MAX" ] && warn "Backend ne répond pas encore"
    sleep 2
  done

  # Frontend
  for i in $(seq 1 $MAX); do
    if curl -sf http://localhost:3001 > /dev/null 2>&1; then
      ok "Frontend OK (port 3001)"
      break
    fi
    [ "$i" -eq "$MAX" ] && warn "Frontend ne répond pas encore"
    sleep 2
  done

  # DB
  docker exec xch-postgres pg_isready -U xch_user -d xch_dev > /dev/null 2>&1 && ok "PostgreSQL OK" || warn "PostgreSQL KO"
  docker exec xch-redis redis-cli ping > /dev/null 2>&1 && ok "Redis OK" || warn "Redis KO"
}

show_status() {
  echo ""
  docker compose ps
  echo ""
  info "Git: $(git log --oneline -1)"
  echo ""
}

# Commande principale
case "${1:-}" in
  --quick)
    echo -e "\n${G}═══ XCH Quick Deploy ═══${N}\n"
    pull_code
    restart_all
    health_check
    ;;
  --frontend)
    echo -e "\n${G}═══ XCH Frontend Deploy ═══${N}\n"
    pull_code
    build_frontend
    restart_service frontend
    health_check
    ;;
  --backend)
    echo -e "\n${G}═══ XCH Backend Deploy ═══${N}\n"
    pull_code
    build_backend
    restart_service backend
    health_check
    ;;
  --all)
    echo -e "\n${G}═══ XCH Full Rebuild ═══${N}\n"
    backup_db
    pull_code
    build_backend
    build_frontend
    restart_all
    health_check
    ;;
  --status)
    show_status
    ;;
  --logs)
    docker compose logs -f --tail=50
    ;;
  --backup)
    backup_db
    ;;
  --help|-h)
    echo "Usage: ./deploy.sh [option]"
    echo ""
    echo "  (sans option)   Déploiement standard (pull + build frontend + restart)"
    echo "  --quick         Pull + restart (sans rebuild)"
    echo "  --frontend      Rebuild frontend seulement"
    echo "  --backend       Rebuild backend seulement"
    echo "  --all           Rebuild complet (backup + backend + frontend)"
    echo "  --status        Afficher l'état"
    echo "  --logs          Logs en temps réel"
    echo "  --backup        Backup base de données"
    echo "  --help          Afficher cette aide"
    ;;
  *)
    # Déploiement standard : pull + build frontend + restart
    echo -e "\n${G}═══ XCH Deploy ═══${N}\n"
    pull_code
    build_frontend
    restart_all
    health_check
    echo -e "\n${G}═══ Déploiement terminé ═══${N}\n"
    show_status
    ;;
esac
