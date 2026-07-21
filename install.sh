#!/bin/bash
set -e

# ============================================================
# XCH — Script d'installation automatique (v2 — 2026-07)
# ============================================================
# Usage:
#   chmod +x install.sh
#   ./install.sh
#
# Ce script :
#   1. Verifie les prerequis (Docker, Docker Compose)
#   2. Genere (ou reutilise) des secrets cryptographiques uniques
#   3. Demande l'adresse publique du serveur (IP ou domaine)
#      -> configure CORS / cookies / URLs frontend correctement
#   4. Cree les fichiers .env (root + backend + frontend)
#   5. (Optionnel) Deploie la stack GlitchTip (observabilite erreurs)
#      et injecte automatiquement les DSN dans backend + frontend
#   6. Build et lance tous les services Docker
#   7. Attend que le backend soit pret et affiche l'URL du Setup Wizard
#
# Nouveautes v2 (vs script initial) :
#   - FRONTEND_URL / TRUST_PROXY_CORS poses -> plus d'erreur CORS sur
#     http://<ip>/setup (le navigateur envoie l'en-tete Origin meme en
#     same-origin sur les POST ; le backend doit connaitre l'origine).
#   - NEXT_PUBLIC_APP_URL bake au build du frontend.
#   - Deploiement GlitchTip integre (docker-compose.glitchtip.yml) avec
#     generation des secrets + DSN automatiques (non air-gap).
#   - Re-execution sure : reutilise les secrets existants (sinon la
#     nouvelle POSTGRES_PASSWORD ne matcherait pas le volume existant).
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ===== Couleurs =====
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

# Upsert KEY=VALUE dans un fichier env (remplace si present, ajoute sinon)
set_env_var() {
    local file="$1" key="$2" value="$3"
    if grep -qE "^${key}=" "$file" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Lit KEY= depuis un fichier env (sans guillemets)
get_env_var() {
    grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'
}

# ============================================================
# 1. Verifier les prerequis
# ============================================================
echo ""
echo -e "${BOLD}=========================================${NC}"
echo -e "${BOLD}   XCH — Installation automatique (v2)${NC}"
echo -e "${BOLD}=========================================${NC}"
echo ""

if ! command -v docker >/dev/null 2>&1; then
    fail "Docker n'est pas installe. Installez Docker : https://docs.docker.com/get-docker/"
fi
ok "Docker detecte ($(docker --version | head -1))"

if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose n'est pas installe. Installez Docker Compose v2."
fi
ok "Docker Compose detecte ($(docker compose version --short))"

if ! command -v curl >/dev/null 2>&1; then
    warn "curl n'est pas installe — les health checks seront ignores"
    HAS_CURL=false
else
    HAS_CURL=true
fi

if ! command -v openssl >/dev/null 2>&1; then
    fail "openssl n'est pas installe. Installez-le : apt install openssl"
fi

# ============================================================
# 2. Secrets : reutiliser si deja installes, sinon generer
# ============================================================
echo ""
REUSE_SECRETS=false
if [ -f ".env" ] && [ -f "backend/.env" ]; then
    warn "Une installation existante a ete detectee (.env presents)."
    echo ""
    echo "  1) Reconfigurer   — garde les secrets et les donnees existantes,"
    echo "                      regenere uniquement la configuration (URLs, CORS...)"
    echo "  2) Reinstaller    — regenere les secrets ET SUPPRIME les donnees"
    echo "                      (docker compose down -v : base, fichiers, tout)"
    echo "  3) Annuler"
    echo ""
    read -p "Choix [1/2/3] (defaut: 1): " REINSTALL_MODE
    REINSTALL_MODE=${REINSTALL_MODE:-1}
    case "$REINSTALL_MODE" in
        1) REUSE_SECRETS=true ;;
        2)
            echo ""
            warn "TOUTES LES DONNEES XCH VONT ETRE SUPPRIMEES (volumes Docker) !"
            read -p "Confirmer la suppression ? Tapez 'SUPPRIMER' : " CONFIRM_WIPE
            [ "$CONFIRM_WIPE" = "SUPPRIMER" ] || { info "Installation annulee."; exit 0; }
            docker compose down -v --remove-orphans 2>/dev/null || true
            ;;
        *) info "Installation annulee."; exit 0 ;;
    esac
fi

info "Preparation des secrets cryptographiques..."
if [ "$REUSE_SECRETS" = true ]; then
    POSTGRES_PASSWORD=$(get_env_var .env POSTGRES_PASSWORD)
    MINIO_SECRET_KEY=$(get_env_var .env MINIO_SECRET_KEY)
    JWT_SECRET=$(get_env_var backend/.env JWT_SECRET)
    COOKIE_SECRET=$(get_env_var backend/.env COOKIE_SECRET)
    COOKIE_SECRET=${COOKIE_SECRET:-$(openssl rand -hex 16)}
    if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$MINIO_SECRET_KEY" ] || [ -z "$JWT_SECRET" ]; then
        fail "Impossible de relire les secrets existants (.env corrompu ?). Choisissez 'Reinstaller'."
    fi
    ok "Secrets existants reutilises (donnees preservees)"
else
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    MINIO_SECRET_KEY=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -hex 32)
    COOKIE_SECRET=$(openssl rand -hex 16)
    ok "Secrets generes (JWT: ${#JWT_SECRET} chars, DB: ${#POSTGRES_PASSWORD} chars)"
fi

# ============================================================
# 3. Adresse publique du serveur (IP ou domaine)
# ============================================================
echo ""
DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
echo -e "${BOLD}Adresse publique du serveur :${NC}"
echo "  C'est l'adresse que les utilisateurs tapent dans leur navigateur."
echo "  IP (ex: 192.168.1.50) ou domaine (ex: xch.mondomaine.fr)."
echo ""
read -p "Adresse [detectee: ${DETECTED_IP:-aucune}]: " SERVER_ADDR
SERVER_ADDR=${SERVER_ADDR:-$DETECTED_IP}
[ -n "$SERVER_ADDR" ] || fail "Adresse serveur requise (IP ou domaine)."
ok "Adresse retenue : ${SERVER_ADDR}"

# ============================================================
# 4. Choix du mode de deploiement
# ============================================================
echo ""
echo -e "${BOLD}Mode de deploiement :${NC}"
echo ""
echo "  1) Nginx integre  — XCH gere tout (reverse proxy inclus)  [recommande]"
echo "  2) Nginx externe  — Vous avez deja un reverse proxy (NPM, Traefik...)"
echo "  3) Developpement  — Tous les ports exposes pour debug"
echo ""
read -p "Choix [1/2/3] (defaut: 1): " MODE
MODE=${MODE:-1}

# TRUST_PROXY_CORS : en mode nginx integre, nginx est le point d'entree
# unique -> le backend peut faire confiance au proxy pour le controle
# d'acces (l'origine est de toute facon la meme). Evite tout rejet CORS
# si le serveur est accede via une autre adresse (IP + domaine).
TRUST_PROXY_CORS=false
MINIO_PUBLIC_URL=""

if [ "$MODE" = "3" ]; then
    # ---- MODE DEV ----
    COMPOSE_CMD="docker compose"
    BACKEND_PORT=3002
    FRONTEND_PORT=3001
    BACKEND_URL="http://localhost:${BACKEND_PORT}/api"
    PUBLIC_URL="http://${SERVER_ADDR}:${FRONTEND_PORT}"
    NEXT_PUBLIC_API_URL="http://${SERVER_ADDR}:${BACKEND_PORT}"
    MINIO_PUBLIC_URL="http://${SERVER_ADDR}:9000"
    NODE_ENV="development"
    info "Mode developpement selectionne"

elif [ "$MODE" = "2" ]; then
    # ---- MODE NGINX EXTERNE ----
    echo ""
    info "Votre reverse proxy externe doit rediriger vers ces ports :"
    read -p "  Port backend  (defaut: 3002): " CUSTOM_BACKEND_PORT
    CUSTOM_BACKEND_PORT=${CUSTOM_BACKEND_PORT:-3002}
    read -p "  Port frontend (defaut: 3001): " CUSTOM_FRONTEND_PORT
    CUSTOM_FRONTEND_PORT=${CUSTOM_FRONTEND_PORT:-3001}
    echo ""
    echo "  URL publique servie par votre proxy (ce que tape l'utilisateur)."
    read -p "  URL publique (defaut: http://${SERVER_ADDR}): " PUBLIC_URL
    PUBLIC_URL=${PUBLIC_URL:-http://${SERVER_ADDR}}
    PUBLIC_URL=${PUBLIC_URL%/}

    COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.external.yml"
    BACKEND_PORT=${CUSTOM_BACKEND_PORT}
    FRONTEND_PORT=${CUSTOM_FRONTEND_PORT}
    BACKEND_URL="http://localhost:${BACKEND_PORT}/api"
    NEXT_PUBLIC_API_URL=""
    NODE_ENV="production"

    cat > docker-compose.external.yml << EXTEOF
# Generated by install.sh — Expose backend + frontend for external reverse proxy
services:
  backend:
    ports:
      - "${CUSTOM_BACKEND_PORT}:3000"

  frontend:
    ports:
      - "${CUSTOM_FRONTEND_PORT}:3001"
EXTEOF
    ok "docker-compose.external.yml genere (backend:${CUSTOM_BACKEND_PORT}, frontend:${CUSTOM_FRONTEND_PORT})"
    echo ""
    info "Configurez votre reverse proxy externe :"
    echo "    ${PUBLIC_URL}/         -> http://127.0.0.1:${CUSTOM_FRONTEND_PORT}"
    echo "    ${PUBLIC_URL}/api/     -> http://127.0.0.1:${CUSTOM_BACKEND_PORT}"
    echo "    ${PUBLIC_URL}/storage/ -> http://127.0.0.1:9000 (MinIO)"
    warn "IMPORTANT : accedez a XCH UNIQUEMENT via ${PUBLIC_URL}"
    warn "(l'acces direct :${CUSTOM_FRONTEND_PORT} ne route pas /api -> page setup cassee)"

else
    # ---- MODE NGINX INTEGRE ----
    echo ""
    read -p "  Port HTTP  (defaut: 80): " CUSTOM_HTTP_PORT
    CUSTOM_HTTP_PORT=${CUSTOM_HTTP_PORT:-80}
    read -p "  Port HTTPS (defaut: 443): " CUSTOM_HTTPS_PORT
    CUSTOM_HTTPS_PORT=${CUSTOM_HTTPS_PORT:-443}

    COMPOSE_CMD="docker compose -f docker-compose.yml --profile proxy"
    NODE_ENV="production"
    TRUST_PROXY_CORS=true
    NEXT_PUBLIC_API_URL=""

    if [ "$CUSTOM_HTTP_PORT" = "80" ]; then
        PUBLIC_URL="http://${SERVER_ADDR}"
        BACKEND_URL="http://localhost/api"
    else
        PUBLIC_URL="http://${SERVER_ADDR}:${CUSTOM_HTTP_PORT}"
        BACKEND_URL="http://localhost:${CUSTOM_HTTP_PORT}/api"
    fi
    info "Nginx integre selectionne (HTTP:${CUSTOM_HTTP_PORT}, HTTPS:${CUSTOM_HTTPS_PORT})"
fi

ok "URL publique de l'application : ${PUBLIC_URL}"

# ============================================================
# 5. GlitchTip (observabilite erreurs — optionnel, non air-gap)
# ============================================================
echo ""
DEPLOY_GLITCHTIP=false
GT_PORT=8000
if [ "$MODE" = "3" ]; then GT_DEFAULT="n"; else GT_DEFAULT="y"; fi
echo -e "${BOLD}GlitchTip (suivi des erreurs backend + frontend) :${NC}"
echo "  Stack self-hosted independante (4 conteneurs supplementaires)."
read -p "Deployer GlitchTip ? [y/n] (defaut: ${GT_DEFAULT}): " GT_ANSWER
GT_ANSWER=${GT_ANSWER:-$GT_DEFAULT}
if [ "$GT_ANSWER" = "y" ] || [ "$GT_ANSWER" = "Y" ]; then
    DEPLOY_GLITCHTIP=true
    if ! command -v python3 >/dev/null 2>&1; then
        warn "python3 requis pour generer les DSN GlitchTip (apt install python3)"
        warn "GlitchTip sera deploye mais les DSN devront etre generes manuellement :"
        warn "  bash glitchtip/scripts/gen-dsn.sh"
        HAS_PYTHON3=false
    else
        HAS_PYTHON3=true
    fi
    read -p "  Port UI GlitchTip (defaut: 8000): " GT_PORT_IN
    GT_PORT=${GT_PORT_IN:-8000}
    GT_PUBLIC_URL="http://${SERVER_ADDR}:${GT_PORT}"
    ok "GlitchTip sera accessible sur ${GT_PUBLIC_URL}"
fi

# ============================================================
# 6. Creer les fichiers .env
# ============================================================
echo ""
info "Creation des fichiers de configuration..."

RELEASE_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v2.4.0")

# Nom de projet compose : si une stack XCH existe deja (installation v1 sans
# COMPOSE_PROJECT_NAME), on conserve son nom de projet pour pointer vers les
# MEMES volumes (sinon "Reconfigurer" repartirait sur une base vide).
EXISTING_PROJECT=$(docker inspect xch-postgres --format '{{ index .Config.Labels "com.docker.compose.project" }}' 2>/dev/null || echo "")
COMPOSE_PROJECT=${EXISTING_PROJECT:-xch}
[ "$COMPOSE_PROJECT" = "xch" ] || info "Projet compose existant conserve : ${COMPOSE_PROJECT}"

# --- Root .env (lu par docker compose : interpolation + build args) ---
cat > .env << ENVEOF
# XCH — Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# DO NOT commit this file to git

# Nom de projet compose fixe -> reseau previsible (xch_xch-network par defaut)
# (necessaire pour raccorder la stack GlitchTip au reseau XCH)
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT}

# ===== DATABASE =====
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=xch_dev
POSTGRES_PORT=5433

# ===== REDIS =====
REDIS_PORT=6380

# ===== MINIO =====
MINIO_ACCESS_KEY=xch_minio_admin
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# ===== NGINX =====
HTTP_PORT=${CUSTOM_HTTP_PORT:-80}
HTTPS_PORT=${CUSTOM_HTTPS_PORT:-443}

# ===== EXPOSED PORTS (for external proxy / dev mode) =====
BACKEND_PORT=${BACKEND_PORT:-3002}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# ===== FRONTEND (build args — bakes dans les bundles Next.js) =====
# Vide = URLs relatives (same-origin via nginx). Ne mettre une URL absolue
# que si le backend est sur une AUTRE origine (mode dev).
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_APP_URL=${PUBLIC_URL}

# ===== FRONTEND (runtime SSR — memes valeurs) =====
FRONTEND_API_URL=${NEXT_PUBLIC_API_URL}
FRONTEND_APP_URL=${PUBLIC_URL}

# ===== GLITCHTIP (frontend DSN — injecte apres bootstrap GlitchTip) =====
NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND=
NEXT_PUBLIC_GLITCHTIP_ENVIRONMENT=production
NEXT_PUBLIC_GLITCHTIP_RELEASE=${RELEASE_TAG}
ENVEOF

# --- Backend .env ---
cat > backend/.env << ENVEOF
# XCH Backend — Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# DO NOT commit this file to git

# ===== DATABASE =====
DATABASE_URL="postgresql://xch_user:${POSTGRES_PASSWORD}@postgres:5432/xch_dev"

# ===== APP =====
NODE_ENV=${NODE_ENV}
PORT=3000

# ===== FRONTEND / CORS =====
# URL publique de l'application — DOIT matcher l'origine du navigateur,
# sinon les POST (setup wizard, login...) sont rejetes par le CORS.
FRONTEND_URL=${PUBLIC_URL}
# En mode nginx integre, le proxy est le seul point d'entree : on lui fait
# confiance pour le controle d'acces (tolere IP + domaine simultanement).
TRUST_PROXY_CORS=${TRUST_PROXY_CORS}

# ===== COOKIES =====
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SECRET="${COOKIE_SECRET}"

# ===== JWT =====
JWT_SECRET="${JWT_SECRET}"
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# ===== REDIS =====
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# ===== MINIO =====
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=xch_minio_admin
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=xch-storage
MINIO_USE_SSL=false
MINIO_PUBLIC_URL=${MINIO_PUBLIC_URL}

# ===== STORAGE =====
STORAGE_TYPE=minio
UPLOAD_DIR=./uploads

# ===== GLITCHTIP (injecte apres bootstrap GlitchTip si active) =====
GLITCHTIP_DSN_BACKEND=
GLITCHTIP_ENVIRONMENT=production
GLITCHTIP_RELEASE=${RELEASE_TAG}
ENVEOF

# --- Frontend .env.local (reference / dev hors Docker uniquement) ---
cat > frontend/.env.local << ENVEOF
# XCH Frontend — Generated by install.sh on $(date -u +"%Y-%m-%d %H:%M UTC")
# NB: en Docker, les NEXT_PUBLIC_* viennent du .env RACINE (build args).
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_APP_URL=${PUBLIC_URL}
NODE_ENV=${NODE_ENV}
ENVEOF

ok "Fichiers .env crees"
echo "     .env  |  backend/.env  |  frontend/.env.local"

# ============================================================
# 7. Demarrage infrastructure (cree le reseau xch_xch-network)
# ============================================================
echo ""
info "Demarrage de l'infrastructure (PostgreSQL, Redis, MinIO)..."
$COMPOSE_CMD up -d postgres redis minio minio-init

# Nom reel du reseau XCH (normalement ${COMPOSE_PROJECT}_xch-network)
XCH_NET=$(docker network ls --format '{{.Name}}' | grep -x "${COMPOSE_PROJECT}_xch-network" | head -1)
if [ -z "$XCH_NET" ]; then
    XCH_NET=$(docker network ls --format '{{.Name}}' | grep 'xch-network' | head -1)
fi
[ -n "$XCH_NET" ] || fail "Reseau xch-network introuvable apres demarrage infra"
ok "Reseau Docker : ${XCH_NET}"

# ============================================================
# 8. GlitchTip : bootstrap + DSN (avant build frontend, car le DSN
#    frontend est bake dans les bundles Next.js au build)
# ============================================================
if [ "$DEPLOY_GLITCHTIP" = true ]; then
    echo ""
    info "Deploiement de la stack GlitchTip..."

    # 8a. Secrets GlitchTip (reutilises si deja presents)
    if [ ! -f "glitchtip/.env" ]; then
        bash glitchtip/scripts/gen-secrets.sh
    else
        ok "glitchtip/.env existant conserve (secrets preserves)"
    fi
    set_env_var glitchtip/.env XCH_NETWORK_NAME "${XCH_NET}"
    set_env_var glitchtip/.env GLITCHTIP_DOMAIN "http://${SERVER_ADDR}:${GT_PORT}"

    # 8b. Exposition du port UI (le compose de base n'expose rien — air-gap)
    cat > docker-compose.glitchtip.override.yml << GTEOF
# Generated by install.sh — expose l'UI GlitchTip (deploiement non air-gap)
services:
  glitchtip-web:
    ports:
      - "${GT_PORT}:8000"
GTEOF

    GT_COMPOSE="docker compose -p glitchtip -f docker-compose.glitchtip.yml -f docker-compose.glitchtip.override.yml --env-file glitchtip/.env"
    $GT_COMPOSE up -d

    # 8c. Attendre migrations + seed admin (container one-shot, restart: no)
    info "Attente des migrations GlitchTip (1-3 min au premier demarrage)..."
    SEED_EXIT=$(timeout 300 docker wait glitchtip-admin-seed 2>/dev/null || echo "timeout")
    if [ "$SEED_EXIT" != "0" ]; then
        warn "Seed GlitchTip non termine proprement (exit: ${SEED_EXIT})"
        warn "Logs : docker logs glitchtip-admin-seed"
    else
        ok "Migrations + super-admin GlitchTip OK"
    fi

    if [ "$HAS_CURL" = true ]; then
        WAITED=0
        while [ $WAITED -lt 120 ]; do
            GT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${GT_PORT}/_health/" 2>/dev/null || echo "000")
            [ "$GT_STATUS" = "200" ] && break
            sleep 5; WAITED=$((WAITED + 5))
        done
        [ "$GT_STATUS" = "200" ] && ok "GlitchTip web repond (health 200)" \
                                 || warn "GlitchTip web ne repond pas encore (continuons)"
    fi

    # 8d. Creer org + projets + recuperer les DSN, puis injecter dans les .env
    if [ "${HAS_PYTHON3:-false}" = true ]; then
        info "Generation des DSN GlitchTip (org xch + 3 projets)..."
        if DSN_JSON=$(bash glitchtip/scripts/gen-dsn.sh --json --public-host "${GT_PUBLIC_URL}" 2>/dev/null); then
            GT_DSN_BACKEND=$(echo "$DSN_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['dsns']['xch-backend']['dsn'])" 2>/dev/null || echo "")
            GT_DSN_FRONTEND=$(echo "$DSN_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['dsns']['xch-frontend']['dsn'])" 2>/dev/null || echo "")

            if [ -n "$GT_DSN_BACKEND" ] && [ -n "$GT_DSN_FRONTEND" ]; then
                set_env_var backend/.env GLITCHTIP_DSN_BACKEND "${GT_DSN_BACKEND}"
                set_env_var .env NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND "${GT_DSN_FRONTEND}"
                ok "DSN injectes (backend/.env + .env racine pour le build frontend)"
            else
                warn "DSN non extraits du JSON — a faire manuellement : bash glitchtip/scripts/gen-dsn.sh"
            fi
        else
            warn "gen-dsn.sh a echoue — a relancer manuellement : bash glitchtip/scripts/gen-dsn.sh"
        fi
    fi
fi

# ============================================================
# 9. Build et lancement des services XCH
# ============================================================
echo ""
info "Construction des images Docker (3-5 min au premier build)..."
echo ""

$COMPOSE_CMD build 2>&1 | while IFS= read -r line; do
    if echo "$line" | grep -qE "(DONE|ERROR|naming to)"; then
        echo "  $line"
    fi
done

ok "Images Docker construites"

echo ""
info "Demarrage des services..."
$COMPOSE_CMD up -d

sleep 3
RUNNING=$(docker ps --filter "name=xch-" --format '{{.Names}}' 2>/dev/null | wc -l)
ok "${RUNNING} conteneurs XCH en cours d'execution"

# ============================================================
# 10. Attente du backend
# ============================================================
if [ "$HAS_CURL" = true ]; then
    echo ""
    info "Attente du demarrage du backend (migrations + initialisation)..."

    MAX_WAIT=180
    WAITED=0
    while [ $WAITED -lt $MAX_WAIT ]; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/setup/status" 2>/dev/null || echo "000")
        if [ "$STATUS" = "200" ]; then
            echo ""
            ok "Backend demarre et pret !"
            break
        fi
        sleep 5
        WAITED=$((WAITED + 5))
        echo -ne "\r  Attente... ${WAITED}s"
    done

    if [ $WAITED -ge $MAX_WAIT ]; then
        echo ""
        warn "Le backend n'a pas repondu dans les ${MAX_WAIT}s"
        warn "Verifiez les logs : docker compose logs backend"
    fi
else
    info "Attendez ~30s que le backend demarre (migrations en cours)..."
    sleep 30
fi

# ============================================================
# 11. Informations de connexion
# ============================================================
echo ""
echo -e "${BOLD}=========================================${NC}"
echo -e "${GREEN}${BOLD}   XCH installe avec succes !${NC}"
echo -e "${BOLD}=========================================${NC}"
echo ""
echo -e "  ${BOLD}Ouvrez votre navigateur :${NC}"
echo ""
echo -e "    ${BLUE}${PUBLIC_URL}/setup${NC}"
echo ""
if [ "$MODE" = "3" ]; then
    echo "  Acces direct aux services :"
    echo "    Frontend   : http://${SERVER_ADDR}:3001"
    echo "    Backend    : http://${SERVER_ADDR}:3002/api/docs"
    echo "    MinIO      : http://${SERVER_ADDR}:9001"
    echo "    PostgreSQL : port 5433 (user: xch_user)"
    echo "    Redis      : port 6380"
elif [ "$MODE" = "2" ]; then
    warn "Accedez a XCH UNIQUEMENT via votre reverse proxy (${PUBLIC_URL})"
    echo "    Ports internes : frontend :${FRONTEND_PORT}, backend :${BACKEND_PORT}"
fi
if [ "$DEPLOY_GLITCHTIP" = true ]; then
    echo ""
    echo -e "  ${BOLD}GlitchTip (suivi des erreurs) :${NC}"
    echo "    UI       : http://${SERVER_ADDR}:${GT_PORT}"
    echo "    Login    : $(get_env_var glitchtip/.env GLITCHTIP_ADMIN_EMAIL)"
    echo "    Password : dans glitchtip/.env (GLITCHTIP_ADMIN_PASSWORD)"
fi
echo ""
echo -e "  ${BOLD}Le Setup Wizard va vous guider pour :${NC}"
echo "    - Nommer votre organisation"
echo "    - Creer votre compte administrateur"
echo "    - Charger les donnees de demonstration (optionnel)"
echo ""
echo -e "  ${BOLD}Commandes utiles :${NC}"
echo "    Logs            : docker compose logs -f backend"
echo "    Arreter         : docker compose down"
echo "    Redemarrer      : docker compose restart"
echo "    Status          : docker compose ps"
if [ "$DEPLOY_GLITCHTIP" = true ]; then
    echo "    GlitchTip logs  : docker compose -p glitchtip -f docker-compose.glitchtip.yml logs -f"
fi
echo ""
echo -e "${BOLD}=========================================${NC}"
echo ""
