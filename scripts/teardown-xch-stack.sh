#!/bin/bash
# =============================================================================
# XCH — Teardown XCH stack (strict whitelist scope)
#
# Track E.3 Pass 0 — outil reproductible pour wiper la stack XCH uniquement
# (containers + volumes Docker + .env) en préservant strictement les autres
# services co-localisés sur le host (GlitchTip, Grafana, NPM proxy, Portainer,
# AdventureLog, etc.).
#
# Pattern (cf. MCP `XCH_TEARDOWN_XCH_STACK_PROCEDURE` post-Track E.3) :
#   - WHITELIST explicite (jamais blacklist) : 4 volumes + 8 containers + 1 network
#   - Backup pré-wipe automatique via /api/backup/full (sauf --skip-backup)
#   - Validation post-wipe obligatoire : GlitchTip 4 containers + Grafana
#   - Le filesystem /opt/xch-dev/XCH/{backend,frontend,scripts,docs,.git,...}
#     reste intact. Le repo git n'est jamais touché.
#
# Usage :
#   bash scripts/teardown-xch-stack.sh --dry-run         # MANDATORY for first exec
#   bash scripts/teardown-xch-stack.sh                   # real wipe
#   bash scripts/teardown-xch-stack.sh --preserve-secrets  # keep current .env
#   bash scripts/teardown-xch-stack.sh --skip-backup     # skip pre-wipe backup
#
# Env vars :
#   COMPOSE_PROJECT  Compose project name (default: xch)
#   COMPOSE_DIR      Compose directory      (default: /opt/xch-dev/XCH)
#   BACKEND_URL      Backend URL for backup (default: https://xch.eoncom.io)
#   RESTORE_ADMIN_EMAIL    Admin email for pre-wipe backup auth
#   RESTORE_ADMIN_PASSWORD Admin password for pre-wipe backup auth
#
# Whitelist (compose project `xch`) :
#   Containers : xch-postgres, xch-redis, xch-minio, xch-minio-init,
#                xch-backend, xch-backend-worker, xch-frontend, xch-nginx
#   Volumes    : xch_postgres_data, xch_redis_data, xch_minio_data,
#                xch_xch-upload-staging
#   Network    : xch_xch-network
#
# NEVER TOUCH (preserve strict) — anything else, especially :
#   Containers : glitchtip-* (5 — admin-seed + web + worker + postgres + redis),
#                grafana, portainer, nginx-proxy-manager, adventurelog-*, etc.
#   Volumes    : xch_glitchtip_postgres_data, xch_glitchtip_redis_data,
#                infrastructure_grafana_data, portainer_data1,
#                adventurelog_*, hash-only unnamed, zombies (xch-0-1_db-data,
#                xch_casbin-policies, xch_db-data, xch-minio-data).
#   Networks   : xch_glitchtip-internal, all others.
# =============================================================================

set -euo pipefail

usage() {
  sed -n '1,40p' "$0"
  exit 1
}

# ----------------------------- arg parsing --------------------------------

DRY_RUN="false"
PRESERVE_SECRETS="false"
SKIP_BACKUP="false"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)            DRY_RUN="true"; shift ;;
    --preserve-secrets)   PRESERVE_SECRETS="true"; shift ;;
    --skip-backup)        SKIP_BACKUP="true"; shift ;;
    --yes)                ASSUME_YES="true"; shift ;;
    -h|--help)            usage ;;
    *)                    echo "ERROR: unknown arg $1" >&2; exit 2 ;;
  esac
done

# ----------------------------- whitelists ---------------------------------

COMPOSE_PROJECT="${COMPOSE_PROJECT:-xch}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/xch-dev/XCH}"
BACKEND_URL="${BACKEND_URL:-https://xch.eoncom.io}"

# Whitelist — these are the ONLY resources this script touches.
# Source of truth = docker-compose.yml of XCH stack at $COMPOSE_DIR.
XCH_CONTAINERS=(
  xch-postgres
  xch-redis
  xch-minio
  xch-minio-init
  xch-backend
  xch-backend-worker
  xch-frontend
  xch-nginx
)
XCH_VOLUMES=(
  "${COMPOSE_PROJECT}_postgres_data"
  "${COMPOSE_PROJECT}_redis_data"
  "${COMPOSE_PROJECT}_minio_data"
  "${COMPOSE_PROJECT}_xch-upload-staging"
)
XCH_NETWORK="${COMPOSE_PROJECT}_xch-network"

# Preserve sentinels — must remain ALIVE and HEALTHY post-wipe :
#   glitchtip-web, glitchtip-worker, glitchtip-postgres, glitchtip-redis
PRESERVE_CONTAINERS=(
  glitchtip-web
  glitchtip-worker
  glitchtip-postgres
  glitchtip-redis
)
PRESERVE_VOLUMES=(
  "${COMPOSE_PROJECT}_glitchtip_postgres_data"
  "${COMPOSE_PROJECT}_glitchtip_redis_data"
)

# ----------------------------- header -------------------------------------

echo "==================================================="
echo "  XCH Stack Teardown — $(date -Iseconds)"
echo "==================================================="
echo ""
echo "  Mode               : $([[ "$DRY_RUN" == "true" ]] && echo 'DRY-RUN (read-only)' || echo 'REAL WIPE')"
echo "  Preserve secrets   : $PRESERVE_SECRETS"
echo "  Skip pre-wipe bkp  : $SKIP_BACKUP"
echo "  Compose project    : $COMPOSE_PROJECT"
echo "  Compose dir        : $COMPOSE_DIR"
echo "  Backend URL        : $BACKEND_URL"
echo ""
echo "  Whitelist containers (will wipe) : ${#XCH_CONTAINERS[@]} entries"
for c in "${XCH_CONTAINERS[@]}"; do echo "    - $c"; done
echo ""
echo "  Whitelist volumes (will wipe) : ${#XCH_VOLUMES[@]} entries"
for v in "${XCH_VOLUMES[@]}"; do echo "    - $v"; done
echo ""
echo "  Whitelist network (will remove) : $XCH_NETWORK"
echo ""
echo "  Preserve sentinels (must remain UP) :"
for c in "${PRESERVE_CONTAINERS[@]}"; do echo "    - container $c"; done
for v in "${PRESERVE_VOLUMES[@]}"; do echo "    - volume    $v"; done
echo "    - grafana host:3000 reachable"
echo "    - all containers / volumes NOT in whitelist : untouched"
echo ""

# ----------------------------- pre-flight ---------------------------------

echo "--- Pre-flight checks ---"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found" >&2; exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 not found" >&2; exit 1
fi
if [[ ! -f "$COMPOSE_DIR/docker-compose.yml" ]]; then
  echo "ERROR: $COMPOSE_DIR/docker-compose.yml not found" >&2; exit 1
fi

# Inventaire pre-wipe — détecter les ressources réellement présentes
PRESENT_CONTAINERS=()
for c in "${XCH_CONTAINERS[@]}"; do
  if docker container inspect "$c" >/dev/null 2>&1; then PRESENT_CONTAINERS+=("$c"); fi
done

PRESENT_VOLUMES=()
for v in "${XCH_VOLUMES[@]}"; do
  if docker volume inspect "$v" >/dev/null 2>&1; then PRESENT_VOLUMES+=("$v"); fi
done

# Verify preserve sentinels are currently up (don't wipe a broken state)
PRESERVE_MISSING=0
for c in "${PRESERVE_CONTAINERS[@]}"; do
  STATE=$(docker container inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'missing')
  if [[ "$STATE" != "running" ]]; then
    echo "  ⚠  preserve sentinel container '$c' state=$STATE (expected running)"
    PRESERVE_MISSING=$((PRESERVE_MISSING + 1))
  fi
done
for v in "${PRESERVE_VOLUMES[@]}"; do
  if ! docker volume inspect "$v" >/dev/null 2>&1; then
    echo "  ⚠  preserve sentinel volume '$v' MISSING (expected present)"
    PRESERVE_MISSING=$((PRESERVE_MISSING + 1))
  fi
done

# Grafana sentinel — http:localhost:3000 should respond 200/302
GRAFANA_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000 2>/dev/null || echo '000')
echo "  Grafana host:3000 = HTTP $GRAFANA_CODE"
if [[ "$GRAFANA_CODE" == "000" ]]; then
  echo "  ⚠  Grafana not reachable at host:3000 (could be normal if absent)"
fi

echo ""
echo "  Present XCH containers : ${#PRESENT_CONTAINERS[@]}/${#XCH_CONTAINERS[@]}"
echo "  Present XCH volumes    : ${#PRESENT_VOLUMES[@]}/${#XCH_VOLUMES[@]}"
echo "  Preserve sentinel issues : $PRESERVE_MISSING"
echo ""

if [[ "$PRESERVE_MISSING" -gt 0 ]] && [[ "$DRY_RUN" == "false" ]]; then
  echo "ERROR: preserve sentinels missing — refuse to wipe. Fix the env first." >&2
  exit 1
fi

# ----------------------------- pre-wipe backup ----------------------------

PRE_WIPE_BACKUP=""
if [[ "$SKIP_BACKUP" == "false" ]] && [[ "${#PRESENT_CONTAINERS[@]}" -gt 0 ]]; then
  echo "--- Pre-wipe backup ---"
  if [[ -z "${RESTORE_ADMIN_EMAIL:-}" || -z "${RESTORE_ADMIN_PASSWORD:-}" ]]; then
    echo "  ⚠  RESTORE_ADMIN_EMAIL / RESTORE_ADMIN_PASSWORD not set"
    echo "  ⚠  pre-wipe backup will be SKIPPED. Use --skip-backup to silence this warning."
  else
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  [dry-run] would auth $RESTORE_ADMIN_EMAIL on $BACKEND_URL"
      echo "  [dry-run] would POST /api/backup/full {encrypt:true}"
      echo "  [dry-run] would poll job until completed"
      echo "  [dry-run] would log filename in $COMPOSE_DIR/backups/pre-wipe-<TS>"
    else
      COOKIES=$(mktemp)
      AUTH_CODE=$(curl -sS -c "$COOKIES" -o /dev/null -w '%{http_code}' \
        -X POST "$BACKEND_URL/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$RESTORE_ADMIN_EMAIL\",\"password\":\"$RESTORE_ADMIN_PASSWORD\"}")
      if [[ "$AUTH_CODE" != "201" && "$AUTH_CODE" != "200" ]]; then
        echo "  ⚠  auth failed (HTTP $AUTH_CODE) — pre-wipe backup SKIPPED"
        rm -f "$COOKIES"
      else
        RESP=$(curl -sS -b "$COOKIES" -X POST "$BACKEND_URL/api/backup/full" \
          -H 'Content-Type: application/json' \
          -d '{"encrypt":true}')
        JOB_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("jobId",""))' 2>/dev/null || true)
        if [[ -z "$JOB_ID" ]]; then
          echo "  ⚠  no jobId returned : $RESP"
        else
          echo "  → backup enqueued jobId=$JOB_ID, polling..."
          for i in $(seq 1 30); do
            JOB=$(curl -sS -b "$COOKIES" "$BACKEND_URL/api/backup/jobs/$JOB_ID")
            STATE=$(echo "$JOB" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("state","?"))')
            if [[ "$STATE" == "completed" ]]; then
              FILENAME=$(echo "$JOB" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("result",{}).get("filename",""))')
              PRE_WIPE_BACKUP="$FILENAME"
              echo "  ✓ pre-wipe backup completed : $PRE_WIPE_BACKUP"
              break
            fi
            if [[ "$STATE" == "failed" ]]; then
              echo "  ⚠  pre-wipe backup FAILED"
              break
            fi
            sleep 2
          done
        fi
        rm -f "$COOKIES"
      fi
    fi
  fi
  echo ""
fi

# ----------------------------- confirm --------------------------------------

if [[ "$DRY_RUN" == "false" && "$ASSUME_YES" == "false" ]]; then
  echo "═══════════════════════════════════════════════════"
  echo "  ABOUT TO WIPE THE XCH STACK"
  echo "  ${#PRESENT_CONTAINERS[@]} containers + ${#PRESENT_VOLUMES[@]} volumes"
  echo "  Pre-wipe backup : ${PRE_WIPE_BACKUP:-NONE}"
  echo "═══════════════════════════════════════════════════"
  read -r -p "  Type 'WIPE' to confirm : " CONFIRM
  if [[ "$CONFIRM" != "WIPE" ]]; then
    echo "  Aborted." >&2
    exit 1
  fi
fi

# ----------------------------- wipe ---------------------------------------

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] $*"
  else
    echo "  + $*"
    "$@"
  fi
}

echo "--- Wipe ---"

# 1. Compose down --volumes (scope project-name only, never touches other projects)
echo "[1/4] docker compose down --volumes (project=$COMPOSE_PROJECT) ..."
run bash -c "cd '$COMPOSE_DIR' && docker compose -p '$COMPOSE_PROJECT' down --volumes --remove-orphans"

# 2. Explicit volume rm fallback (in case down --volumes missed any)
echo "[2/4] Fallback volume rm (whitelist only) ..."
for v in "${XCH_VOLUMES[@]}"; do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    run docker volume rm "$v"
  else
    [[ "$DRY_RUN" == "true" ]] && echo "  [dry-run] (already removed) $v" || echo "  (already removed) $v"
  fi
done

# 3. .env rotation
echo "[3/4] Backend .env handling ..."
if [[ "$PRESERVE_SECRETS" == "true" ]]; then
  echo "  → --preserve-secrets : leaving .env intact"
else
  TS=$(date +%s)
  if [[ -f "$COMPOSE_DIR/backend/.env" ]]; then
    run bash -c "mv '$COMPOSE_DIR/backend/.env' '$COMPOSE_DIR/backend/.env.bak.$TS'"
  fi
  if [[ -f "$COMPOSE_DIR/backend/.env.example" ]]; then
    run bash -c "cp '$COMPOSE_DIR/backend/.env.example' '$COMPOSE_DIR/backend/.env'"
  fi
  if [[ -f "$COMPOSE_DIR/.env" ]]; then
    run bash -c "mv '$COMPOSE_DIR/.env' '$COMPOSE_DIR/.env.bak.$TS'"
  fi
fi

# 4. Post-wipe validation
echo "[4/4] Post-wipe validation ..."
POST_FAIL=0

# 4a. XCH containers must be gone
for c in "${XCH_CONTAINERS[@]}"; do
  if [[ "$DRY_RUN" == "false" ]] && docker container inspect "$c" >/dev/null 2>&1; then
    echo "  ✗ XCH container '$c' still present"
    POST_FAIL=$((POST_FAIL + 1))
  else
    echo "  ✓ wiped : $c"
  fi
done

# 4b. XCH volumes must be gone
for v in "${XCH_VOLUMES[@]}"; do
  if [[ "$DRY_RUN" == "false" ]] && docker volume inspect "$v" >/dev/null 2>&1; then
    echo "  ✗ XCH volume '$v' still present"
    POST_FAIL=$((POST_FAIL + 1))
  else
    echo "  ✓ wiped : $v"
  fi
done

# 4c. Preserve sentinels MUST still be alive (the critical safety check)
echo ""
echo "  Preserve sentinel verification :"
for c in "${PRESERVE_CONTAINERS[@]}"; do
  STATE=$(docker container inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'missing')
  if [[ "$STATE" == "running" ]]; then
    echo "  ✓ container $c : running"
  else
    echo "  ✗ container $c : $STATE (expected running)"
    POST_FAIL=$((POST_FAIL + 10))   # heavy weight — STOP signal
  fi
done

for v in "${PRESERVE_VOLUMES[@]}"; do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    echo "  ✓ volume $v : present"
  else
    echo "  ✗ volume $v : MISSING (expected present)"
    POST_FAIL=$((POST_FAIL + 10))
  fi
done

GRAFANA_CODE_POST=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000 2>/dev/null || echo '000')
if [[ "$GRAFANA_CODE_POST" =~ ^(200|302|301|404)$ ]]; then
  echo "  ✓ Grafana host:3000 : HTTP $GRAFANA_CODE_POST (alive)"
else
  echo "  ⚠ Grafana host:3000 : HTTP $GRAFANA_CODE_POST (verify manually — was $GRAFANA_CODE pre-wipe)"
fi

# ----------------------------- summary ------------------------------------

echo ""
echo "==================================================="
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  DRY-RUN COMPLETE — no changes made"
  echo "  Would wipe : ${#PRESENT_CONTAINERS[@]} containers + ${#PRESENT_VOLUMES[@]} volumes"
elif [[ "$POST_FAIL" -ge 10 ]]; then
  echo "  ✗ TEARDOWN COMPLETED WITH PRESERVE SENTINEL FAILURE"
  echo "  $POST_FAIL units of issues (≥10 = preserve sentinel broken)"
  echo "  → STOP immediately, audit défensif required (cf. plan E.3 guardrail §5)"
  exit 1
elif [[ "$POST_FAIL" -gt 0 ]]; then
  echo "  ⚠ Teardown completed with $POST_FAIL minor issues (XCH resources not fully wiped)"
  echo "  Manual cleanup may be required."
  exit 2
else
  echo "  ✓ Teardown complete — XCH stack wiped, all preserve sentinels intact"
  [[ -n "$PRE_WIPE_BACKUP" ]] && echo "  Pre-wipe backup : $PRE_WIPE_BACKUP"
  echo ""
  echo "  Next step (Pass 1) : bootstrap from scratch"
  echo "    cd $COMPOSE_DIR"
  echo "    docker compose up -d"
  echo "    # wait healthchecks, then setup wizard via UI"
fi
echo "==================================================="
