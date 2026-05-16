#!/bin/bash
# =============================================================================
# XCH — Teardown XCH stack (strict whitelist scope) — v2 (post-catastrophe fix)
#
# Track E.3 Pass 0 + Pass 1 catastrophe fix (2026-05-16) — outil reproductible
# pour wiper la stack XCH uniquement (containers + volumes Docker + .env) en
# préservant strictement les autres services co-localisés sur le host
# (GlitchTip, Grafana, NPM proxy, Portainer, AdventureLog, etc.).
#
# v1 → v2 changes (post-catastrophe acquittée user) :
#   - SUPPRESSION `docker compose down --volumes --remove-orphans` (trop large :
#     scope = compose project name ; sur xch-deploy le project `xch` regroupait
#     XCH + GlitchTip → `--remove-orphans` tuait les GlitchTip aussi).
#   - SURGICAL `docker stop` + `docker rm` + `docker volume rm` explicit par
#     nom (whitelist hardcoded).
#   - PRE-FLIGHT cross-project pollution check : si des containers/volumes
#     hors whitelist sont taggés avec le project `xch` → ABORT avec
#     instructions de remediation (force isolation via `-p xch-glitchtip`).
#
# Pattern figé MCP `XCH_CO_HOSTED_DOCKER_PROJECTS_DISCIPLINE_2026_05_16` :
#   - WHITELIST explicite (jamais blacklist), prescriptive (pas descriptive)
#   - Backup pré-wipe automatique via /api/backup/full (sauf --skip-backup)
#   - Validation post-wipe obligatoire : GlitchTip 4 containers + Grafana
#   - Le filesystem /opt/xch-dev/XCH/{backend,frontend,scripts,docs,.git,...}
#     reste intact. Le repo git n'est jamais touché.
#
# Usage :
#   bash scripts/teardown-xch-stack.sh --dry-run         # MANDATORY for first exec
#   bash scripts/teardown-xch-stack.sh                   # real wipe (prompt confirm)
#   bash scripts/teardown-xch-stack.sh --yes             # real wipe (skip prompt)
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
#   Network    : xch_xch-network (only if no preserved container still attached)
#
# Pollution sentinels (ABORT if present in project `xch`) :
#   glitchtip-* containers, xch_glitchtip_* volumes, xch_glitchtip-internal network.
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

# Pollution sentinels — if present in the same compose project, abort.
# These must run under a SEPARATE project name (e.g. `xch-glitchtip`).
POLLUTION_CONTAINER_PREFIXES=(
  glitchtip-
)
POLLUTION_VOLUME_PATTERNS=(
  "${COMPOSE_PROJECT}_glitchtip_"
)

# Preserve sentinels — must remain ALIVE post-wipe. These run under a
# DIFFERENT compose project (xch-glitchtip post-recovery). The wipe MUST NOT
# touch them.
PRESERVE_CONTAINERS=(
  glitchtip-web
  glitchtip-worker
  glitchtip-postgres
  glitchtip-redis
)

# ----------------------------- header -------------------------------------

echo "==================================================="
echo "  XCH Stack Teardown v2 — $(date -Iseconds)"
echo "==================================================="
echo ""
echo "  Mode               : $([[ "$DRY_RUN" == "true" ]] && echo 'DRY-RUN (read-only)' || echo 'REAL WIPE')"
echo "  Preserve secrets   : $PRESERVE_SECRETS"
echo "  Skip pre-wipe bkp  : $SKIP_BACKUP"
echo "  Compose project    : $COMPOSE_PROJECT"
echo "  Compose dir        : $COMPOSE_DIR"
echo "  Backend URL        : $BACKEND_URL"
echo ""
echo "  Whitelist containers (will wipe surgically) : ${#XCH_CONTAINERS[@]} entries"
for c in "${XCH_CONTAINERS[@]}"; do echo "    - $c"; done
echo ""
echo "  Whitelist volumes (will wipe surgically) : ${#XCH_VOLUMES[@]} entries"
for v in "${XCH_VOLUMES[@]}"; do echo "    - $v"; done
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

# --- POLLUTION CHECK : ABORT if non-XCH stuff lives in the same compose project ---
# This is the CRITICAL FIX (v1 → v2). On xch-deploy the GlitchTip stack was
# started under project `xch` (default deduced from dir `XCH`). `docker compose
# down --remove-orphans` then killed glitchtip-* too. v2 detects this and
# refuses to wipe, telling the operator to re-isolate GlitchTip first.

echo ""
echo "  Pollution check : looking for non-XCH resources in project '${COMPOSE_PROJECT}' ..."
POLLUTION_FOUND=0

# Containers tagged with project=xch but matching pollution prefixes
POLLUTED_CONTAINERS=$(docker ps -a --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" --format '{{.Names}}' 2>/dev/null | grep -E "^($(IFS='|'; echo "${POLLUTION_CONTAINER_PREFIXES[*]}"))" || true)
if [[ -n "$POLLUTED_CONTAINERS" ]]; then
  echo "  ✗ POLLUTED containers in project '${COMPOSE_PROJECT}' :"
  echo "$POLLUTED_CONTAINERS" | sed 's/^/      /'
  POLLUTION_FOUND=$((POLLUTION_FOUND + 1))
fi

# Volumes matching pollution patterns
for pattern in "${POLLUTION_VOLUME_PATTERNS[@]}"; do
  POLLUTED_VOLUMES=$(docker volume ls --format '{{.Name}}' | grep -E "^${pattern}" || true)
  if [[ -n "$POLLUTED_VOLUMES" ]]; then
    echo "  ✗ POLLUTED volumes matching '${pattern}*' :"
    echo "$POLLUTED_VOLUMES" | sed 's/^/      /'
    POLLUTION_FOUND=$((POLLUTION_FOUND + 1))
  fi
done

if [[ "$POLLUTION_FOUND" -gt 0 ]]; then
  echo ""
  echo "ERROR: Co-hosted Docker projects detected in compose project '${COMPOSE_PROJECT}'." >&2
  echo "       Wiping would also remove these orphan resources. REFUSING." >&2
  echo "" >&2
  echo "Remediation : re-start the polluting stack under a SEPARATE project name :" >&2
  echo "  cd ${COMPOSE_DIR}" >&2
  echo "  docker compose -f docker-compose.glitchtip.yml -p xch-glitchtip up -d" >&2
  echo "" >&2
  echo "Then verify isolation : 'docker volume ls' should show 'xch-glitchtip_*' instead of 'xch_glitchtip_*'." >&2
  echo "Re-run this script once isolation is confirmed." >&2
  exit 1
fi

echo "  ✓ pollution check PASS — no co-hosted projects in '${COMPOSE_PROJECT}'"
echo ""

# --- Inventory --------------------------------------------------------------

PRESENT_CONTAINERS=()
for c in "${XCH_CONTAINERS[@]}"; do
  if docker container inspect "$c" >/dev/null 2>&1; then PRESENT_CONTAINERS+=("$c"); fi
done

PRESENT_VOLUMES=()
for v in "${XCH_VOLUMES[@]}"; do
  if docker volume inspect "$v" >/dev/null 2>&1; then PRESENT_VOLUMES+=("$v"); fi
done

# Verify preserve sentinels (informative — they should run under SEPARATE project now)
PRESERVE_RUNNING=0
for c in "${PRESERVE_CONTAINERS[@]}"; do
  STATE=$(docker container inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'missing')
  if [[ "$STATE" == "running" ]]; then
    PRESERVE_RUNNING=$((PRESERVE_RUNNING + 1))
  fi
done

GRAFANA_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000 2>/dev/null || echo '000')

echo "  Present XCH containers : ${#PRESENT_CONTAINERS[@]}/${#XCH_CONTAINERS[@]}"
echo "  Present XCH volumes    : ${#PRESENT_VOLUMES[@]}/${#XCH_VOLUMES[@]}"
echo "  GlitchTip preserve sentinels running : $PRESERVE_RUNNING/${#PRESERVE_CONTAINERS[@]}"
echo "  Grafana host:3000      : HTTP $GRAFANA_CODE"
echo ""

# ----------------------------- pre-wipe backup ----------------------------

PRE_WIPE_BACKUP=""
if [[ "$SKIP_BACKUP" == "false" ]] && [[ "${#PRESENT_CONTAINERS[@]}" -gt 0 ]]; then
  echo "--- Pre-wipe backup ---"
  if [[ -z "${RESTORE_ADMIN_EMAIL:-}" || -z "${RESTORE_ADMIN_PASSWORD:-}" ]]; then
    echo "  ⚠  RESTORE_ADMIN_EMAIL / RESTORE_ADMIN_PASSWORD not set"
    echo "  ⚠  pre-wipe backup will be SKIPPED. Use --skip-backup to silence."
  else
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  [dry-run] would auth $RESTORE_ADMIN_EMAIL on $BACKEND_URL"
      echo "  [dry-run] would POST /api/backup/full {encrypt:true}"
      echo "  [dry-run] would poll job until completed (max 60s)"
    else
      COOKIES=$(mktemp)
      AUTH_CODE=$(curl -sS -c "$COOKIES" -o /dev/null -w '%{http_code}' --max-time 10 \
        -X POST "$BACKEND_URL/api/auth/login" \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$RESTORE_ADMIN_EMAIL\",\"password\":\"$RESTORE_ADMIN_PASSWORD\"}" 2>/dev/null || echo 'ERR')
      if [[ "$AUTH_CODE" != "201" && "$AUTH_CODE" != "200" ]]; then
        echo "  ⚠  auth failed (HTTP $AUTH_CODE) — pre-wipe backup SKIPPED"
        rm -f "$COOKIES"
      else
        RESP=$(curl -sS -b "$COOKIES" --max-time 10 -X POST "$BACKEND_URL/api/backup/full" \
          -H 'Content-Type: application/json' -d '{"encrypt":true}' 2>/dev/null || echo '{}')
        JOB_ID=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("jobId",""))' 2>/dev/null || true)
        if [[ -z "$JOB_ID" ]]; then
          echo "  ⚠  no jobId returned : $RESP — pre-wipe backup SKIPPED"
        else
          echo "  → backup enqueued jobId=$JOB_ID, polling..."
          for i in $(seq 1 30); do
            JOB=$(curl -sS -b "$COOKIES" --max-time 5 "$BACKEND_URL/api/backup/jobs/$JOB_ID" 2>/dev/null || echo '{}')
            STATE=$(echo "$JOB" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("state","?"))' 2>/dev/null || echo '?')
            if [[ "$STATE" == "completed" ]]; then
              FILENAME=$(echo "$JOB" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("result",{}).get("filename",""))')
              PRE_WIPE_BACKUP="$FILENAME"
              echo "  ✓ pre-wipe backup completed : $PRE_WIPE_BACKUP"

              # Track E.3 Pass 6 fix : download ZIP to host filesystem
              # BEFORE the wipe destroys the MinIO volume.
              # Strategy : query /api/backup/list to find the ID matching the
              # filename, then GET /api/backup/:id/download into the host
              # backups dir. The host path /opt/xch-dev/XCH/backups (or symlink
              # to /tmp/xch-backups) survives the wipe scope.
              LIST=$(curl -sS -b "$COOKIES" --max-time 10 "$BACKEND_URL/api/backup/list" 2>/dev/null || echo '{}')
              BACKUP_ID=$(echo "$LIST" | python3 -c "import sys,json;ds=json.load(sys.stdin).get('backups',[]);m=[b for b in ds if b.get('filename')=='$FILENAME'];print(m[0]['id'] if m else '')" 2>/dev/null || true)

              HOST_BACKUPS_DIR="$COMPOSE_DIR/backups"
              mkdir -p "$HOST_BACKUPS_DIR" 2>/dev/null || true
              HOST_PRE_WIPE_PATH="$HOST_BACKUPS_DIR/pre-wipe-$(date +%s)-$FILENAME"

              if [[ -n "$BACKUP_ID" ]]; then
                echo "  → downloading $FILENAME (id=$BACKUP_ID) to host filesystem before wipe..."
                DL_CODE=$(curl -sS -b "$COOKIES" --max-time 60 -o "$HOST_PRE_WIPE_PATH" \
                  -w '%{http_code}' "$BACKEND_URL/api/backup/$BACKUP_ID/download" 2>/dev/null || echo '000')
                if [[ "$DL_CODE" == "200" ]] && [[ -s "$HOST_PRE_WIPE_PATH" ]]; then
                  echo "  ✓ pre-wipe ZIP saved to host : $HOST_PRE_WIPE_PATH ($(stat -c %s "$HOST_PRE_WIPE_PATH" 2>/dev/null) bytes)"
                  PRE_WIPE_BACKUP="$HOST_PRE_WIPE_PATH"
                else
                  echo "  ⚠  download FAILED (HTTP $DL_CODE) — ZIP will be lost when MinIO is wiped !"
                  rm -f "$HOST_PRE_WIPE_PATH" 2>/dev/null
                fi
              else
                echo "  ⚠  could not resolve backup id from filename — ZIP will be lost when MinIO is wiped !"
              fi
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

# ----------------------------- wipe (surgical) ----------------------------

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] $*"
    return 0
  else
    echo "  + $*"
    "$@" || true   # don't abort on individual failures (idempotent)
  fi
}

echo "--- Surgical wipe (v2 — no compose down) ---"

# 1. Stop + remove containers (whitelist explicit)
echo "[1/5] Stop + remove containers ..."
for c in "${XCH_CONTAINERS[@]}"; do
  if [[ "$DRY_RUN" == "true" ]] || docker container inspect "$c" >/dev/null 2>&1; then
    run docker stop "$c"
    run docker rm "$c"
  else
    echo "  (absent) $c"
  fi
done

# 2. Remove volumes (whitelist explicit)
echo "[2/5] Remove volumes ..."
for v in "${XCH_VOLUMES[@]}"; do
  if [[ "$DRY_RUN" == "true" ]] || docker volume inspect "$v" >/dev/null 2>&1; then
    run docker volume rm "$v"
  else
    echo "  (absent) $v"
  fi
done

# 3. Remove network (only if exists + no preserved container attached)
echo "[3/5] Remove network ..."
if [[ "$DRY_RUN" == "true" ]] || docker network inspect "$XCH_NETWORK" >/dev/null 2>&1; then
  # Check if any preserve-listed or unknown container is still attached
  ATTACHED=$(docker network inspect "$XCH_NETWORK" -f '{{range $k,$v := .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo '')
  if [[ -n "$ATTACHED" ]]; then
    echo "  ⚠  network $XCH_NETWORK still has attached containers : $ATTACHED"
    echo "  ⚠  leaving network in place (it's not in the strict wipe scope if outsiders use it)"
  else
    run docker network rm "$XCH_NETWORK"
  fi
else
  echo "  (absent) $XCH_NETWORK"
fi

# 4. .env rotation
echo "[4/5] Backend .env handling ..."
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

# 5. Post-wipe validation
echo "[5/5] Post-wipe validation ..."
POST_FAIL=0

# 5a. XCH containers gone
for c in "${XCH_CONTAINERS[@]}"; do
  if [[ "$DRY_RUN" == "false" ]] && docker container inspect "$c" >/dev/null 2>&1; then
    echo "  ✗ XCH container '$c' still present"
    POST_FAIL=$((POST_FAIL + 1))
  else
    echo "  ✓ wiped : $c"
  fi
done

# 5b. XCH volumes gone
for v in "${XCH_VOLUMES[@]}"; do
  if [[ "$DRY_RUN" == "false" ]] && docker volume inspect "$v" >/dev/null 2>&1; then
    echo "  ✗ XCH volume '$v' still present"
    POST_FAIL=$((POST_FAIL + 1))
  else
    echo "  ✓ wiped : $v"
  fi
done

# 5c. Preserve sentinels MUST still be alive (CRITICAL — v1 catastrophe diagnostic)
echo ""
echo "  Preserve sentinel verification (CRITICAL) :"
SENTINEL_FAIL=0
for c in "${PRESERVE_CONTAINERS[@]}"; do
  STATE=$(docker container inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo 'missing')
  if [[ "$STATE" == "running" ]]; then
    echo "  ✓ container $c : running"
  elif [[ "$STATE" == "missing" ]] && [[ "$PRESERVE_RUNNING" -eq 0 ]]; then
    # If sentinels were already missing pre-wipe (e.g. post-catastrophe recovery
    # state), don't penalize — operator knows.
    echo "  ⚠ container $c : missing (was already missing pre-wipe)"
  else
    echo "  ✗ container $c : $STATE (expected running)"
    SENTINEL_FAIL=$((SENTINEL_FAIL + 1))
  fi
done

GRAFANA_CODE_POST=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:3000 2>/dev/null || echo '000')
if [[ "$GRAFANA_CODE_POST" =~ ^(200|302|301|404)$ ]]; then
  echo "  ✓ Grafana host:3000 : HTTP $GRAFANA_CODE_POST (alive)"
elif [[ "$GRAFANA_CODE" == "000" ]]; then
  echo "  ⚠ Grafana host:3000 : HTTP $GRAFANA_CODE_POST (was also down pre-wipe — OK)"
else
  echo "  ✗ Grafana host:3000 : HTTP $GRAFANA_CODE_POST (was $GRAFANA_CODE pre-wipe — DEGRADED)"
  SENTINEL_FAIL=$((SENTINEL_FAIL + 1))
fi

# ----------------------------- summary ------------------------------------

echo ""
echo "==================================================="
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  DRY-RUN COMPLETE — no changes made"
  echo "  Would wipe : ${#PRESENT_CONTAINERS[@]} containers + ${#PRESENT_VOLUMES[@]} volumes"
elif [[ "$SENTINEL_FAIL" -gt 0 ]]; then
  echo "  ✗ TEARDOWN COMPLETED WITH PRESERVE SENTINEL FAILURE"
  echo "  $SENTINEL_FAIL preserve sentinels broken"
  echo "  → STOP immediately, audit défensif required"
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
  echo "    bash scripts/install-airgap.sh  # or manual equivalent"
  echo "    docker compose up -d"
fi
echo "==================================================="
