#!/bin/bash
# XCH v1.3 — Smoke test (read-only)
# Validates login + critical endpoints.
#
# Usage:
#   bash scripts/smoke-v1.3.sh [BASE_URL] [EMAIL] [PASSWORD]
# Defaults:
#   BASE_URL  = http://localhost:3000
#   EMAIL     = admin@xch.local
#   PASSWORD  = admin

set -u

BASE_URL="${1:-http://localhost:3000}"
EMAIL="${2:-admin@xch.local}"
PASSWORD="${3:-admin}"

COOKIE_JAR="$(mktemp)"
trap 'rm -f "$COOKIE_JAR"' EXIT

PASS=0
FAIL=0

check() {
  local label="$1"; shift
  local expected="$1"; shift
  local url="$1"; shift
  local method="${1:-GET}"; shift || true

  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -X "$method" "$BASE_URL$url" "$@")

  if [[ "$code" == "$expected" ]]; then
    echo "  OK  [$code] $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL [$code, expected $expected] $label ($url)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== XCH v1.3 smoke test ==="
echo "BASE_URL = $BASE_URL"
echo ""

# ---------- Auth ----------
echo "--- Auth ---"
LOGIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" \
  -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login")

if [[ "$LOGIN_CODE" != "200" && "$LOGIN_CODE" != "201" ]]; then
  echo "  FAIL [$LOGIN_CODE] login as $EMAIL — aborting further checks"
  exit 1
fi
echo "  OK  [$LOGIN_CODE] login as $EMAIL"
PASS=$((PASS + 1))

check "session /me" 200 "/api/auth/me"

# ---------- Core read endpoints ----------
echo ""
echo "--- Core read ---"
check "list sites" 200 "/api/sites"
check "list assets" 200 "/api/assets"
check "list racks" 200 "/api/racks"
check "list tasks" 200 "/api/tasks"
check "list contacts" 200 "/api/contacts"
check "list floor-plans" 200 "/api/floor-plans"

# ---------- v1.3 new ----------
echo ""
echo "--- v1.3 new features ---"
check "global search" 200 "/api/search?q=test&limit=5"
check "asset models list" 200 "/api/asset-models"
check "budgets list" 200 "/api/budgets"
check "connectivity list" 200 "/api/connectivity"
check "consumption summary" 200 "/api/consumption/summary"
check "expenses projection" 200 "/api/expenses/projection?from=2026-01&to=2026-12"
check "notifications inbox" 200 "/api/notifications/inbox/me"
check "notifications count-unread" 200 "/api/notifications/inbox/count-unread"
check "asset import template" 200 "/api/assets/import/template"
check "audit log query" 200 "/api/audit?pageSize=5"

echo ""
echo "============================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "============================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
