#!/bin/bash
# =============================================================================
# XCH — UFW firewall enforce (idempotent)
#
# Track E.2 Pass 8 — promotion du template UFW de docs/installation/INSTALL_PROD.md
# en script idempotent applicable sur le serveur pilote.
#
# Source whitelist : docs/audit/track-e1-egress-whitelist.md (Track E.1 closure).
#
# Pattern : default deny incoming/outgoing, then explicit allow rules.
# La cible Track E.3 (cutover prod employeur air-gap) sera plus strict — ici
# on autorise le minimum pour que la stack XCH + GlitchTip + SMTP + DNS + NTP
# fonctionnent en air-gap pilote.
#
# Usage :
#   sudo ./scripts/ufw-enforce.sh                    # applique les règles
#   sudo ./scripts/ufw-enforce.sh --dry-run          # imprime sans appliquer
#   sudo ./scripts/ufw-enforce.sh --reset            # ufw reset + reapply (CAREFUL)
#
# Env vars :
#   SMTP_RELAY    Host/IP du SMTP relay (default: noop — pas d'allow outbound)
#   NTP_SOURCE    Host NTP interne (default: noop — utilise le pool système)
#   GLITCHTIP_NPM_PORT  Port du reverse proxy GlitchTip (default: 443, déjà allow HTTPS)
# =============================================================================

set -euo pipefail

usage() {
  sed -n '1,30p' "$0"
  exit 1
}

DRY_RUN="false"
RESET="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN="true"; shift ;;
    --reset)    RESET="true"; shift ;;
    -h|--help)  usage ;;
    *)          echo "ERROR: unknown arg $1" >&2; exit 2 ;;
  esac
done

# Pré-requis sudo
if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: this script must run as root (ufw requires it)." >&2
  exit 1
fi

# Pré-requis ufw installé
if ! command -v ufw >/dev/null 2>&1; then
  echo "ERROR: ufw not installed. apt install ufw" >&2
  exit 1
fi

SMTP_RELAY="${SMTP_RELAY:-}"
NTP_SOURCE="${NTP_SOURCE:-}"

echo "==================================================="
echo "  XCH UFW Enforce — $(date -Iseconds)"
echo "==================================================="
echo ""
echo "  Mode       : $([[ "$DRY_RUN" == "true" ]] && echo 'DRY-RUN' || echo 'APPLY')"
echo "  Reset      : $RESET"
echo "  SMTP_RELAY : ${SMTP_RELAY:-<not set>}"
echo "  NTP_SOURCE : ${NTP_SOURCE:-<system default>}"
echo ""

# UFW status snapshot (avant)
echo "--- UFW status BEFORE ---"
ufw status verbose | head -20
echo ""

# Définir la fonction "run" qui exécute ou affiche selon dry-run
run() {
  echo "  $ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

# --reset : wipe et re-applique
if [[ "$RESET" == "true" ]]; then
  echo "--- RESET (wipe all rules) ---"
  if [[ "$DRY_RUN" == "false" ]]; then
    echo "y" | ufw reset >/dev/null
  else
    echo "  [dry-run] ufw reset (skipped)"
  fi
fi

# Default policies
echo "--- Default policies ---"
run ufw default deny incoming
run ufw default deny outgoing  # ← strict outbound (air-gap pilote employeur)

# Inbound — services exposés
echo ""
echo "--- Allow inbound ---"
run ufw allow 22/tcp comment 'SSH (admin only)'
run ufw allow 80/tcp comment 'HTTP — Let s Encrypt + redirect HTTPS'
run ufw allow 443/tcp comment 'HTTPS — XCH + GlitchTip via NPM'

# Outbound — strictement nécessaire
echo ""
echo "--- Allow outbound ---"
# DNS (interne employeur ou systemd-resolved local 127.0.0.53)
run ufw allow out 53/udp comment 'DNS (interne)'
run ufw allow out 53/tcp comment 'DNS over TCP fallback'

# NTP (système ou serveur interne)
run ufw allow out 123/udp comment 'NTP'

# HTTPS sortant — restreint si possible
# En air-gap strict, retirer cette ligne et l'opérateur autorise explicitement
# chaque host (NetBox, mirror APT interne, etc.) en commentaires §3.
if [[ -n "${ALLOW_HTTPS_OUTBOUND:-}" ]]; then
  run ufw allow out 443/tcp comment 'HTTPS outbound (NetBox / mirror APT)'
fi

# SMTP relay (optionnel — si configuré)
if [[ -n "$SMTP_RELAY" ]]; then
  run ufw allow out to "$SMTP_RELAY" port 587 proto tcp comment 'SMTP relay (D2.1)'
  run ufw allow out to "$SMTP_RELAY" port 465 proto tcp comment 'SMTP relay submission'
fi

# NTP source spécifique
if [[ -n "$NTP_SOURCE" ]]; then
  run ufw allow out to "$NTP_SOURCE" port 123 proto udp comment 'NTP source interne'
fi

# Docker bridge — autoriser le trafic inter-container (xch-network 172.x.x.x)
# UFW joue avec Docker bizarrement (cf. iptables-docker.io issue). Pour le pilote,
# on s'appuie sur le bridge Docker par défaut qui contourne UFW. Documenté §4.

# Loopback (toujours)
echo ""
echo "--- Loopback ---"
run ufw allow in on lo comment 'Loopback in'
run ufw allow out on lo comment 'Loopback out'

# Enable UFW
echo ""
echo "--- Enable UFW ---"
if [[ "$DRY_RUN" == "false" ]]; then
  echo "y" | ufw enable >/dev/null
  echo "  ufw enabled."
else
  echo "  [dry-run] ufw enable (skipped)"
fi

echo ""
echo "--- UFW status AFTER ---"
ufw status verbose

echo ""
echo "==================================================="
echo "  UFW enforce terminé à $(date -Iseconds)"
echo "  ⚠  Vérifier que SSH (22/tcp) reste accessible AVANT de fermer la session."
echo "==================================================="
echo ""
echo "Notes complémentaires :"
echo "  - UFW vs Docker : par défaut Docker bypass UFW. Pour bloquer les ports"
echo "    Docker exposés, voir docs/installation/INSTALL_PROD.md §UFW Docker."
echo "  - Pour Track E.3 (cutover pilote employeur), valider que :"
echo "    * Sortant 443/tcp = DENY par défaut (sauf APT mirror interne)"
echo "    * audit-egress.sh --strict = PASS 4/4 après application"
echo "    * SMTP_RELAY pointe vers Postfix interne employeur (D2.1)"
echo "    * NTP_SOURCE pointe vers NTP interne (V4 vigilance)"
