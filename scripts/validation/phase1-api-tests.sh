#!/bin/bash
# Phase 1A - Empty state validation via API (cookie-based auth)
set -u

BASE="http://localhost:3002/api"
ADMIN_EMAIL="test-admin@eoncom.io"
ADMIN_PASS="TestAdmin2026"
CJA="/tmp/xch-admin.cookies"
CJM="/tmp/xch-manager.cookies"
rm -f "$CJA" "$CJM"

pass=0; fail=0; warn=0
declare -a findings

log() { echo "[$(date +%H:%M:%S)] $*"; }
check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass=$((pass+1)); log "PASS  [$actual] $label"
  else
    fail=$((fail+1)); findings+=("FAIL [$label] expected=$expected actual=$actual")
    log "FAIL  [$actual vs $expected] $label"
  fi
}
warn() { warn=$((warn+1)); findings+=("WARN [$1]"); log "WARN  $1"; }

# Auth admin
log "=== ADMIN LOGIN ==="
LOGIN_CODE=$(curl -sS -c "$CJA" -o /tmp/login.json -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
check "admin login 201" "201" "$LOGIN_CODE"
grep -q accessToken "$CJA" && log "accessToken cookie set" || { echo "NO COOKIE"; exit 1; }

# Wrong password
BAD=$(curl -sS -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"wrong\"}")
check "wrong password rejected 401" "401" "$BAD"

# SQL injection
SQLI=$(curl -sS -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@x.io' OR '1'='1\",\"password\":\"x\"}")
check "SQL injection rejected 401" "401" "$SQLI"

# Perm check
PC=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" $BASE/auth/my-permissions)
check "my-permissions 200" "200" "$PC"

# Delegations
log "=== DELEGATIONS ==="
DEL_LIST=$(curl -sS -b "$CJA" $BASE/delegations)
DEL1_ID=$(echo "$DEL_LIST" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
log "Existing delegation id: $DEL1_ID"

DEL2_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/delegations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Delegation 2","code":"TEST-2","groupLabel":"Test Group","groupColor":"#ef4444"}')
DEL2_CODE=$(echo "$DEL2_OUT" | tail -1)
DEL2_BODY=$(echo "$DEL2_OUT" | head -n -1)
check "create delegation 201" "201" "$DEL2_CODE"
DEL2_ID=$(echo "$DEL2_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

DUP=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/delegations \
  -H "Content-Type: application/json" \
  -d '{"name":"Dup","code":"TEST-2"}')
[ "$DUP" = "409" ] || warn "duplicate delegation code returns $DUP (expected 409)"

MIS=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/delegations \
  -H "Content-Type: application/json" -d '{}')
check "empty delegation rejected 400" "400" "$MIS"

# Sites
log "=== SITES ==="
NOHDR=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/sites \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"x\",\"code\":\"x\",\"delegationId\":\"$DEL1_ID\",\"city\":\"P\",\"country\":\"FR\",\"status\":\"ACTIVE\"}")
log "Site create WITHOUT X-Delegation-Id: $NOHDR (expect 400 per R10)"

SITE_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/sites \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Site API Test\",\"code\":\"API-001\",\"delegationId\":\"$DEL1_ID\",\"city\":\"Paris\",\"country\":\"France\",\"address\":\"1 rue test\",\"postalCode\":\"75001\",\"status\":\"ACTIVE\"}")
SITE_CODE=$(echo "$SITE_OUT" | tail -1)
SITE_BODY=$(echo "$SITE_OUT" | head -n -1)
check "create site 201" "201" "$SITE_CODE"
SITE_ID=$(echo "$SITE_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
log "Site: $SITE_ID, body preview: $(echo "$SITE_BODY" | head -c 200)"

# R1 check: mismatch delegationId vs X-Delegation-Id
R1=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/sites \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Mis\",\"code\":\"MIS-001\",\"delegationId\":\"$DEL2_ID\",\"city\":\"P\",\"country\":\"FR\",\"status\":\"ACTIVE\"}")
log "R1 mismatch delegationId vs header: $R1 (expect 400 or 403)"

DUP_SITE=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/sites \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Dup\",\"code\":\"API-001\",\"delegationId\":\"$DEL1_ID\",\"city\":\"P\",\"country\":\"FR\",\"status\":\"ACTIVE\"}")
[ "$DUP_SITE" = "409" ] || warn "duplicate site code returns $DUP_SITE (expected 409)"

# Assets
log "=== ASSETS ==="
ASSET_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/assets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Switch\",\"type\":\"SWITCH\",\"manufacturer\":\"Cisco\",\"model\":\"C9200\",\"serialNumber\":\"SN001\",\"siteId\":\"$SITE_ID\",\"status\":\"IN_SERVICE\"}")
ASSET_CODE=$(echo "$ASSET_OUT" | tail -1)
ASSET_BODY=$(echo "$ASSET_OUT" | head -n -1)
check "create asset 201" "201" "$ASSET_CODE"
ASSET_ID=$(echo "$ASSET_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

BAD_TYPE=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/assets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Bad\",\"type\":\"INVALID_TYPE\",\"serialNumber\":\"SN002\",\"siteId\":\"$SITE_ID\",\"status\":\"IN_SERVICE\"}")
log "Invalid asset type: $BAD_TYPE (expect 400)"

BAD_STATUS=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/assets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Bad\",\"type\":\"SWITCH\",\"serialNumber\":\"SN003\",\"siteId\":\"$SITE_ID\",\"status\":\"INVALID\"}")
log "Invalid asset status: $BAD_STATUS (expect 400)"

DUP_SN=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/assets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Dup SN\",\"type\":\"SWITCH\",\"serialNumber\":\"SN001\",\"siteId\":\"$SITE_ID\",\"status\":\"IN_SERVICE\"}")
[ "$DUP_SN" = "409" ] || warn "duplicate serial returns $DUP_SN (expected 409)"

XSS=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/assets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"<script>alert(1)</script>\",\"type\":\"OTHER\",\"serialNumber\":\"SN-XSS\",\"siteId\":\"$SITE_ID\",\"status\":\"IN_SERVICE\"}")
XSS_CODE=$(echo "$XSS" | tail -1)
XSS_BODY=$(echo "$XSS" | head -n -1)
log "XSS payload result: $XSS_CODE (check if escaped on render)"

# Racks
log "=== RACKS ==="
RACK_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/racks \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Rack Test\",\"type\":\"RACK_42U\",\"uHeight\":42,\"siteId\":\"$SITE_ID\",\"status\":\"ACTIVE\"}")
RACK_CODE=$(echo "$RACK_OUT" | tail -1)
RACK_BODY=$(echo "$RACK_OUT" | head -n -1)
check "create rack 201" "201" "$RACK_CODE"
RACK_ID=$(echo "$RACK_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

BAD_U=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/racks \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Bad U\",\"type\":\"RACK_42U\",\"uHeight\":99999,\"siteId\":\"$SITE_ID\",\"status\":\"ACTIVE\"}")
log "Rack absurd uHeight (99999): $BAD_U"

# Tasks
log "=== TASKS ==="
TASK=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/tasks \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"title\":\"Test Task\",\"status\":\"TODO\",\"priority\":\"HIGH\",\"siteId\":\"$SITE_ID\"}")
check "create task 201" "201" "$TASK"

# Contacts
log "=== CONTACTS ==="
CT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" $BASE/contact-types -H "X-Delegation-Id: $DEL1_ID")
log "contact-types GET: $CT"

CT_NEW=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/contact-types \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d '{"name":"Test Type","slug":"test-type","category":"PROVIDER"}')
CT_CODE=$(echo "$CT_NEW" | tail -1)
CT_BODY=$(echo "$CT_NEW" | head -n -1)
check "create contact type 201" "201" "$CT_CODE"
CT_ID=$(echo "$CT_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -n "$CT_ID" ]; then
  CONTACT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/contacts \
    -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Contact\",\"contactTypeId\":\"$CT_ID\",\"email\":\"contact@test.io\"}")
  check "create contact 201" "201" "$CONTACT"
fi

# Billing & Expenses
log "=== BILLING & EXPENSES ==="
BE_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/billing-entities \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d '{"name":"Test Entity","type":"INTERNAL"}')
BE_CODE=$(echo "$BE_OUT" | tail -1)
BE_BODY=$(echo "$BE_OUT" | head -n -1)
check "create billing entity 201" "201" "$BE_CODE"
BE_ID=$(echo "$BE_BODY" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

if [ -n "$BE_ID" ]; then
  EXP=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/expenses \
    -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
    -d "{\"label\":\"Test Expense\",\"amount\":100.50,\"currency\":\"EUR\",\"type\":\"SUBSCRIPTION\",\"frequency\":\"MONTHLY\",\"billingEntityId\":\"$BE_ID\",\"startDate\":\"2026-01-01\"}")
  log "create expense: $EXP"
fi

BUDGET=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/budgets \
  -H "X-Delegation-Id: $DEL1_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Budget\",\"period\":\"MONTH\",\"delegationId\":\"$DEL1_ID\",\"amount\":5000,\"startDate\":\"2026-01-01\"}")
log "create budget: $BUDGET"

# Search
log "=== SEARCH ==="
S1=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/search?q=Test" -H "X-Delegation-Id: $DEL1_ID")
check "global search 200" "200" "$S1"
S2=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/search?q=" -H "X-Delegation-Id: $DEL1_ID")
log "Empty search: $S2"
S3=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/search?q=%27%20OR%201%3D1" -H "X-Delegation-Id: $DEL1_ID")
log "SQL-like search: $S3"

# Audit
log "=== AUDIT ==="
AU=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" $BASE/audit -H "X-Delegation-Id: $DEL1_ID")
check "audit 200" "200" "$AU"

# Notifications
NOTIF=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" $BASE/notifications/inbox/me -H "X-Delegation-Id: $DEL1_ID")
check "notifications inbox 200" "200" "$NOTIF"

# Users + RBAC
log "=== USERS ==="
MGR_OUT=$(curl -sS -b "$CJA" -w "\n%{http_code}" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"email":"manager-test@eoncom.io","name":"Manager Test","password":"Manager2026"}')
MGR_CODE=$(echo "$MGR_OUT" | tail -1)
MGR_BODY=$(echo "$MGR_OUT" | head -n -1)
check "create manager user 201" "201" "$MGR_CODE"
log "Manager creation body: $(echo "$MGR_BODY" | head -c 200)"

SHORT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"email":"short@eoncom.io","name":"Short","password":"short"}')
log "Short password (5 chars): $SHORT (expect 400)"

WEAK=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"email":"weak@eoncom.io","name":"Weak","password":"12345678"}')
log "Weak password no-complexity (12345678): $WEAK (expect 400 per regex)"

NOCPLX=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"email":"nocplx@eoncom.io","name":"NC","password":"password"}')
log "Password no digit (password): $NOCPLX"

DUP_E=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
  -H "Content-Type: application/json" \
  -d '{"email":"manager-test@eoncom.io","name":"Dup","password":"Valid2026"}')
[ "$DUP_E" = "409" ] || warn "duplicate email returns $DUP_E (expected 409)"

# RBAC: manager login
log "=== RBAC MANAGER ==="
ML=$(curl -sS -c "$CJM" -o /tmp/mgr-login.json -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager-test@eoncom.io","password":"Manager2026"}')
check "manager login 201" "201" "$ML"

if grep -q accessToken "$CJM" 2>/dev/null; then
  M_SITES=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" $BASE/sites)
  log "Manager /sites WITHOUT header: $M_SITES (expect 400)"
  M_SITES_H=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" $BASE/sites -H "X-Delegation-Id: $DEL1_ID")
  log "Manager /sites WITH header (no delegation assigned yet): $M_SITES_H (expect 403)"
  M_USER=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
    -H "Content-Type: application/json" \
    -d '{"email":"hack@x.io","name":"Hack","password":"Valid2026","role":"ADMIN"}')
  [ "$M_USER" = "403" ] || warn "manager can create user? code=$M_USER (expected 403)"
  M_DEL=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" -X DELETE "$BASE/delegations/$DEL1_ID")
  log "Manager deletes delegation: $M_DEL (expected 403)"
fi

# Security headers
log "=== SECURITY HEADERS ==="
HDR_SCAN=$(curl -sI -b "$CJA" $BASE/sites -H "X-Delegation-Id: $DEL1_ID")
for h in "X-Content-Type-Options" "X-Frame-Options" "Strict-Transport-Security" "Content-Security-Policy" "Referrer-Policy"; do
  if echo "$HDR_SCAN" | grep -qi "^$h"; then
    log "OK:   $h"
  else
    warn "Missing security header: $h"
  fi
done

# Rate limiting on login
log "=== RATE LIMIT (20 wrong logins) ==="
RL_429=0
for i in $(seq 1 20); do
  c=$(curl -sS -o /dev/null -w "%{http_code}" -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"rl-$i@x.io\",\"password\":\"wrong\"}")
  [ "$c" = "429" ] && RL_429=$((RL_429+1))
done
if [ $RL_429 -eq 0 ]; then warn "No rate limit on login (20 req, 0× 429)"; else log "Rate limit fired $RL_429×"; fi

# Unauthenticated endpoint probing
log "=== UNAUTH PROBE ==="
for ep in sites assets racks tasks users audit search notifications/inbox/me delegations; do
  c=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/$ep")
  if [ "$c" != "401" ] && [ "$c" != "403" ]; then warn "Endpoint $ep unauth returns $c (expected 401/403)"; fi
done

echo ""
echo "==================== SUMMARY ===================="
echo "PASS: $pass | FAIL: $fail | WARN: $warn"
echo ""
echo "FINDINGS:"
printf '  %s\n' "${findings[@]}"
