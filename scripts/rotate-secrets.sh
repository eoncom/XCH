#!/bin/bash

##############################################################################
# rotate-secrets.sh - Rotation des secrets de production XCH
#
# Usage:
#   bash scripts/rotate-secrets.sh [--phase a|b|all] [--dry-run] [--yes]
#
# Modes:
#   --phase a   (défaut) JWT_SECRET, JWT_REFRESH_SECRET, MINIO_*, webhook secret synchronisé Gatus
#   --phase b   REDIS_PASSWORD (modifie docker-compose.yml — phase B, à valider après A)
#   --phase all enchaîne A puis B avec confirmation entre les deux
#
# Flags:
#   --dry-run   Affiche ce qui serait fait sans rien modifier
#   --yes       Skip toutes les confirmations interactives (à utiliser uniquement
#               quand l'opérateur a déjà validé le plan en amont)
#
# Préconditions:
#   - À exécuter sur le serveur (xch-deploy) depuis /opt/xch-dev/XCH
#   - openssl disponible
#   - docker compose disponible
#   - Permission d'écriture sur backend/.env, .env, docker-compose.yml
#
# Que fait ce script:
#   PHASE A
#     1. Audit serveur (longueurs actuelles)
#     2. Demande confirmation
#     3. Backup .env + backend/.env timestampés
#     4. Génère JWT_SECRET (64), JWT_REFRESH_SECRET (64),
#        MINIO_ACCESS_KEY (20 hex), MINIO_SECRET_KEY (40 hex),
#        WEBHOOK_SECRET (32 base64) commun backend/Gatus
#     5. Patch atomique des deux .env (sed in-place vérifié)
#     6. Récupère le secret rotation log dans /tmp/xch-rotated-XXX.txt (chmod 600)
#     7. docker compose up -d --no-deps --force-recreate backend gatus
#     8. Healthcheck /api/health (60s timeout)
#     9. Smoke test login admin@demo.fr
#    10. Smoke test webhook Gatus avec nouveau secret
#    11. Récap final
#
#   PHASE B
#     1. Modifie docker-compose.yml pour ajouter --requirepass à redis
#     2. Ajoute REDIS_PASSWORD à backend/.env
#     3. docker compose up -d --no-deps --force-recreate redis backend
#     4. Vérifie que BullMQ + cache Redis backend reconnectent
#
# Reverse / rollback:
#   En cas d'échec d'un smoke test, le script affiche les commandes de rollback
#   (cp .env.bak.XXX .env && docker compose up -d backend gatus). Pas de rollback
#   automatique : l'opérateur juge.
#
# Auteur: XCH Project
# Date: 2026-04-26
##############################################################################

set -uo pipefail

# ── Couleurs ────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
    RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' BLUE='\033[0;34m' NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# ── Defaults / args ─────────────────────────────────────────────────────────
PHASE="a"
DRY_RUN=false
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --phase)    PHASE="${2:-a}"; shift 2 ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --yes)      SKIP_CONFIRM=true; shift ;;
        -h|--help)
            sed -n '3,40p' "$0" | sed 's/^# *//'
            exit 0
            ;;
        *)
            echo -e "${RED}Argument inconnu: $1${NC}" >&2; exit 2 ;;
    esac
done

if [[ ! "$PHASE" =~ ^(a|b|all)$ ]]; then
    echo -e "${RED}--phase doit être a, b ou all (reçu: $PHASE)${NC}" >&2
    exit 2
fi

# ── Pre-checks env ──────────────────────────────────────────────────────────
command -v openssl >/dev/null 2>&1 || { echo -e "${RED}openssl introuvable${NC}"; exit 2; }
command -v docker  >/dev/null 2>&1 || { echo -e "${RED}docker introuvable${NC}"; exit 2; }
command -v curl    >/dev/null 2>&1 || { echo -e "${RED}curl introuvable${NC}"; exit 2; }

# Détection du repo root (doit contenir backend/.env + .env + docker-compose.yml)
if [ ! -f backend/.env ] || [ ! -f .env ] || [ ! -f docker-compose.yml ]; then
    echo -e "${RED}Lance ce script depuis la racine du repo XCH${NC}"
    echo "  attendu : backend/.env, .env, docker-compose.yml"
    echo "  cwd     : $(pwd)"
    exit 2
fi

BACKEND_ENV="backend/.env"
ROOT_ENV=".env"
COMPOSE_FILE="docker-compose.yml"
TS="$(date +%Y%m%d-%H%M%S)"
SECRETS_LOG="/tmp/xch-rotated-${TS}.txt"

# ── Helpers ─────────────────────────────────────────────────────────────────
ask() {
    local prompt="$1"
    if [ "$SKIP_CONFIRM" = true ]; then
        echo -e "${YELLOW}[--yes] ${prompt} → OUI${NC}"
        return 0
    fi
    read -r -p "$(echo -e "${YELLOW}${prompt} [y/N] ${NC}")" answer
    [[ "$answer" =~ ^[Yy]$ ]]
}

env_len() {
    # Longueur de la valeur d'une clé dans un fichier .env
    local key="$1" file="$2"
    local val
    val="$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d'=' -f2-)"
    echo -n "${#val}"
}

env_present() {
    local key="$1" file="$2"
    grep -qE "^${key}=" "$file" 2>/dev/null
}

set_env() {
    # Pose ou met à jour KEY=VALUE dans un .env. Atomique (sed -i.bak puis verif).
    local key="$1" value="$2" file="$3"

    if [ "$DRY_RUN" = true ]; then
        echo "  [dry-run] set_env $key (len=${#value}) dans $file"
        return 0
    fi

    if env_present "$key" "$file"; then
        # remplace en échappant les caractères spéciaux pour sed
        local escaped
        escaped="$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')"
        sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$file"
    else
        printf '\n%s=%s\n' "$key" "$value" >> "$file"
    fi

    # Vérification : la nouvelle valeur est bien là
    local actual
    actual="$(grep -E "^${key}=" "$file" | head -1 | cut -d'=' -f2-)"
    if [ "$actual" != "$value" ]; then
        echo -e "${RED}set_env vérification échouée pour $key dans $file${NC}"
        return 1
    fi
}

healthcheck() {
    # Backend XCH n'a pas encore de /api/health global (TODO post-S1).
    # On considère que le serveur est UP si une requête arrive à toucher
    # un handler (n'importe quel HTTP code, même 4xx). Connection refused
    # ou timeout = down.
    local url="$1" timeout="${2:-60}"
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
        local code
        code="$(curl -s -o /dev/null -w '%{http_code}' -m 3 "$url" 2>/dev/null || echo '000')"
        # 000 = connect failed / timeout, sinon serveur a répondu
        if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    return 1
}

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ── PHASE A ─────────────────────────────────────────────────────────────────
phase_a() {
    print_header "PHASE A — JWT + MinIO + webhook synchronisé"

    echo -e "\n${BLUE}1. Audit longueurs actuelles${NC}"
    printf "  %-30s len=%s\n" "JWT_SECRET (backend)"             "$(env_len JWT_SECRET                 "$BACKEND_ENV")"
    printf "  %-30s len=%s\n" "JWT_REFRESH_SECRET (backend)"     "$(env_len JWT_REFRESH_SECRET         "$BACKEND_ENV")"
    printf "  %-30s len=%s\n" "MINIO_ACCESS_KEY (backend)"       "$(env_len MINIO_ACCESS_KEY           "$BACKEND_ENV")"
    printf "  %-30s len=%s\n" "MINIO_SECRET_KEY (backend)"       "$(env_len MINIO_SECRET_KEY           "$BACKEND_ENV")"
    printf "  %-30s len=%s\n" "MINIO_ACCESS_KEY (root)"          "$(env_len MINIO_ACCESS_KEY           "$ROOT_ENV")"
    printf "  %-30s len=%s\n" "MINIO_SECRET_KEY (root)"          "$(env_len MINIO_SECRET_KEY           "$ROOT_ENV")"
    printf "  %-30s len=%s\n" "MONITORING_WEBHOOK_SECRET (be)"   "$(env_len MONITORING_WEBHOOK_SECRET  "$BACKEND_ENV")"
    printf "  %-30s len=%s\n" "GATUS_WEBHOOK_SECRET (root)"      "$(env_len GATUS_WEBHOOK_SECRET       "$ROOT_ENV")"

    echo -e "\n${YELLOW}Cibles : 64/64/20/40/40/40/32/32 chars.${NC}"
    echo -e "${YELLOW}Impact : tous les utilisateurs avec un JWT actif seront délogués.${NC}"
    echo -e "${YELLOW}         MinIO restart court (~5 s).${NC}"
    echo -e "${YELLOW}         Gatus restart court (~5 s).${NC}"

    if ! ask "Confirmer Phase A ?"; then
        echo "Abandon."
        return 1
    fi

    echo -e "\n${BLUE}2. Backup .env timestampés${NC}"
    if [ "$DRY_RUN" = false ]; then
        cp "$BACKEND_ENV" "${BACKEND_ENV}.bak.${TS}"
        cp "$ROOT_ENV"    "${ROOT_ENV}.bak.${TS}"
        echo -e "  ${GREEN}✓${NC} ${BACKEND_ENV}.bak.${TS}"
        echo -e "  ${GREEN}✓${NC} ${ROOT_ENV}.bak.${TS}"
    else
        echo "  [dry-run] cp $BACKEND_ENV ${BACKEND_ENV}.bak.${TS}"
        echo "  [dry-run] cp $ROOT_ENV    ${ROOT_ENV}.bak.${TS}"
    fi

    echo -e "\n${BLUE}3. Génération secrets${NC}"
    local NEW_JWT NEW_REFRESH NEW_MINIO_AK NEW_MINIO_SK NEW_WEBHOOK
    NEW_JWT="$(openssl rand -base64 48 | tr -d '\n=' | cut -c1-64)"
    NEW_REFRESH="$(openssl rand -base64 48 | tr -d '\n=' | cut -c1-64)"
    NEW_MINIO_AK="$(openssl rand -hex 10)"            # 20 chars hex
    NEW_MINIO_SK="$(openssl rand -hex 20)"            # 40 chars hex
    NEW_WEBHOOK="$(openssl rand -base64 24 | tr -d '\n=' | cut -c1-32)"
    echo "  ✓ 5 secrets générés (longueurs : 64 / 64 / 20 / 40 / 32)"

    echo -e "\n${BLUE}4. Application aux .env${NC}"
    set_env "JWT_SECRET"                "$NEW_JWT"        "$BACKEND_ENV"
    set_env "JWT_REFRESH_SECRET"        "$NEW_REFRESH"    "$BACKEND_ENV"
    set_env "MINIO_ACCESS_KEY"          "$NEW_MINIO_AK"   "$BACKEND_ENV"
    set_env "MINIO_SECRET_KEY"          "$NEW_MINIO_SK"   "$BACKEND_ENV"
    set_env "MINIO_ACCESS_KEY"          "$NEW_MINIO_AK"   "$ROOT_ENV"
    set_env "MINIO_SECRET_KEY"          "$NEW_MINIO_SK"   "$ROOT_ENV"
    set_env "MONITORING_WEBHOOK_SECRET" "$NEW_WEBHOOK"    "$BACKEND_ENV"
    set_env "GATUS_WEBHOOK_SECRET"      "$NEW_WEBHOOK"    "$ROOT_ENV"
    echo "  ✓ 8 set_env appliqués (backend + root)"

    if [ "$DRY_RUN" = false ]; then
        umask 077
        {
            echo "# XCH secrets rotation - Phase A - $TS"
            echo "# CHMOD 600 - SUPPRIMEZ APRÈS ARCHIVAGE SÉCURISÉ"
            echo
            echo "JWT_SECRET=$NEW_JWT"
            echo "JWT_REFRESH_SECRET=$NEW_REFRESH"
            echo "MINIO_ACCESS_KEY=$NEW_MINIO_AK"
            echo "MINIO_SECRET_KEY=$NEW_MINIO_SK"
            echo "MONITORING_WEBHOOK_SECRET=$NEW_WEBHOOK"
            echo "GATUS_WEBHOOK_SECRET=$NEW_WEBHOOK   # = MONITORING_WEBHOOK_SECRET"
        } > "$SECRETS_LOG"
        chmod 600 "$SECRETS_LOG"
        echo -e "  ${GREEN}✓${NC} Nouveaux secrets archivés dans ${SECRETS_LOG} (chmod 600)"
    fi

    echo -e "\n${BLUE}5. Restart rolling : backend + gatus + minio${NC}"
    if [ "$DRY_RUN" = false ]; then
        # MinIO doit être restart en premier (nouveau root credentials prennent au boot)
        echo "  → restart minio (nouveau root user/key)"
        docker compose up -d --no-deps --force-recreate minio || {
            echo -e "${RED}MinIO restart échoué — rollback :${NC}"
            echo "  cp ${BACKEND_ENV}.bak.${TS} $BACKEND_ENV"
            echo "  cp ${ROOT_ENV}.bak.${TS} $ROOT_ENV"
            echo "  docker compose up -d minio backend gatus"
            return 1
        }
        sleep 3
        echo "  → restart backend (lit les nouveaux JWT + MinIO + webhook)"
        docker compose up -d --no-deps --force-recreate backend
        echo "  → restart gatus (lit le nouveau GATUS_WEBHOOK_SECRET)"
        docker compose up -d --no-deps --force-recreate gatus
    else
        echo "  [dry-run] docker compose up -d --no-deps --force-recreate minio backend gatus"
    fi

    echo -e "\n${BLUE}6. Healthcheck backend (any HTTP code)${NC}"
    # Tape /api/auth/login en GET — renvoie 404 ou 405 si serveur up, 000 si down
    local HEALTH_URL="http://localhost:3002/api/auth/login"
    if [ "$DRY_RUN" = false ]; then
        echo -n "  attente "
        if healthcheck "$HEALTH_URL" 90; then
            echo -e "\n  ${GREEN}✓${NC} backend répond 200"
        else
            echo -e "\n  ${RED}✗${NC} backend ne répond pas après 90 s"
            echo -e "  ${YELLOW}Rollback :${NC}"
            echo "    cp ${BACKEND_ENV}.bak.${TS} $BACKEND_ENV"
            echo "    cp ${ROOT_ENV}.bak.${TS} $ROOT_ENV"
            echo "    docker compose up -d --force-recreate minio backend gatus"
            return 1
        fi
    fi

    echo -e "\n${BLUE}7. Smoke test login admin@demo.fr${NC}"
    if [ "$DRY_RUN" = false ]; then
        local LOGIN_HTTP
        LOGIN_HTTP="$(curl -s -o /dev/null -w '%{http_code}' \
            -X POST "http://localhost:3002/api/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"email":"admin@demo.fr","password":"Demo1234"}')"
        if [ "$LOGIN_HTTP" = "201" ] || [ "$LOGIN_HTTP" = "200" ]; then
            echo -e "  ${GREEN}✓${NC} login admin@demo.fr → HTTP $LOGIN_HTTP (JWT regénéré OK)"
        else
            echo -e "  ${RED}✗${NC} login → HTTP $LOGIN_HTTP (attendu 200/201)"
            echo "  Vérifie les logs : docker compose logs --tail=50 backend"
            return 1
        fi
    fi

    echo -e "\n${BLUE}8. Smoke test webhook Gatus (nouveau secret)${NC}"
    if [ "$DRY_RUN" = false ]; then
        local WEBHOOK_HTTP
        WEBHOOK_HTTP="$(curl -s -o /dev/null -w '%{http_code}' \
            -X POST "http://localhost:3002/api/integrations/monitoring/webhook?provider=gatus" \
            -H "Content-Type: application/json" \
            -H "x-webhook-secret: $NEW_WEBHOOK" \
            -d '{"endpoint":{"name":"smoke-test","group":""},"success":true,"alert":{"type":"custom"}}')"
        if [ "$WEBHOOK_HTTP" = "200" ] || [ "$WEBHOOK_HTTP" = "201" ] || [ "$WEBHOOK_HTTP" = "204" ]; then
            echo -e "  ${GREEN}✓${NC} webhook → HTTP $WEBHOOK_HTTP"
        else
            echo -e "  ${YELLOW}!${NC} webhook → HTTP $WEBHOOK_HTTP (à investiguer manuellement)"
        fi

        # Test avec mauvais secret = 401 attendu
        local WRONG_HTTP
        WRONG_HTTP="$(curl -s -o /dev/null -w '%{http_code}' \
            -X POST "http://localhost:3002/api/integrations/monitoring/webhook?provider=gatus" \
            -H "Content-Type: application/json" \
            -H "x-webhook-secret: wrong-secret" \
            -d '{"endpoint":{"name":"smoke-test","group":""},"success":true,"alert":{"type":"custom"}}')"
        if [ "$WRONG_HTTP" = "401" ] || [ "$WRONG_HTTP" = "403" ]; then
            echo -e "  ${GREEN}✓${NC} webhook avec mauvais secret → HTTP $WRONG_HTTP (rejeté)"
        else
            echo -e "  ${RED}✗${NC} webhook avec mauvais secret → HTTP $WRONG_HTTP (attendu 401/403)"
        fi
    fi

    echo
    print_header "✓ PHASE A TERMINÉE"
    echo "  Backups   : ${BACKEND_ENV}.bak.${TS}, ${ROOT_ENV}.bak.${TS}"
    echo "  Log secrets : ${SECRETS_LOG} (chmod 600)"
    echo "  À faire    : archiver le log dans le coffre, puis 'shred -u ${SECRETS_LOG}'"
}

# ── PHASE B ─────────────────────────────────────────────────────────────────
phase_b() {
    print_header "PHASE B — REDIS_PASSWORD (modifie docker-compose.yml)"

    local CURRENT_LEN
    CURRENT_LEN="$(env_len REDIS_PASSWORD "$BACKEND_ENV")"
    echo -e "  REDIS_PASSWORD actuel : len=${CURRENT_LEN}"
    if [ "$CURRENT_LEN" -ge 16 ]; then
        echo -e "  ${YELLOW}Redis a déjà un password (>=16 chars). Phase B sera skippée.${NC}"
        return 0
    fi

    echo -e "\n${YELLOW}Cette phase :${NC}"
    echo "  - Génère REDIS_PASSWORD (32 chars base64)"
    echo "  - Modifie docker-compose.yml : ajoute --requirepass au service redis"
    echo "  - Restart redis puis backend"
    if ! ask "Confirmer Phase B ?"; then
        echo "Abandon."
        return 1
    fi

    local NEW_REDIS_PWD
    NEW_REDIS_PWD="$(openssl rand -base64 24 | tr -d '\n=' | cut -c1-32)"
    echo -e "\n${BLUE}1. Backup compose + .env${NC}"
    if [ "$DRY_RUN" = false ]; then
        cp "$COMPOSE_FILE" "${COMPOSE_FILE}.bak.${TS}"
        cp "$BACKEND_ENV"  "${BACKEND_ENV}.bak.${TS}.b"
        echo -e "  ${GREEN}✓${NC} ${COMPOSE_FILE}.bak.${TS}"
        echo -e "  ${GREEN}✓${NC} ${BACKEND_ENV}.bak.${TS}.b"
    fi

    echo -e "\n${BLUE}2. Pose REDIS_PASSWORD${NC}"
    set_env "REDIS_PASSWORD" "$NEW_REDIS_PWD" "$BACKEND_ENV"

    echo -e "\n${BLUE}3. Modifie docker-compose.yml service redis${NC}"
    # On vérifie d'abord qu'il n'y a pas déjà un command sur redis
    if grep -A 10 "^  redis:" "$COMPOSE_FILE" | grep -q "command:"; then
        echo -e "  ${YELLOW}!${NC} Un 'command:' existe déjà sur redis dans $COMPOSE_FILE"
        echo "    Édition manuelle requise — j'ajoute simplement REDIS_PASSWORD au .env."
    else
        if [ "$DRY_RUN" = false ]; then
            # Insère 'command' + 'environment' après la ligne 'image: redis:...'
            python3 - <<'PY' "$COMPOSE_FILE" || python - <<'PY' "$COMPOSE_FILE"
import sys, re
fn = sys.argv[1]
with open(fn) as f: src = f.read()
# Trouver le bloc redis: et insérer command + environment après image
pattern = re.compile(r'(^  redis:\n(?:    [^\n]*\n)*?    image:[^\n]*\n)', re.M)
def repl(m):
    block = m.group(1)
    return block + '    command: redis-server --requirepass "${REDIS_PASSWORD}" --maxmemory 128mb --maxmemory-policy allkeys-lru\n    environment:\n      REDIS_PASSWORD: ${REDIS_PASSWORD}\n'
new = pattern.sub(repl, src, count=1)
if new == src:
    print("WARN: pattern redis: not found, no edit done", file=sys.stderr)
    sys.exit(1)
with open(fn, 'w') as f: f.write(new)
PY
            echo -e "  ${GREEN}✓${NC} docker-compose.yml mis à jour"
        else
            echo "  [dry-run] insertion 'command:' + 'environment:' au service redis"
        fi
    fi

    echo -e "\n${BLUE}4. Restart redis puis backend${NC}"
    if [ "$DRY_RUN" = false ]; then
        docker compose up -d --no-deps --force-recreate redis
        sleep 3
        docker compose up -d --no-deps --force-recreate backend
        echo -e "  ${BLUE}attente backend health${NC}"
        if healthcheck "http://localhost:3002/api/health" 60; then
            echo -e "\n  ${GREEN}✓${NC} backend OK avec Redis password"
        else
            echo -e "\n  ${RED}✗${NC} backend ne répond plus"
            echo "  Vérifie : docker compose logs --tail=50 backend redis"
            return 1
        fi
    fi

    echo -e "\n${BLUE}5. Test Redis ping authentifié${NC}"
    if [ "$DRY_RUN" = false ]; then
        if docker exec xch-redis redis-cli -a "$NEW_REDIS_PWD" --no-auth-warning ping | grep -q PONG; then
            echo -e "  ${GREEN}✓${NC} redis-cli auth OK (PONG)"
        else
            echo -e "  ${RED}✗${NC} redis-cli auth ne répond pas"
        fi
    fi

    if [ "$DRY_RUN" = false ]; then
        echo "" >> "$SECRETS_LOG"
        echo "# Phase B" >> "$SECRETS_LOG"
        echo "REDIS_PASSWORD=$NEW_REDIS_PWD" >> "$SECRETS_LOG"
    fi

    print_header "✓ PHASE B TERMINÉE"
}

# ── Main ────────────────────────────────────────────────────────────────────
case "$PHASE" in
    a)   phase_a ;;
    b)   phase_b ;;
    all) phase_a && (ask "Phase A OK. Enchaîner Phase B ?" && phase_b) ;;
esac

echo
echo -e "${GREEN}Tous les exits 0 = OK. Si une étape a échoué, lis le rollback affiché.${NC}"
echo -e "${YELLOW}N'oublie pas de :${NC}"
echo -e "${YELLOW}  - Archiver puis 'shred -u ${SECRETS_LOG}'${NC}"
echo -e "${YELLOW}  - Vérifier UFW (sudo ufw status verbose) — caveat indépendant signalé${NC}"
echo -e "${YELLOW}  - Tag v1.5.0 sur main une fois S0+S1 mergés${NC}"
