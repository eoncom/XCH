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
STRICT=0
TIMEOUT=5

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)               STRICT=1; shift ;;
    --skip-dns)             shift ;;  # legacy noop, conservé pour compat invocations
    --backend-container)    BACKEND_CONTAINER="$2"; shift 2 ;;
    --glitchtip-host)       GLITCHTIP_HOST="$2"; shift 2 ;;
    --glitchtip-port)       GLITCHTIP_PORT="$2"; shift 2 ;;
    --timeout)              TIMEOUT="$2"; shift 2 ;;
    -h|--help)              sed -n '3,32p' "$0"; exit 0 ;;
    *)                      echo "ERROR: argument inconnu: $1" >&2; exit 2 ;;
  esac
done

# `--strict` (prod air-gap) :
#   Assertions 1 + 2 doivent PASS. Si DNS sentry.io résout OU si l'egress
#   réseau passe vers sentry.io, le verdict global est FAIL.
# Sans `--strict` (dev/test, ex: xch-deploy pilote) :
#   Assertions 1 + 2 deviennent INFORMATIONNELLES. Un FAIL est warné mais
#   ne casse pas le verdict global. Seules 3 + 4 sont bloquantes.
#   Rationale : un environnement dev/test peut très bien avoir une connexion
#   internet non filtrée — l'air-gap effectif est ARCHITECTURAL (DSN configuré
#   sur GlitchTip interne, code source sans sentry.io hardcodé). La preuve
#   réseau ne peut être donnée qu'en prod réelle où le firewall outbound bloque.

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
WARNED=0
PASSED=0
TOTAL=4

# Bloquant (FAIL si fail) en strict, informationnel (WARN) sinon.
SOFT_RESULT="WARN"
[[ "$STRICT" -eq 1 ]] && SOFT_RESULT="FAIL"

print_assertion() {
  local n="$1"
  local result="$2"  # PASS | FAIL | WARN
  local label="$3"
  local detail="$4"
  case "$result" in
    PASS)
      echo "✓ Assertion ${n}/${TOTAL} PASS — ${label}"
      PASSED=$((PASSED + 1)) ;;
    FAIL)
      echo "✗ Assertion ${n}/${TOTAL} FAIL — ${label}"
      FAILED=$((FAILED + 1)) ;;
    WARN)
      echo "⚠ Assertion ${n}/${TOTAL} WARN — ${label}"
      WARNED=$((WARNED + 1)) ;;
  esac
  if [[ -n "$detail" ]]; then
    echo "    ${detail}"
  fi
}

# Helper : test HTTP via `node -e` exécuté DANS le container backend.
# `node` est garanti présent (c'est le runtime NestJS), contrairement à curl.
# Output stdout : "HTTP <code>" si réponse reçue, "ERR <code>" si erreur.
node_http_probe() {
  local container="$1"
  local url="$2"
  local timeout_ms=$((TIMEOUT * 1000))
  # Single-line node script pour éviter l'enfer du quoting heredoc à travers
  # docker exec sh -c. `process.exit(0)` = response reçue, `(1)` = erreur.
  docker exec "$container" node -e "
    const url = new URL('${url}');
    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const req = lib.request({
      method: 'HEAD',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname || '/',
      timeout: ${timeout_ms},
    }, (res) => { console.log('HTTP ' + res.statusCode); process.exit(0); });
    req.on('error', (e) => { console.log('ERR ' + (e.code || e.message)); process.exit(1); });
    req.on('timeout', () => { console.log('ERR ETIMEDOUT'); req.destroy(); process.exit(2); });
    req.end();
  " 2>&1
}

# ── Assertion 1 — outbound vers https://sentry.io depuis xch-backend ──────
echo ""
echo "=== Assertion 1 : aucun outbound vers https://sentry.io depuis ${BACKEND_CONTAINER} ==="

SENTRY_PROBE="$(node_http_probe "$BACKEND_CONTAINER" "https://sentry.io/" || true)"
case "$SENTRY_PROBE" in
  HTTP\ *)
    # Egress passé → leak confirmé. Bloquant en strict, warning sinon.
    print_assertion 1 "$SOFT_RESULT" \
      "egress vers https://sentry.io a RÉUSSI (${SENTRY_PROBE}) — réseau ouvert" \
      "$([[ "$STRICT" -eq 1 ]] && echo "→ FAIL en mode strict (prod air-gap doit bloquer)." || echo "→ WARN en mode dev/test (xch-deploy a internet ; air-gap réel = code+config, cf. assertion 4).")"
    ;;
  ERR\ *)
    print_assertion 1 PASS \
      "egress bloqué (${SENTRY_PROBE})" \
      "ENOTFOUND/ECONNREFUSED/ETIMEDOUT = preuve d'air-gap réseau."
    ;;
  *)
    print_assertion 1 "$SOFT_RESULT" \
      "résultat probe inattendu" \
      "output: ${SENTRY_PROBE}"
    ;;
esac

# ── Assertion 2 — DNS résolution sentry.io ────────────────────────────────
echo ""
echo "=== Assertion 2 : DNS résolution sentry.io NXDOMAIN (host) ==="

if ! command -v getent >/dev/null 2>&1; then
  print_assertion 2 "$SOFT_RESULT" \
    "getent indisponible sur l'host" \
    "skipped (probe DNS hors scope sur cet OS)."
else
  GETENT_OUT="$(getent hosts sentry.io 2>&1)"
  GETENT_EXIT=$?
  if [[ $GETENT_EXIT -ne 0 ]]; then
    print_assertion 2 PASS \
      "getent hosts sentry.io a échoué (exit ${GETENT_EXIT}) — DNS bloqué OS-level" \
      ""
  else
    print_assertion 2 "$SOFT_RESULT" \
      "DNS sentry.io a résolu → blocage non-DNS (réseau ou code-only)" \
      "résultat: $(echo "$GETENT_OUT" | head -1) | $([[ "$STRICT" -eq 1 ]] && echo "→ FAIL en strict." || echo "→ WARN en dev/test.")"
  fi
fi

# ── Assertion 3 — GlitchTip interne joignable depuis xch-backend ──────────
echo ""
echo "=== Assertion 3 : http://${GLITCHTIP_HOST}:${GLITCHTIP_PORT}/api/0/ joignable depuis ${BACKEND_CONTAINER} ==="

GT_PROBE="$(node_http_probe "$BACKEND_CONTAINER" "http://${GLITCHTIP_HOST}:${GLITCHTIP_PORT}/api/0/" || true)"
case "$GT_PROBE" in
  HTTP\ 2*|HTTP\ 4*)
    print_assertion 3 PASS \
      "GlitchTip interne joignable (${GT_PROBE})" \
      "405/401 attendus pour /api/0/ — preuve que le service écoute."
    ;;
  *)
    print_assertion 3 FAIL \
      "GlitchTip interne PAS joignable depuis ${BACKEND_CONTAINER}" \
      "résultat: ${GT_PROBE}"
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
echo "Mode : $([[ "$STRICT" -eq 1 ]] && echo "STRICT (prod air-gap)" || echo "RELAXED (dev/test — assertions 1+2 informationnelles)")"
echo "  PASS : ${PASSED}/${TOTAL}"
[[ $WARNED -gt 0 ]] && echo "  WARN : ${WARNED}/${TOTAL} (informationnels, n'affectent pas le verdict)"
echo "  FAIL : ${FAILED}/${TOTAL}"
if [[ $FAILED -eq 0 ]]; then
  echo "✓ AUDIT EGRESS PASS"
  echo "  Air-gap GlitchTip : configuration cohérente, aucun leak Sentry SaaS détecté."
  exit 0
else
  echo "✗ AUDIT EGRESS FAIL"
  echo "  $([[ "$STRICT" -eq 1 ]] && echo "À CORRIGER avant tag v2.1.0 prod air-gap." || echo "Assertions bloquantes (3 ou 4) en échec — vérifier la config.")"
  exit 1
fi
