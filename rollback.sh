#!/bin/bash

##############################################################################
# XCH - Automated Rollback Script
#
# Description: Rollback to previous deployment in case of issues
# Usage: ./rollback.sh [commit_hash] [--restore-db]
# Author: XCH Team
# Date: 2026-01-29
##############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/opt/xch-dev/XCH"
BACKUP_DIR="/opt/xch-backups"
LOG_FILE="/var/log/xch-rollback.log"

# Parse arguments
TARGET_COMMIT=$1
RESTORE_DB=false

if [[ "$2" == "--restore-db" ]]; then
  RESTORE_DB=true
fi

# Logging
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

# Header
echo ""
echo "═══════════════════════════════════════════════════════════"
log "⏮️  XCH ROLLBACK - STARTING"
echo "═══════════════════════════════════════════════════════════"
echo ""

cd "$PROJECT_DIR" || exit 1

CURRENT_COMMIT=$(git rev-parse HEAD)

if [[ -z "$TARGET_COMMIT" ]]; then
  # Show recent commits
  log "Recent commits:"
  git log --oneline -10
  echo ""
  read -p "Enter commit hash to rollback to (or 'HEAD~1' for previous): " TARGET_COMMIT
fi

# Validate commit
if ! git rev-parse "$TARGET_COMMIT" > /dev/null 2>&1; then
  log_error "Invalid commit: $TARGET_COMMIT"
  exit 1
fi

TARGET_COMMIT=$(git rev-parse "$TARGET_COMMIT")

if [[ "$TARGET_COMMIT" == "$CURRENT_COMMIT" ]]; then
  log_warning "Already at target commit"
  exit 0
fi

log "Current commit: $CURRENT_COMMIT"
log "Target commit:  $TARGET_COMMIT"

# Confirmation
echo ""
read -p "Are you sure you want to rollback? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  log "Rollback cancelled"
  exit 0
fi

# Rollback code
log "📥 Rolling back code to $TARGET_COMMIT..."
git reset --hard "$TARGET_COMMIT"
log "✅ Code rolled back"

# Restore database if requested
if [[ "$RESTORE_DB" == true ]]; then
  log "💾 Restoring database from backup..."

  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/xch_backup_*.sql | head -1)

  if [[ -z "$LATEST_BACKUP" ]]; then
    log_error "No backup found in $BACKUP_DIR"
    exit 1
  fi

  log "Using backup: $LATEST_BACKUP"

  docker exec -i xch-postgres psql -U xch_user -d xch_dev < "$LATEST_BACKUP"

  log "✅ Database restored"
fi

# Restart services
log "🔄 Restarting services..."

docker-compose -f backend/docker-compose.yml restart backend
docker-compose -f frontend/docker-compose.yml restart frontend

log "✅ Services restarted"

# Health checks
log "🏥 Performing health checks..."

sleep 10

if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
  log "✓ Backend is healthy"
else
  log_error "Backend health check failed"
fi

if curl -sf http://localhost:3001 > /dev/null 2>&1; then
  log "✓ Frontend is healthy"
else
  log_error "Frontend health check failed"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
log "✅ ROLLBACK COMPLETED"
echo "═══════════════════════════════════════════════════════════"
echo ""

log "Rolled back from $CURRENT_COMMIT to $TARGET_COMMIT"

exit 0
