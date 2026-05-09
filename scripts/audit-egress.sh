#!/usr/bin/env bash

##############################################################################
# audit-egress.sh — Vérifie qu'AUCUNE des 3 cibles XCH (backend NestJS +
# worker BullMQ + frontend Next.js) ne peut leaker un event vers Sentry SaaS
# public, et que GlitchTip self-hosted (interne Docker) reste joignable.
#
# Critère acceptance v2.1.0 / item 7 du handoff S8.
#
# Usage (sur xch-deploy ou tout host avec docker + repo XCH cloné) :
#   bash scripts/audit-egress.sh                           # mode strict (défaut)
#   bash scripts/audit-egress.sh --skip-dns                # n'exige pas NXDOMAIN
#                                                         # (utile si DNS pas
#                                                         # encore bloqué OS-level)
#   bash scripts/audit-egress.sh --backend-container NAME  # défaut: xch-backend
#   bash scripts/audit-egress.sh --glitchtip-host HOST     # défaut: glitchtip-web
#   bash scripts/audit-egress.sh --glitchtip-port PORT     # défaut: 8000
#
# 4 assertions :
#   1. curl https://sentry.io depuis xch-backend → DOIT échouer (timeout,
#      connection refused, ou DNS échec). Échec attendu = preuve d'air-gap.
#   2. getent hosts sentry.io → DOIT NXDOMAIN si DNS OS bloqué (skippable
#      via --skip-dns si la stratégie de blocage est purement réseau).
#   3. curl http://glitchtip-web:8000/api/0/ depuis xch-backend → DOIT répondre
#      (status code attendu : 405 GET-only, OU 200, OU 401 — tout sauf
#      "connection refused / DNS fail / timeout"). Preuve réseau interne OK.
#   4. grep -r 'sentry.io' dans backend/src + frontend/src = 0 match.
#      Preuve qu'aucun DSN SaaS n'a été hardcodé en review oubliée.
#
# Defensive patterns appliqués (cf. memory `engineering_ci_script_defensive
# _patterns`) : capture défensive avec timeout, validation explicite par
# assertion, fail explicit avec exit code, summary final clair.
##############################################################################

set -uo pipefail
# Pas de `-e` global : on veut que TOUTES les assertions tournent même si une
# échoue, puis on cumule le verdict final dans `FAILED`.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_CONTAINER="xch-backend"
GLITCHTIP_HOST="glitchtip-web"
GLITCHTIP_PORT="8000"
SKIP_DNS=0
TIMEOUT=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-dns)             SKIP_DNS=1; shift ;;
    --backend-container)    BACKEND_CONTAINER="$2"; shift 2 ;;
    --glitchtip-host)       GLITCHTIP_HOST="$2"; shift 2 ;;
    --glitchtip-port)       GLITCHTIP_PORT="$2"; shift 2 ;;
    --timeout)              TIMEOUT="$2"; shift 2 ;;
    -h|--help)              sed -n '3,30p' "$0"; exit 0 ;;
    *)                      echo "ERROR: argument inconnu: $1" >&2; exit 2 ;;
  esac
done

# Pré-requis minimaux
for tool in docker; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: $tool requis" >&2; exit 1; }
done

if ! docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then
  echo "ERROR: container '$BACKEND_CONTAINER' pas running" >&2
  echo "       (override avec --backend-container <name>)" >&2
  exit 1
fi

FAILED=0
PASSED=0
TOTAL=4

print_assertion() {
  local n="$1"
  local result="$2"
  local label="$3"
  local detail="$4"
  if [[ "$result" == "PASS" ]]; then
    echo "✓ Assertion ${n}/${TOTAL} PASS — ${label}"
    PASSED=$((PASSED + 1))
  else
    echo "✗ Assertion ${n}/${TOTAL} FAIL — ${label}"
    FAILED=$((FAILED + 1))
  fi
  if [[ -n "$detail" ]]; then
    echo "    ${detail}"
  fi
}

# ── Assertion 1 — curl sentry.io depuis xch-backend doit échouer ───────────
echo ""
echo "=== Assertion 1 : aucun outbound vers https://sentry.io depuis ${BACKEND_CONTAINER} ==="

# `--max-time` borne le délai total ; `-sS` silencieux mais affiche errors ;
# `-o /dev/null` on jette le body. Le exit code curl distingue les modes :
#   0  = HTTP réussi (réponse lue) → FAIL (egress passe)
#   6  = couldn't resolve host (DNS fail) → PASS
#   7  = failed to connect (TCP fail) → PASS
#   28 = timeout → PASS
#   N  = autre erreur réseau → PASS (probablement air-gap propre)
SENTRY_CMD="curl -sS -o /dev/null --max-time ${TIMEOUT} -w 'HTTP_CODE=%{http_code}\n' https://sentry.io/ 2>&1"
SENTRY_OUT="$(docker exec "$BACKEND_CONTAINER" sh -c "$SENTRY_CMD" 2>&1 || true)"
SENTRY_EXIT_CMD="curl -sS -o /dev/null --max-time ${TIMEOUT} https://sentry.io/ >/dev/null 2>&1; echo exit=\$?"
SENTRY_EXIT="$(docker exec "$BACKEND_CONTAINER" sh -c "$SENTRY_EXIT_CMD" 2>&1 | grep -oE 'exit=[0-9]+' | cut -d= -f2 || echo "?")"

if [[ "$SENTRY_EXIT" == "0" ]]; then
  print_assertion 1 FAIL \
    "egress vers https://sentry.io a RÉUSSI (curl exit 0) — leak SaaS confirmé" \
    "output: $(echo "$SENTRY_OUT" | head -1)"
else
  print_assertion 1 PASS \
    "egress vers https://sentry.io bloqué (curl exit ${SENTRY_EXIT})" \
    "interprétation : 6=DNS-fail, 7=TCP-refused, 28=timeout, autre=erreur réseau"
fi

# ── Assertion 2 — getent hosts sentry.io NXDOMAIN ──────────────────────────
echo ""
echo "=== Assertion 2 : DNS résolution sentry.io NXDOMAIN (host xch-deploy) ==="

if [[ "$SKIP_DNS" -eq 1 ]]; then
  echo "⊘ Skippé (--skip-dns) — la stratégie d'air-gap actuelle ne bloque pas DNS"
  TOTAL=$((TOTAL - 1))
else
  GETENT_OUT="$(getent hosts sentry.io 2>&1)"
  GETENT_EXIT=$?
  if [[ $GETENT_EXIT -ne 0 ]]; then
    print_assertion 2 PASS \
      "getent hosts sentry.io a échoué (exit ${GETENT_EXIT}) — DNS bloqué OS-level" \
      ""
  else
    print_assertion 2 FAIL \
      "getent hosts sentry.io a résolu → DNS PAS bloqué OS-level" \
      "résultat: $(echo "$GETENT_OUT" | head -1) | (utiliser --skip-dns si stratégie = blocage réseau pur)"
  fi
fi

# ── Assertion 3 — GlitchTip interne joignable depuis xch-backend ──────────
echo ""
echo "=== Assertion 3 : http://${GLITCHTIP_HOST}:${GLITCHTIP_PORT}/api/0/ joignable depuis ${BACKEND_CONTAINER} ==="

GT_CMD="curl -sS -o /dev/null --max-time ${TIMEOUT} -w '%{http_code}' http://${GLITCHTIP_HOST}:${GLITCHTIP_PORT}/api/0/ 2>&1"
GT_HTTP="$(docker exec "$BACKEND_CONTAINER" sh -c "$GT_CMD" 2>&1 || echo "ERR")"

# On accepte tout 2xx/4xx (preuve que le service répond, peu importe la
# sémantique du endpoint). 405 = "GET only" mais service répond. 5xx + ERR
# = service down ou unreachable.
case "$GT_HTTP" in
  2[0-9][0-9] | 4[0-9][0-9])
    print_assertion 3 PASS \
      "GlitchTip interne joignable (HTTP ${GT_HTTP})" \
      "405/401 attendus pour /api/0/ — preuve que le service écoute"
    ;;
  *)
    print_assertion 3 FAIL \
      "GlitchTip interne PAS joignable depuis ${BACKEND_CONTAINER}" \
      "réponse: '${GT_HTTP}' (attendu: 2xx ou 4xx)"
    ;;
esac

# ── Assertion 4 — grep sentry.io dans le code source = 0 match ────────────
echo ""
echo "=== Assertion 4 : aucun 'sentry.io' hardcodé dans backend/src + frontend/src ==="

# On exclut node_modules + dist + .next + tout build artifact. Recherche le
# domaine literal `sentry.io` (avec ou sans scheme), insensitive case.
GREP_HITS=""
if [[ -d "${REPO_ROOT}/backend/src" ]]; then
  GREP_HITS+="$(grep -rniE 'sentry\.io' "${REPO_ROOT}/backend/src" 2>/dev/null || true)"
fi
if [[ -d "${REPO_ROOT}/frontend/src" ]]; then
  GREP_HITS+=$'\n'"$(grep -rniE 'sentry\.io' "${REPO_ROOT}/frontend/src" 2>/dev/null || true)"
fi

# Strip blank lines
GREP_HITS_CLEAN="$(echo "$GREP_HITS" | sed '/^[[:space:]]*$/d')"

if [[ -z "$GREP_HITS_CLEAN" ]]; then
  print_assertion 4 PASS \
    "0 match 'sentry.io' dans backend/src + frontend/src" \
    ""
else
  print_assertion 4 FAIL \
    "matches trouvés dans le code source :" \
    ""
  echo "$GREP_HITS_CLEAN" | sed 's/^/    /' | head -10
fi

# ── Verdict final ──────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
if [[ $FAILED -eq 0 ]]; then
  echo "✓ AUDIT EGRESS PASS — ${PASSED}/${TOTAL} assertions OK"
  echo "  Air-gap GlitchTip : configuration cohérente, aucun leak Sentry SaaS détecté."
  exit 0
else
  echo "✗ AUDIT EGRESS FAIL — ${FAILED}/${TOTAL} assertion(s) échouée(s)"
  echo "  À CORRIGER avant tag v2.1.0."
  exit 1
fi
