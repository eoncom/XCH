#!/usr/bin/env bash

##############################################################################
# gen-dsn.sh — Crée org + team + 3 projets dans GlitchTip et imprime les DSN.
#
# Approche : Django ORM via `docker exec <container> python manage.py shell`.
# Le rewrite v2 (S8 bootstrap) abandonne l'ancien flow HTTP API parce que :
#   - GlitchTip v4.x n'expose plus `/api/0/auth/login/` (Sentry-compat retirée),
#     migré vers django-allauth headless `/_allauth/app/v1/auth/login` ;
#   - les endpoints REST natifs orgs/teams/projects/keys ne sont pas documentés
#     officiellement et leur format diffère selon la version.
# L'ORM via shell est :
#   - one-shot bootstrap (pas de hot-path), donc le coupling à `apps.*` est OK ;
#   - version-pinné via l'image `glitchtip/glitchtip:v4.1` du compose ;
#   - idempotent par construction (filter().first() avant create) ;
#   - testable en dry-run (transaction rollback côté Python).
#
# Usage:
#   bash glitchtip/scripts/gen-dsn.sh [options]
#
# Options:
#   --container NAME        Container glitchtip-web cible (défaut: glitchtip-web)
#   --org-slug SLUG         Slug de l'org (défaut: xch)
#   --org-name NAME         Nom affiché de l'org (défaut: XCH)
#   --internal-host URL     Base URL DSN backend/worker (défaut: http://glitchtip-web:8000)
#   --public-host URL       Base URL DSN frontend     (défaut: https://glitch.eoncom.io)
#   --dry-run               N'écrit RIEN en DB, audit only
#   --json                  Sort uniquement le JSON brut (pas le résumé humain)
#   --env-file PATH         (réservé futur usage — actuellement non requis)
#
# Output (par défaut) :
#   1. Résumé humain : audit GET vs CREATE par ressource
#   2. Lignes prêtes à coller dans backend/.env, worker (=backend), frontend/.env
#   3. JSON structuré complet (audit + DSN + IDs)
#
# Pré-requis :
#   - docker disponible sur l'hôte
#   - container glitchtip-web running et migrations appliquées
#   - python3 (pour parser le JSON émis par le helper Python — pas de jq requis,
#     volontairement, pour rester sans dépendance externe sur le serveur)
##############################################################################

set -euo pipefail

CONTAINER="glitchtip-web"
ORG_SLUG="xch"
ORG_NAME="XCH"
INTERNAL_HOST="http://glitchtip-web:8000"
PUBLIC_HOST="https://glitch.eoncom.io"
DRY_RUN=0
JSON_ONLY=0

# Spec des projets : slug, platform tag, audience (internal=Docker network /
# public=browser-reachable). Choix audience par projet :
#  - backend (NestJS process serveur)        → internal
#  - worker  (BullMQ process serveur)        → internal
#  - frontend (Next.js — browser ET SSR)     → public (browser ne joint pas le réseau Docker)
PROJECTS_JSON='[
  {"slug":"xch-backend","platform":"node-nestjs","audience":"internal"},
  {"slug":"xch-worker","platform":"node","audience":"internal"},
  {"slug":"xch-frontend","platform":"javascript-nextjs","audience":"public"}
]'

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container)     CONTAINER="$2"; shift 2 ;;
    --org-slug)      ORG_SLUG="$2"; shift 2 ;;
    --org-name)      ORG_NAME="$2"; shift 2 ;;
    --internal-host) INTERNAL_HOST="$2"; shift 2 ;;
    --public-host)   PUBLIC_HOST="$2"; shift 2 ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --json)          JSON_ONLY=1; shift ;;
    --env-file)      shift 2 ;;  # réservé pour usage futur (lecture defaults)
    -h|--help)       sed -n '3,42p' "$0"; exit 0 ;;
    *)               echo "ERROR: argument inconnu: $1" >&2; exit 2 ;;
  esac
done

# --- Pré-requis ------------------------------------------------------------

for tool in docker python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: $tool requis" >&2; exit 1; }
done

docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}' | grep -qx "$CONTAINER" \
  || { echo "ERROR: container '$CONTAINER' pas running" >&2; exit 1; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY_HELPER="${REPO_ROOT}/glitchtip/scripts/_gen_dsn.py"
[[ -f "$PY_HELPER" ]] || { echo "ERROR: helper Python introuvable: $PY_HELPER" >&2; exit 1; }

# --- Run ORM via docker exec ----------------------------------------------

OUTPUT="$(
  docker exec -i \
    -e GEN_DSN_ORG_SLUG="$ORG_SLUG" \
    -e GEN_DSN_ORG_NAME="$ORG_NAME" \
    -e GEN_DSN_DRY_RUN="$DRY_RUN" \
    -e GEN_DSN_INTERNAL_HOST="$INTERNAL_HOST" \
    -e GEN_DSN_PUBLIC_HOST="$PUBLIC_HOST" \
    -e GEN_DSN_PROJECTS_JSON="$PROJECTS_JSON" \
    "$CONTAINER" python manage.py shell < "$PY_HELPER"
)" || {
  echo "ERROR: docker exec a échoué — output ci-dessous :" >&2
  echo "$OUTPUT" >&2
  exit 1
}

# Extract JSON between markers — défensif vs. warnings Django shell pollués.
JSON="$(echo "$OUTPUT" | awk '/===GEN_DSN_JSON_BEGIN===/{flag=1; next} /===GEN_DSN_JSON_END===/{flag=0} flag')"

if [[ -z "$JSON" ]]; then
  echo "ERROR: marqueurs ===GEN_DSN_JSON_BEGIN/END=== absents" >&2
  echo "Output brut :" >&2
  echo "$OUTPUT" >&2
  exit 1
fi

# Validation JSON + détection erreur côté helper Python.
# Pattern `python3 -c "$(cat <<'PYEOF' ... PYEOF)"` permet d'avoir un script
# Python multi-ligne PROPRE sans casser l'interpolation (single-quoted heredoc
# delimiter = bash ne touche à rien) tout en gardant stdin libre pour le JSON.
echo "$JSON" | python3 -c "$(cat <<'PYEOF'
import json, sys
try:
    data = json.load(sys.stdin)
except Exception as e:
    print(f"ERROR: JSON invalide entre marqueurs: {e}", file=sys.stderr)
    sys.exit(1)
if "error" in data:
    print("ERROR: helper Python a renvoyé une erreur:", file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(1)
PYEOF
)" || exit 1

# --- Output ---------------------------------------------------------------

if [[ "$JSON_ONLY" -eq 1 ]]; then
  echo "$JSON"
  exit 0
fi

# Format humain via python3 — même pattern `python3 -c "$(cat <<'PYEOF' ...)"`.
echo "$JSON" | python3 -c "$(cat <<'PYEOF'
import json, sys
data = json.load(sys.stdin)
dry = data.get("dry_run", False)
org = data["org"]
team = data["team"]

print("=== gen-dsn.sh — résumé ===")
org_id = org.get("id")
team_id = team.get("id")
org_status = f"(id={org_id})" if org_id else "(would create)"
team_status = f"(id={team_id})" if team_id else "(would create)"
print(f"Org slug   : {org['slug']} {org_status}")
print(f"Team slug  : {team['slug']} {team_status}")
print(f"Dry-run    : {dry}")

print("")
print("=== Audit ===")
for entry in data["audit"]:
    key_str = json.dumps(entry.get("key", {}), separators=(",", ":"))
    print(f"  {entry['action']:<14} {entry['type']:<14} {key_str}")

print("")
print("=== DSN par projet ===")
for slug, info in data.get("dsns", {}).items():
    print(f"  - {slug} [{info['audience']}, {info['platform']}, project_id={info['project_id']}]")
    print(f"      {info['dsn']}")

if not dry:
    print("")
    print("=== Env vars prêtes à coller ===")
    dsns = data.get("dsns", {})
    print("# backend/.env")
    if "xch-backend" in dsns:
        print(f"GLITCHTIP_DSN_BACKEND={dsns['xch-backend']['dsn']}")
    print("# (worker partage le même conteneur env que backend en pratique)")
    if "xch-worker" in dsns:
        print(f"GLITCHTIP_DSN_WORKER={dsns['xch-worker']['dsn']}")
    print("# frontend/.env (NEXT_PUBLIC_* car exposé au browser)")
    if "xch-frontend" in dsns:
        print(f"NEXT_PUBLIC_GLITCHTIP_DSN_FRONTEND={dsns['xch-frontend']['dsn']}")
PYEOF
)"

echo ""
echo "=== JSON brut (machine-readable) ==="
echo "$JSON"
