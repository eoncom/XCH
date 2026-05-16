#!/bin/bash
# =============================================================================
# XCH — Offsite backup via LUKS-encrypted device (USB or loopback)
#
# Track E.2 Pass 7 (D2.3 décision RSI) — rotation hebdomadaire offsite des
# backups MinIO sur médium chiffré. Procédure exercée 1× en loopback pendant
# le drill ; remplacer le device par une vraie clé USB en production pilote.
#
# Pattern :
#   1. cryptsetup luksOpen <DEVICE> xch_offsite
#   2. mount /dev/mapper/xch_offsite /mnt/xch-offsite
#   3. rsync <BACKUPS_SRC>/ /mnt/xch-offsite/  (filter : ZIP + sidecars only)
#   4. umount + cryptsetup luksClose
#
# Pré-requis :
#   - cryptsetup installé (apt install cryptsetup)
#   - rsync installé
#   - Pour USB physique : device formaté LUKS via :
#       sudo cryptsetup luksFormat /dev/sdb1
#     (procédure de formatage initial NON couverte par ce script — clé doit
#      déjà être préparée et la passphrase connue)
#   - Pour loopback drill :
#       dd if=/dev/zero of=/tmp/loop.img bs=1M count=512
#       sudo cryptsetup luksFormat /tmp/loop.img
#
# Usage :
#   sudo ./scripts/offsite-backup-luks.sh <DEVICE> [--dry-run]
#
#   <DEVICE> : /dev/sdb1 (USB)  OR  /tmp/loop.img (drill)
#
# Examples :
#   sudo ./scripts/offsite-backup-luks.sh /dev/sdb1
#   sudo ./scripts/offsite-backup-luks.sh /tmp/loop.img --dry-run
#
# Env vars :
#   BACKUPS_SRC    Dossier source des backups (défaut: /opt/xch-dev/XCH/backups)
#   LUKS_PASSPHRASE_FILE  Chemin fichier passphrase (mode batch). Sinon prompt
#                         interactif via cryptsetup (sécurité par défaut).
#   RETENTION_DAYS Conserve uniquement N jours (défaut: 7)
#
# Sécurité — key escrow :
#   La passphrase LUKS DOIT être stockée dans un vault opérateur (split-knowledge
#   ou sealed envelope per ANSSI). Ne JAMAIS commit ce fichier.
# =============================================================================

set -euo pipefail

usage() {
  sed -n '1,40p' "$0"
  exit 1
}

DEVICE=""
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN="true"; shift ;;
    -h|--help)  usage ;;
    -*)         echo "ERROR: unknown flag $1" >&2; exit 2 ;;
    *)          if [[ -z "$DEVICE" ]]; then DEVICE="$1"; else echo "ERROR: extra arg $1" >&2; exit 2; fi
                shift ;;
  esac
done

[[ -z "$DEVICE" ]] && { echo "ERROR: <DEVICE> required (e.g. /dev/sdb1 or /tmp/loop.img)" >&2; usage; }
[[ ! -e "$DEVICE" ]] && { echo "ERROR: device $DEVICE not found" >&2; exit 1; }

BACKUPS_SRC="${BACKUPS_SRC:-/opt/xch-dev/XCH/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
MAPPER_NAME="xch_offsite"
MOUNT_POINT="/mnt/xch-offsite"

echo "==================================================="
echo "  XCH Offsite Backup (LUKS encrypted)"
echo "  $(date -Iseconds)"
echo "==================================================="
echo ""
echo "  Device         : $DEVICE"
echo "  Backups source : $BACKUPS_SRC"
echo "  Retention      : $RETENTION_DAYS days"
echo "  Mount point    : $MOUNT_POINT"
echo "  Dry-run        : $DRY_RUN"
echo ""

# Sanity — source backups exists
if [[ ! -d "$BACKUPS_SRC" ]]; then
  echo "ERROR: BACKUPS_SRC $BACKUPS_SRC not a directory" >&2
  exit 1
fi

# Sanity — newest backup age check (warn if > 36h)
NEWEST_FILE=$(find "$BACKUPS_SRC" -maxdepth 2 -name '*.zip' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
if [[ -n "$NEWEST_FILE" ]]; then
  AGE_HOURS=$(( ( $(date +%s) - $(stat -c %Y "$NEWEST_FILE") ) / 3600 ))
  echo "  Newest backup   : $(basename "$NEWEST_FILE")  (${AGE_HOURS}h old)"
  if (( AGE_HOURS > 36 )); then
    echo "  ⚠  WARNING : newest backup > 36h — RPO drift, consider triggering a fresh backup BEFORE rotating offsite."
  fi
else
  echo "  ⚠  No backup .zip files found in $BACKUPS_SRC — nothing to copy."
  exit 1
fi

# ----------------------------- Dry-run only --------------------------------

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "[dry-run] Would execute :"
  echo "  cryptsetup luksOpen $DEVICE $MAPPER_NAME"
  echo "  mkdir -p $MOUNT_POINT"
  echo "  mount /dev/mapper/$MAPPER_NAME $MOUNT_POINT"
  echo "  rsync -av --include='*.zip' --include='*.enc.json' --exclude='*' $BACKUPS_SRC/ $MOUNT_POINT/"
  echo "  find $MOUNT_POINT -mtime +$RETENTION_DAYS -delete (retention cleanup)"
  echo "  umount $MOUNT_POINT"
  echo "  cryptsetup luksClose $MAPPER_NAME"
  exit 0
fi

# ------------------------------ Real run -----------------------------------

# Require root for cryptsetup + mount
if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: this script must run as root (cryptsetup + mount require it)." >&2
  exit 1
fi

# 1. luksOpen
echo "[1/5] Unlocking $DEVICE → /dev/mapper/$MAPPER_NAME ..."
if [[ -n "${LUKS_PASSPHRASE_FILE:-}" ]]; then
  cryptsetup luksOpen --key-file "$LUKS_PASSPHRASE_FILE" "$DEVICE" "$MAPPER_NAME"
else
  cryptsetup luksOpen "$DEVICE" "$MAPPER_NAME"
fi
trap 'cryptsetup luksClose '"$MAPPER_NAME"' 2>/dev/null || true' EXIT

# 2. Mount
echo "[2/5] Mounting /dev/mapper/$MAPPER_NAME → $MOUNT_POINT ..."
mkdir -p "$MOUNT_POINT"
mount "/dev/mapper/$MAPPER_NAME" "$MOUNT_POINT"
trap 'umount '"$MOUNT_POINT"' 2>/dev/null; cryptsetup luksClose '"$MAPPER_NAME"' 2>/dev/null || true' EXIT

# 3. Rsync ZIP + sidecars only
echo "[3/5] Syncing $BACKUPS_SRC → $MOUNT_POINT (ZIP + sidecars only) ..."
rsync -av --include='*/' --include='*.zip' --include='*.enc.json' --exclude='*' "$BACKUPS_SRC/" "$MOUNT_POINT/"

# 4. Retention cleanup (best-effort, doesn't fail the run)
echo "[4/5] Pruning files older than $RETENTION_DAYS days on offsite ..."
find "$MOUNT_POINT" -type f \( -name '*.zip' -o -name '*.enc.json' \) -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
echo "  → done. Current offsite content :"
find "$MOUNT_POINT" -type f -printf '   %TY-%Tm-%Td %TH:%TM  %s  %p\n' 2>/dev/null | sort

# 5. Unmount + close
echo "[5/5] Unmounting + closing LUKS ..."
sync
umount "$MOUNT_POINT"
cryptsetup luksClose "$MAPPER_NAME"
trap - EXIT

echo ""
echo "==================================================="
echo "  Offsite rotation completed at $(date -Iseconds)"
echo "  Device $DEVICE may now be physically removed."
echo "  Next rotation : in 7 days (D2.3 hebdo)."
echo "==================================================="
