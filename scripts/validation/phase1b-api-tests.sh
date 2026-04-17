#!/bin/bash
# Phase 1B - Seeded data validation via API
# Run AFTER setup with loadDemoData=true
set -u

BASE="http://localhost:3002/api"
ADMIN_EMAIL="test-admin@eoncom.io"
ADMIN_PASS="TestAdmin2026"
CJA="/tmp/xch-1b-admin.cookies"
CJM="/tmp/xch-1b-mgr.cookies"
CJT="/tmp/xch-1b-tech.cookies"
rm -f "$CJA" "$CJM" "$CJT"

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

log "================================================================"
log "PHASE 1B — Tests with demo data loaded"
log "================================================================"

# Admin login
LC=$(curl -sS -c "$CJA" -o /tmp/1b-login.json -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
check "admin login" "201" "$LC"

# GET all primary resources
log "=== READ LIST ==="
for ep in sites assets racks tasks delegations users contacts contact-types billing-entities expenses budgets audit notifications/inbox/me; do
  code=$(curl -sS -b "$CJA" -o /tmp/last.json -w "%{http_code}" "$BASE/$ep")
  cnt=$(grep -oE '"id":"[^"]+"' /tmp/last.json | wc -l)
  if [ "$code" = "200" ]; then
    pass=$((pass+1)); log "PASS  [$code, $cnt items] GET $ep"
  else
    fail=$((fail+1)); findings+=("FAIL GET $ep → $code"); log "FAIL  [$code] GET $ep"
  fi
done

# Get IDs for subsequent tests
SITE_ID=$(curl -sS -b "$CJA" $BASE/sites | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
DEL_ID=$(curl -sS -b "$CJA" $BASE/delegations | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
ASSET_ID=$(curl -sS -b "$CJA" $BASE/assets -H "X-Delegation-Id: $DEL_ID" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
RACK_ID=$(curl -sS -b "$CJA" $BASE/racks -H "X-Delegation-Id: $DEL_ID" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
TASK_ID=$(curl -sS -b "$CJA" $BASE/tasks -H "X-Delegation-Id: $DEL_ID" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
USER_ID=$(curl -sS -b "$CJA" $BASE/users | grep -oE '"id":"[^"]+"' | head -2 | tail -1 | cut -d'"' -f4)
log "IDs: site=$SITE_ID del=$DEL_ID asset=$ASSET_ID rack=$RACK_ID task=$TASK_ID user=$USER_ID"

# === READ individual ===
log "=== READ DETAIL ==="
check "GET /sites/:id" "200" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/sites/$SITE_ID" -H "X-Delegation-Id: $DEL_ID")"
check "GET /assets/:id" "200" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/assets/$ASSET_ID" -H "X-Delegation-Id: $DEL_ID")"
check "GET /racks/:id" "200" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/racks/$RACK_ID" -H "X-Delegation-Id: $DEL_ID")"
check "GET /tasks/:id" "200" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/tasks/$TASK_ID" -H "X-Delegation-Id: $DEL_ID")"

# Bad IDs
log "=== INVALID IDs ==="
check "GET /sites/nonexistent 404" "404" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/sites/nonexistent-id" -H "X-Delegation-Id: $DEL_ID")"
check "GET /assets/nonexistent 404" "404" "$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/assets/nonexistent-id" -H "X-Delegation-Id: $DEL_ID")"

# === UPDATE ===
log "=== UPDATE ==="
U_SITE=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X PATCH "$BASE/sites/$SITE_ID" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d '{"notes":"Updated via test API"}')
check "PATCH /sites/:id" "200" "$U_SITE"

U_ASSET=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X PATCH "$BASE/assets/$ASSET_ID" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d '{"notes":"Updated"}')
check "PATCH /assets/:id" "200" "$U_ASSET"

U_TASK=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X PATCH "$BASE/tasks/$TASK_ID" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}')
check "PATCH /tasks/:id status→IN_PROGRESS" "200" "$U_TASK"

# === WORKFLOWS ===
log "=== WORKFLOWS ==="
# Asset movement between sites
OTHER_SITE=$(curl -sS -b "$CJA" $BASE/sites | grep -oE '"id":"[^"]+"' | head -2 | tail -1 | cut -d'"' -f4)
MV_ASSET=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X PATCH "$BASE/assets/$ASSET_ID" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d "{\"siteId\":\"$OTHER_SITE\"}")
log "Asset move to other site: $MV_ASSET"

# Task → Expense conversion
TE=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/tasks/$TASK_ID/convert-to-expense" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" -d '{}')
log "Task→Expense (may not exist endpoint): $TE"

# Search
log "=== SEARCH ==="
for q in "Paris" "Admin" "Switch" "%00" "../etc/passwd" "%27%20OR%201%3D1" "<script>"; do
  c=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/search?q=$q" -H "X-Delegation-Id: $DEL_ID")
  log "search q='$q' → $c"
done

# Notifications
log "=== NOTIFICATIONS ==="
N_COUNT=$(curl -sS -b "$CJA" $BASE/notifications/inbox/count-unread -H "X-Delegation-Id: $DEL_ID")
log "Unread count: $N_COUNT"
MARKALL=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/notifications/inbox/mark-all-read" -H "X-Delegation-Id: $DEL_ID")
log "Mark-all-read: $MARKALL"

# Audit
log "=== AUDIT ==="
AU_CNT=$(curl -sS -b "$CJA" $BASE/audit -H "X-Delegation-Id: $DEL_ID" | grep -oE '"id":"[^"]+"' | wc -l)
log "Audit entries: $AU_CNT"

# Search by entity
AU_ENT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/audit/entity/Asset/$ASSET_ID" -H "X-Delegation-Id: $DEL_ID")
check "GET /audit/entity/Asset/:id" "200" "$AU_ENT"

# Budget status endpoint
log "=== BUDGETS ==="
BUDGETS=$(curl -sS -b "$CJA" $BASE/budgets -H "X-Delegation-Id: $DEL_ID")
B_ID=$(echo "$BUDGETS" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
if [ -n "$B_ID" ]; then
  BS=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/budgets/$B_ID/status" -H "X-Delegation-Id: $DEL_ID")
  log "Budget status: $BS"
else
  log "No budget found (not seeded)"
fi

# Expense projection
log "=== EXPENSE PROJECTION ==="
PROJ=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/expenses/projection?from=2026-01-01&to=2026-12-31" -H "X-Delegation-Id: $DEL_ID")
check "GET /expenses/projection" "200" "$PROJ"

# Consumption
log "=== CONSUMPTION ==="
CS=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" $BASE/consumption/summary -H "X-Delegation-Id: $DEL_ID")
check "GET /consumption/summary" "200" "$CS"

CS_SITE=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/consumption/site/$SITE_ID" -H "X-Delegation-Id: $DEL_ID")
check "GET /consumption/site/:id" "200" "$CS_SITE"

# Racks - mount equipment, check occupation
log "=== RACK OPS ==="
R_DETAIL=$(curl -sS -b "$CJA" "$BASE/racks/$RACK_ID" -H "X-Delegation-Id: $DEL_ID")
echo "$R_DETAIL" | head -c 300
echo ""

# Floor plans
log "=== FLOOR PLANS ==="
FP=$(curl -sS -b "$CJA" $BASE/floor-plans -H "X-Delegation-Id: $DEL_ID")
FP_CNT=$(echo "$FP" | grep -oE '"id":"[^"]+"' | wc -l)
log "Floor plans: $FP_CNT (expect 0 — seed doesn't create floor plans)"

# Integrations
log "=== INTEGRATIONS ==="
I_MON=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/integrations/monitoring/monitors" -H "X-Delegation-Id: $DEL_ID")
check "GET /integrations/monitoring/monitors" "200" "$I_MON"

# Manager login (seeded user)
log "=== RBAC — SEEDED MANAGER ==="
MGR=$(curl -sS $BASE/users | grep -oE '"email":"[^"]+"' | head -20)
log "Seeded users: $MGR"

# Try login with seeded manager (from seed.ts: manager@xch.demo / manager123)
ML=$(curl -sS -c "$CJM" -o /tmp/ml.json -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@xch.demo","password":"manager123"}')
log "Seeded manager login: $ML"

if [ "$ML" = "201" ]; then
  # Manager access to sites
  M_SITES_CNT=$(curl -sS -b "$CJM" $BASE/sites | grep -oE '"id":"[^"]+"' | wc -l)
  log "Manager sees $M_SITES_CNT sites (vs admin: $(curl -sS -b "$CJA" $BASE/sites | grep -oE '"id":"[^"]+"' | wc -l))"
  # Manager tries to create admin user
  M_CREATE=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" -X POST $BASE/users \
    -H "Content-Type: application/json" \
    -d '{"email":"hack@x.io","name":"Hack","password":"Valid2026!"}')
  [ "$M_CREATE" = "403" ] || warn "manager creates user returns $M_CREATE (expect 403)"
  # Manager tries to DELETE a site
  M_DEL_SITE=$(curl -sS -b "$CJM" -o /dev/null -w "%{http_code}" -X DELETE "$BASE/sites/$SITE_ID" -H "X-Delegation-Id: $DEL_ID")
  log "Manager deletes site: $M_DEL_SITE"
fi

# Tech login
TL=$(curl -sS -c "$CJT" -o /tmp/tl.json -w "%{http_code}" -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tech@xch.demo","password":"tech123"}')
log "Seeded tech login: $TL"

if [ "$TL" = "201" ]; then
  T_SITES_CNT=$(curl -sS -b "$CJT" $BASE/sites | grep -oE '"id":"[^"]+"' | wc -l)
  log "Tech sees $T_SITES_CNT sites"
  T_CREATE_SITE=$(curl -sS -b "$CJT" -o /dev/null -w "%{http_code}" -X POST "$BASE/sites" \
    -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
    -d "{\"name\":\"T\",\"code\":\"T-$RANDOM\",\"delegationId\":\"$DEL_ID\",\"city\":\"P\",\"country\":\"FR\",\"status\":\"ACTIVE\"}")
  log "Tech creates site: $T_CREATE_SITE (expect 403 — tech shouldn't create sites)"
fi

# === DELETE ===
log "=== DELETE ==="
DT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X DELETE "$BASE/tasks/$TASK_ID" -H "X-Delegation-Id: $DEL_ID")
check "DELETE /tasks/:id" "200" "$DT"

# Delete a site with assets → should 409 or cascade warning?
DS=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X DELETE "$BASE/sites/$SITE_ID" -H "X-Delegation-Id: $DEL_ID")
log "DELETE site with assets/tasks: $DS (expect 409 if protected)"

# === EDGE CASES ===
log "=== EDGE CASES ==="
# Large payload
BIG=$(printf 'A%.0s' {1..100000})
LB=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/assets" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"$BIG\",\"type\":\"OTHER\",\"serialNumber\":\"HUGE\",\"siteId\":\"$OTHER_SITE\"}")
log "100k char name: $LB"

# Unicode
U_C=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/assets" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"🚀 Асест тест 测试\",\"type\":\"OTHER\",\"serialNumber\":\"UNI-$RANDOM\",\"siteId\":\"$OTHER_SITE\"}")
log "Unicode name: $U_C"

# Negative numbers
NEG=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/assets" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"N\",\"type\":\"OTHER\",\"serialNumber\":\"NEG-$RANDOM\",\"siteId\":\"$OTHER_SITE\",\"acquisitionPrice\":-100}")
log "Negative price: $NEG (expect 400)"

# Null injection
NULL_I=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/assets" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d "{\"name\":\"test\x00null\",\"type\":\"OTHER\",\"serialNumber\":\"NULL-$RANDOM\",\"siteId\":\"$OTHER_SITE\"}")
log "Null byte in name: $NULL_I"

# Malformed JSON
MJ=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" -X POST "$BASE/assets" \
  -H "X-Delegation-Id: $DEL_ID" -H "Content-Type: application/json" \
  -d '{"name":"x","type":')
check "malformed JSON → 400" "400" "$MJ"

# XXE / path traversal in params
PT=$(curl -sS -b "$CJA" -o /dev/null -w "%{http_code}" "$BASE/sites/../../etc/passwd")
log "Path traversal GET: $PT"

# === HEALTH / METRICS ===
log "=== HEALTH ==="
H=$(curl -sS -o /dev/null -w "%{http_code}" $BASE/health 2>&1)
log "GET /api/health (unauth): $H"
M=$(curl -sS -o /dev/null -w "%{http_code}" $BASE/metrics)
log "GET /api/metrics (unauth): $M (expect 401/404 if not public)"

echo ""
echo "==================== SUMMARY ===================="
echo "PASS: $pass | FAIL: $fail | WARN: $warn"
echo ""
echo "FINDINGS:"
printf '  %s\n' "${findings[@]}"
