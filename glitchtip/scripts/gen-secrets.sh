#!/usr/bin/env bash

##############################################################################
# gen-secrets.sh — Génère glitchtip/.env à partir de glitchtip/.env.example.
#
# Remplit les 3 placeholders vides (GLITCHTIP_SECRET_KEY,
# GLITCHTIP_POSTGRES_PASSWORD, GLITCHTIP_ADMIN_PASSWORD) avec des valeurs
# `openssl rand -hex 32` (24 pour le password admin, suffisant pour login UI).
# Les autres variables conservent leur valeur par défaut du template — à
# ajuster à la main après coup (XCH_NETWORK_NAME, GLITCHTIP_DOMAIN, etc).
#
# Usage:
#   bash glitchtip/scripts/gen-secrets.sh                   # crée glitchtip/.env
#   bash glitchtip/scripts/gen-secrets.sh --force           # écrase si présent
#   bash glitchtip/scripts/gen-secrets.sh --stdout          # imprime sans écrire
#
# Idempotence: refuse d'écraser un .env existant sans --force, pour éviter
# d'invalider une stack déjà bootstrappée (rotation Postgres password sur
# une DB live = perte data).
##############################################################################

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="${REPO_ROOT}/glitchtip/.env.example"
TARGET="${REPO_ROOT}/glitchtip/.env"

FORCE=0
STDOUT=0
for arg in "$@"; do
  case "$arg" in
    --force)  FORCE=1 ;;
    --stdout) STDOUT=1 ;;
    -h|--help)
      sed -n '3,21p' "$0"; exit 0 ;;
    *)
      echo "ERROR: argument inconnu: $arg" >&2
      echo "Usage: $0 [--force] [--stdout]" >&2
      exit 2 ;;
  esac
done

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: template introuvable: $TEMPLATE" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl requis (apt install openssl)" >&2
  exit 1
fi

if [[ "$STDOUT" -eq 0 && -f "$TARGET" && "$FORCE" -eq 0 ]]; then
  echo "ERROR: $TARGET existe déjà." >&2
  echo "       Utiliser --force pour écraser (⚠ perte des secrets actuels," >&2
  echo "       Postgres password rotation = DB inaccessible sans dump+restore)." >&2
  exit 1
fi

SECRET_KEY="$(openssl rand -hex 32)"
PG_PASSWORD="$(openssl rand -hex 32)"
ADMIN_PASSWORD="$(openssl rand -hex 24)"

# Sanity: les 3 doivent être non-vides et de la bonne longueur (64/64/48 hex).
[[ ${#SECRET_KEY}    -eq 64 ]] || { echo "ERROR: SECRET_KEY length=${#SECRET_KEY}, attendu 64" >&2; exit 1; }
[[ ${#PG_PASSWORD}   -eq 64 ]] || { echo "ERROR: PG_PASSWORD length=${#PG_PASSWORD}, attendu 64" >&2; exit 1; }
[[ ${#ADMIN_PASSWORD} -eq 48 ]] || { echo "ERROR: ADMIN_PASSWORD length=${#ADMIN_PASSWORD}, attendu 48" >&2; exit 1; }

# Substitution sur les 3 lignes `KEY=` vides du template.
# `|` comme délim sed pour éviter conflits avec hex (pas de pipe dans hex).
RENDERED="$(
  sed \
    -e "s|^GLITCHTIP_SECRET_KEY=$|GLITCHTIP_SECRET_KEY=${SECRET_KEY}|" \
    -e "s|^GLITCHTIP_POSTGRES_PASSWORD=$|GLITCHTIP_POSTGRES_PASSWORD=${PG_PASSWORD}|" \
    -e "s|^GLITCHTIP_ADMIN_PASSWORD=$|GLITCHTIP_ADMIN_PASSWORD=${ADMIN_PASSWORD}|" \
    "$TEMPLATE"
)"

# Vérifier qu'aucune des 3 lignes n'est restée vide (template a été modifié ?).
for key in GLITCHTIP_SECRET_KEY GLITCHTIP_POSTGRES_PASSWORD GLITCHTIP_ADMIN_PASSWORD; do
  if echo "$RENDERED" | grep -qE "^${key}=$"; then
    echo "ERROR: substitution échouée pour $key — template modifié ?" >&2
    exit 1
  fi
done

if [[ "$STDOUT" -eq 1 ]]; then
  echo "$RENDERED"
  exit 0
fi

# Écriture atomique (write+rename) pour éviter un .env partiel si le script
# est interrompu en cours d'écriture.
TMP="$(mktemp "${TARGET}.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
echo "$RENDERED" > "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$TARGET"
trap - EXIT

echo "✓ Généré: $TARGET (mode 600)"
echo "  SECRET_KEY        : 64 hex chars"
echo "  POSTGRES_PASSWORD : 64 hex chars"
echo "  ADMIN_PASSWORD    : 48 hex chars"
echo ""
echo "Étapes suivantes :"
echo "  1. Ajuster XCH_NETWORK_NAME dans $TARGET selon l'env"
echo "     (docker network ls | grep xch-network)"
echo "  2. docker compose -f docker-compose.glitchtip.yml --env-file glitchtip/.env up -d"
echo "  3. bash glitchtip/scripts/gen-dsn.sh    # récupérer les 3 DSN"
