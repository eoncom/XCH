#!/bin/bash
# =============================================================================
# XCH — Full Restore Script (backup v2 ZIP format)
#
# Track E.2 Pass 6 — modernization of the legacy v1 tar.gz script.
# The previous version expected tar.gz + db.dump + minio/ folders which is
# incompatible with backup v2 (ADR-025 streaming ZIP — single archive with
# data/*.json per table + minio/<bucket>/<key> entries + metadata.json).
#
# Two modes :
#   --mode=api  (default) : POST to /api/backup/full/restore-upload (multipart)
#                            via the running backend. Idempotent, async Bull job,
#                            uses the shared volume xch-upload-staging (v2.3.1
#                            hotfix per XCH_INTER_CONTAINER_ASSUMPTIONS).
#   --mode=cli  (fallback) : pure-shell extract + psql + mc — used when the
#                            backend is DOWN (real DR scenario, can't call API).
#                            Requires `mc` (MinIO Client) installed on host.
#
# Usage :
#   ./scripts/restore-full.sh <backup.zip> [--mode=api|cli] [--dry-run]
#   ./scripts/restore-full.sh <backup.zip> <sidecar.enc.json>   # encrypted backup
#
# Examples :
#   ./scripts/restore-full.sh ./backups/full-backup-v2-2026-05-16T10-09-09.zip
#   ./scripts/restore-full.sh /tmp/recovered.zip /tmp/recovered.zip.enc.json
#   ./scripts/restore-full.sh /tmp/recovered.zip --mode=cli --dry-run
#
# WARNING : a real restore OVERWRITES tenant data via Prisma upsertByNaturalKey
# (skip-if-exists semantic per ADR-025 §D). Per XCH_DEMO_DATA_PRINCIPLE, this is
# safe on xch-deploy ; on prod employeur, confirm before running.
# =============================================================================

set -euo pipefail

# ------------------------------- arg parsing --------------------------------

usage() {
  sed -n '1,30p' "$0"
  exit 1
}

BACKUP_FILE=""
SIDECAR_FILE=""
MODE="api"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode=*)   MODE="${1#--mode=}"; shift ;;
    --dry-run)  DRY_RUN="true"; shift ;;
    -h|--help)  usage ;;
    -*)         echo "ERROR: unknown flag $1" >&2; exit 2 ;;
    *.zip|*.ZIP)
                if [[ -z "$BACKUP_FILE" ]]; then BACKUP_FILE="$1"; else echo "ERROR: multiple .zip args" >&2; exit 2; fi
                shift ;;
    *.json|*.JSON)
                SIDECAR_FILE="$1"; shift ;;
    *)          echo "ERROR: unrecognized arg $1" >&2; exit 2 ;;
  esac
done

[[ -z "$BACKUP_FILE" ]] && { echo "ERROR: backup .zip required" >&2; usage; }
[[ ! -f "$BACKUP_FILE" ]] && { echo "ERROR: backup file not found: $BACKUP_FILE" >&2; exit 1; }
[[ -n "$SIDECAR_FILE" && ! -f "$SIDECAR_FILE" ]] && { echo "ERROR: sidecar not found: $SIDECAR_FILE" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env if present (POSTGRES_*, MINIO_*, ADMIN_EMAIL/PASSWORD overrides)
[[ -f "$PROJECT_DIR/backend/.env" ]] && set +u && source "$PROJECT_DIR/backend/.env" && set -u

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-xch-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-xch-minio}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-xch-backend}"
DB_NAME="${POSTGRES_DB:-xch_dev}"
DB_USER="${POSTGRES_USER:-xch_user}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3002}"
ADMIN_EMAIL="${RESTORE_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${RESTORE_ADMIN_PASSWORD:-}"

echo "==================================================="
echo "  XCH Full Restore (backup v2)"
echo "  $(date -Iseconds)"
echo "==================================================="
echo ""
echo "  Backup file  : $BACKUP_FILE"
echo "  Sidecar      : ${SIDECAR_FILE:-<plaintext>}"
echo "  Mode         : $MODE"
echo "  Dry-run      : $DRY_RUN"
echo ""

# Magic byte check — backup v2 must be a PKZip archive (50 4B 03 04)
MAGIC=$(head -c 4 "$BACKUP_FILE" | od -An -tx1 | tr -d ' \n')
if [[ "$MAGIC" != "504b0304" && -z "$SIDECAR_FILE" ]]; then
  echo "ERROR: file is not a PKZip archive (magic=$MAGIC) and no sidecar provided." >&2
  echo "       Either the file is encrypted (pass the .enc.json sidecar as 2nd arg)" >&2
  echo "       or it is corrupted." >&2
  exit 1
fi

# ------------------------------- mode=api -----------------------------------

restore_via_api() {
  echo "[1/3] Authenticating to $BACKEND_URL ..."
  if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
    echo "  ERROR: set RESTORE_ADMIN_EMAIL + RESTORE_ADMIN_PASSWORD env vars (or admin@/demo)." >&2
    exit 1
  fi

  COOKIES=$(mktemp)
  trap 'rm -f "$COOKIES"' EXIT

  HTTP_CODE=$(curl -sS -c "$COOKIES" -o /dev/null -w "%{http_code}" \
    -X POST "$BACKEND_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

  if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
    echo "  ERROR: auth failed (HTTP $HTTP_CODE)." >&2
    exit 1
  fi
  echo "  → auth OK"

  echo "[2/3] Uploading backup via multipart restore-upload ..."
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] would POST $BACKUP_FILE${SIDECAR_FILE:+ + $SIDECAR_FILE} → $BACKEND_URL/api/backup/full/restore-upload"
    return 0
  fi

  CURL_FILES=(-F "file=@$BACKUP_FILE")
  [[ -n "$SIDECAR_FILE" ]] && CURL_FILES+=(-F "sidecar=@$SIDECAR_FILE")

  RESP=$(curl -sS -b "$COOKIES" \
    -X POST "$BACKEND_URL/api/backup/full/restore-upload" \
    "${CURL_FILES[@]}")
  JOB_ID=$(echo "$RESP" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("jobId",""))' 2>/dev/null || true)

  if [[ -z "$JOB_ID" ]]; then
    echo "  ERROR: no jobId in response: $RESP" >&2
    exit 1
  fi
  echo "  → enqueued jobId=$JOB_ID"

  echo "[3/3] Polling job state (timeout 300s) ..."
  for i in $(seq 1 150); do
    JOB=$(curl -sS -b "$COOKIES" "$BACKEND_URL/api/backup/jobs/$JOB_ID")
    STATE=$(echo "$JOB" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("state","?"))')
    PCT=$(echo "$JOB" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("progress",{}).get("percent",0))' 2>/dev/null || echo "?")
    echo "  poll #$i state=$STATE progress=${PCT}%"
    if [[ "$STATE" == "completed" ]]; then
      echo "  ✓ restore completed."
      echo "  Full response:"
      echo "$JOB" | python3 -m json.tool 2>/dev/null || echo "$JOB"
      return 0
    fi
    if [[ "$STATE" == "failed" ]]; then
      echo "  ✗ restore failed." >&2
      echo "$JOB" | python3 -m json.tool 2>/dev/null || echo "$JOB"
      exit 1
    fi
    sleep 2
  done
  echo "  ✗ timeout after 300s." >&2
  exit 1
}

# ------------------------------- mode=cli -----------------------------------

restore_via_cli() {
  echo "[1/5] Extracting ZIP to staging ..."
  STAGING="/tmp/xch-restore-$(date +%s)"
  mkdir -p "$STAGING"
  trap 'rm -rf "$STAGING"' EXIT

  if [[ -n "$SIDECAR_FILE" ]]; then
    echo "  ERROR: --mode=cli does not support encrypted backups (needs XCH_MASTER_KEY runtime)." >&2
    echo "         Use --mode=api or decrypt first via backend container." >&2
    exit 1
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [dry-run] would unzip $BACKUP_FILE to $STAGING"
    echo "  [dry-run] would invoke psql + mc per bucket. (skip)"
    return 0
  fi

  unzip -q "$BACKUP_FILE" -d "$STAGING"
  echo "  → extracted to $STAGING"

  echo "[2/5] Backend MUST be stopped for cli mode (avoid concurrent writes) ..."
  echo "  Stop backend: docker compose stop backend backend-worker"
  read -r -p "  Press <enter> once backend is stopped (or Ctrl-C to abort): " _

  echo "[3/5] Restoring data tables (this is a STUB — full v2 cli importer not yet implemented) ..."
  echo "  data/*.json count: $(ls "$STAGING/data/" 2>/dev/null | wc -l)"
  echo "  Per ADR-025 the v1 pg_restore path is INCOMPATIBLE with v2 JSON tables."
  echo "  For v2 cli restore, build a Prisma seed-style importer (Track E.4 backlog)."
  echo "  TODO : implement json→Prisma upsert loader for cli mode, or fall back to --mode=api once backend is back up."
  echo "  Skipping data restore (dry-equivalent for now)."

  echo "[4/5] Restoring MinIO buckets via mc mirror ..."
  for bucket_dir in "$STAGING/minio"/*/; do
    [[ -d "$bucket_dir" ]] || continue
    bucket=$(basename "$bucket_dir")
    echo "  → mc mirror $bucket_dir minio/$bucket  (TODO : wire mc alias)"
  done

  echo "[5/5] Restart backend: docker compose up -d backend backend-worker"
  echo ""
  echo "  ⚠  cli mode is a partial implementation in this release."
  echo "     Recommended : use --mode=api after restoring backend, OR call the backend's"
  echo "     POST /api/backup/full/restore-upload directly from another machine."
}

# --------------------------------- main -------------------------------------

case "$MODE" in
  api)  restore_via_api ;;
  cli)  restore_via_cli ;;
  *)    echo "ERROR: unknown mode '$MODE' (use api|cli)" >&2; exit 2 ;;
esac

echo ""
echo "==================================================="
echo "  Restore completed at $(date -Iseconds)"
echo "  Next step : bash scripts/smoke-prod.sh <DEPLOY_DOMAIN>"
echo "==================================================="
