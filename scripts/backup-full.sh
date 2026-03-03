#!/bin/bash
# =============================================================================
# XCH - Full Backup Script
# Creates a complete backup of database + MinIO files
# Usage: ./scripts/backup-full.sh [output_dir]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/xch-backup-${TIMESTAMP}"
ARCHIVE_NAME="xch-backup-full-${TIMESTAMP}.tar.gz"

# Load env
if [ -f "$PROJECT_DIR/backend/.env" ]; then
  source "$PROJECT_DIR/backend/.env"
fi

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-xch-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-xch-minio}"
DB_NAME="${POSTGRES_DB:-xch_dev}"
DB_USER="${POSTGRES_USER:-xch_user}"

echo "======================================"
echo "  XCH Full Backup"
echo "  $(date)"
echo "======================================"

# Create directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$OUTPUT_DIR"

# 1. Database dump
echo "[1/4] Dumping PostgreSQL database..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f /tmp/db.dump
docker cp "$POSTGRES_CONTAINER:/tmp/db.dump" "$BACKUP_DIR/db.dump"
docker exec "$POSTGRES_CONTAINER" rm /tmp/db.dump
echo "  Database dump: $(du -sh "$BACKUP_DIR/db.dump" | cut -f1)"

# 2. MinIO files
echo "[2/4] Backing up MinIO files..."
mkdir -p "$BACKUP_DIR/minio"

for bucket in xch-storage plans photos exports qrcodes; do
  echo "  Copying bucket: $bucket"
  docker exec "$MINIO_CONTAINER" sh -c "
    cd /data && [ -d '$bucket' ] && tar cf - '$bucket' 2>/dev/null
  " | tar xf - -C "$BACKUP_DIR/minio" 2>/dev/null || echo "  (bucket $bucket empty or not found)"
done

echo "  MinIO backup: $(du -sh "$BACKUP_DIR/minio" | cut -f1)"

# 3. Configuration
echo "[3/4] Backing up configuration..."
cp "$PROJECT_DIR/backend/.env" "$BACKUP_DIR/backend.env" 2>/dev/null || true
cp "$PROJECT_DIR/backend/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml" 2>/dev/null || true

# 4. Create metadata
echo "[4/4] Creating archive..."
cat > "$BACKUP_DIR/metadata.json" << EOF
{
  "version": "1.0",
  "type": "full",
  "timestamp": "$(date -Iseconds)",
  "database": "$DB_NAME",
  "hostname": "$(hostname)"
}
EOF

# Archive
cd /tmp
tar czf "$OUTPUT_DIR/$ARCHIVE_NAME" "xch-backup-${TIMESTAMP}"

# Cleanup
rm -rf "$BACKUP_DIR"

echo ""
echo "======================================"
echo "  Backup completed!"
echo "  File: $OUTPUT_DIR/$ARCHIVE_NAME"
echo "  Size: $(du -sh "$OUTPUT_DIR/$ARCHIVE_NAME" | cut -f1)"
echo "======================================"
