#!/usr/bin/env bash

##############################################################################
# smoke-prod.sh — Smoke test prod XCH après tag ou rollback.
#
# Vérifie 5 endpoints publics (sans authentification) avec leur code HTTP
# attendu. Exit 0 si tout matche, 1 sinon avec rapport détaillé.
#
# Usage:
#   bash scripts/smoke-prod.sh                                    # défaut: https://xch.eoncom.io
#   bash scripts/smoke-prod.sh https://other.host
#   bash scripts/smoke-prod.sh --timeout 10
#
# 6 endpoints (pattern 307/200/401/401/200/200) :
#   GET /                         → 307  (redirect login ou dashboard)
#   GET /login                    → 200  (page login renderée)
#   GET /api/auth/session         → 401  (session check sans cookie)
#   GET /api/auth/profile         → 401  (auth-required sans cookie)
#   GET /api/setup/status         → 200  (public, pas d'auth — sert aussi de health)
#   GET /api/health               → 200  (Track E.2 — readiness probe DB+Redis+MinIO, 503 si degraded)
#
# Rationale du choix des paths :
# - 2 frontend (`/`, `/login`) : prouve que Next.js sert les pages, le
#   redirect est en place, et le bundle hydrate.
# - 2 API auth (401) : prouve que NestJS répond, JwtAuthGuard est actif,
#   et les routes auth sont bien mountées sous `/api/auth/*`.
# - 1 API publique (`/api/setup/status` = 200) : prouve qu'un endpoint
#   `@Public()` accessible sans cookie répond — sanity du chemin
#   complet PermissionGuard fail-closed (il n'a PAS bloqué un endpoint
#   public, ce qui serait un faux positif RBAC).
##############################################################################

set -uo pipefail

BASE_URL="https://xch.eoncom.io"
TIMEOUT=10

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    -h|--help)  sed -n '3,32p' "$0"; exit 0 ;;
    -*)         echo "ERROR: argument inconnu: $1" >&2; exit 2 ;;
    *)          BASE_URL="$1"; shift ;;
  esac
done

# 5 lignes "PATH:EXPECTED_CODE:LABEL" — colonne séparée par `:`
CHECKS=(
  "/:307:root redirect (login ou dashboard)"
  "/login:200:login page render"
  "/api/auth/session:401:auth required (sans cookie)"
  "/api/auth/profile:401:auth required (sans cookie)"
  "/api/setup/status:200:setup status public"
  "/api/health:200:readiness probe (Track E.2 Pass 2)"
)

FAIL=0
PASS=0

echo "=== Smoke prod XCH — ${BASE_URL} ==="
echo ""

for spec in "${CHECKS[@]}"; do
  path="${spec%%:*}"
  rest="${spec#*:}"
  expected="${rest%%:*}"
  label="${rest#*:}"

  actual=$(curl -sS -o /dev/null --max-time "$TIMEOUT" -w "%{http_code}" "${BASE_URL}${path}" 2>&1 || echo "ERR")

  if [[ "$actual" == "$expected" ]]; then
    echo "✓ ${actual} — GET ${path}  (${label})"
    PASS=$((PASS + 1))
  else
    echo "✗ ${actual} — GET ${path}  (attendu ${expected}: ${label})"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "═══════════════════════════════════════════════"
TOTAL=${#CHECKS[@]}
if [[ $FAIL -eq 0 ]]; then
  echo "✓ SMOKE PASS — ${PASS}/${TOTAL}"
  exit 0
else
  echo "✗ SMOKE FAIL — ${FAIL}/${TOTAL} endpoint(s) inattendu(s)"
  exit 1
fi
