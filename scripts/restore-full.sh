#!/bin/bash
# =============================================================================
# XCH - Full Restore Script
# Restores database + MinIO files from a full backup
# Usage: ./scripts/restore-full.sh <backup_file.tar.gz>
#
# WARNING: This will OVERWRITE existing data!
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.tar.gz>"
  echo "Example: $0 backups/xch-backup-full-20260303_020000.tar.gz"
  exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RESTORE_DIR="/tmp/xch-restore-$(date +%s)"

# Load env
if [ -f "$PROJECT_DIR/backend/.env" ]; then
  source "$PROJECT_DIR/backend/.env"
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-xch-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-xch-minio}"
DB_NAME="${POSTGRES_DB:-xch_dev}"
DB_USER="${POSTGRES_USER:-xch_user}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "======================================"
echo "  XCH Full Restore"
echo "  $(date)"
echo "======================================"
echo ""
echo "  WARNING: This will OVERWRITE existing data!"
echo "  Backup: $BACKUP_FILE"
echo ""
read -p "  Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Extract
echo "[1/4] Extracting backup..."
mkdir -p "$RESTORE_DIR"
tar xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

# Find the backup directory
BACKUP_DIR=$(find "$RESTORE_DIR" -maxdepth 1 -name "xch-backup-*" -type d | head -1)
if [ -z "$BACKUP_DIR" ]; then
  echo "ERROR: Invalid backup archive structure"
  rm -rf "$RESTORE_DIR"
  exit 1
fi

echo "  Extracted to: $BACKUP_DIR"

# Verify metadata
if [ -f "$BACKUP_DIR/metadata.json" ]; then
  echo "  Metadata:"
  cat "$BACKUP_DIR/metadata.json" | python3 -m json.tool 2>/dev/null || cat "$BACKUP_DIR/metadata.json"
fi

# 2. Stop backend
echo "[2/4] Stopping backend services..."
cd "$PROJECT_DIR/backend"
docker-compose stop backend 2>/dev/null || true

# 3. Restore database
echo "[3/4] Restoring database..."
if [ -f "$BACKUP_DIR/db.dump" ]; then
  docker cp "$BACKUP_DIR/db.dump" "$POSTGRES_CONTAINER:/tmp/db.dump"
  docker exec "$POSTGRES_CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -Fc /tmp/db.dump 2>/dev/null || true
  docker exec "$POSTGRES_CONTAINER" rm /tmp/db.dump
  echo "  Database restored."
else
  echo "  WARNING: db.dump not found in backup!"
fi

# 4. Restore MinIO files
echo "[4/4] Restoring MinIO files..."
if [ -d "$BACKUP_DIR/minio" ]; then
  for bucket_dir in "$BACKUP_DIR/minio"/*/; do
    bucket=$(basename "$bucket_dir")
    echo "  Restoring bucket: $bucket"
    cd "$BACKUP_DIR/minio"
    tar cf - "$bucket" | docker exec -i "$MINIO_CONTAINER" sh -c "cd /data && tar xf -" 2>/dev/null || true
  done
  echo "  MinIO files restored."
else
  echo "  WARNING: minio directory not found in backup!"
fi

# Restart services
echo ""
echo "Restarting services..."
cd "$PROJECT_DIR/backend"
docker-compose up -d backend

# Cleanup
rm -rf "$RESTORE_DIR"

echo ""
echo "======================================"
echo "  Restore completed!"
echo "  Services are restarting..."
echo "======================================"
