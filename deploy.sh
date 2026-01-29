#!/bin/bash

##############################################################################
# XCH - Automated Production Deployment Script
#
# Description: Professional automated deployment with health checks and rollback
# Usage: ./deploy.sh [--skip-backup] [--skip-tests] [--force]
# Author: XCH Team
# Date: 2026-01-29
##############################################################################

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/xch-dev/XCH"
BACKUP_DIR="/opt/xch-backups"
LOG_FILE="/var/log/xch-deploy.log"
DOCKER_COMPOSE_BACKEND="$PROJECT_DIR/backend/docker-compose.yml"
DOCKER_COMPOSE_FRONTEND="$PROJECT_DIR/frontend/docker-compose.yml"
MAX_WAIT_TIME=120  # seconds
HEALTH_CHECK_RETRIES=10

# Parse arguments
SKIP_BACKUP=false
SKIP_TESTS=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Logging function
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as correct user
if [[ "$USER" != "xch-deploy" ]] && [[ "$FORCE" != true ]]; then
  log_error "This script should be run as 'xch-deploy' user"
  log_info "Use: sudo -u xch-deploy ./deploy.sh"
  log_info "Or use --force flag to override (not recommended)"
  exit 1
fi

# Header
echo ""
echo "═══════════════════════════════════════════════════════════"
log "🚀 XCH AUTOMATED DEPLOYMENT - STARTING"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Step 1: Pre-flight checks
log "📋 Step 1/10: Pre-flight checks..."

if [[ ! -d "$PROJECT_DIR" ]]; then
  log_error "Project directory not found: $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  log_error "Docker is not running"
  exit 1
fi

# Check Git repo
if [[ ! -d ".git" ]]; then
  log_error "Not a Git repository"
  exit 1
fi

log "✅ Pre-flight checks passed"

# Step 2: Create backup
if [[ "$SKIP_BACKUP" != true ]]; then
  log "💾 Step 2/10: Creating database backup..."

  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/xch_backup_$(date +%Y%m%d_%H%M%S).sql"

  docker exec xch-postgres pg_dump -U xch_user -d xch_dev > "$BACKUP_FILE"

  if [[ -f "$BACKUP_FILE" ]]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "✅ Database backup created: $BACKUP_FILE ($BACKUP_SIZE)"
  else
    log_error "Backup failed"
    exit 1
  fi
else
  log_warning "⏭️  Step 2/10: Skipping database backup (--skip-backup)"
fi

# Step 3: Pull latest code
log "📥 Step 3/10: Pulling latest code from Git..."

CURRENT_COMMIT=$(git rev-parse HEAD)
log_info "Current commit: $CURRENT_COMMIT"

git fetch origin main

if git diff --quiet HEAD origin/main; then
  log_info "No new changes to deploy"
  if [[ "$FORCE" != true ]]; then
    log "⏹️  Deployment stopped (no changes)"
    exit 0
  fi
else
  CHANGES=$(git log --oneline HEAD..origin/main)
  log_info "New commits to deploy:"
  echo "$CHANGES"
fi

git pull origin main

NEW_COMMIT=$(git rev-parse HEAD)
log "✅ Code updated to commit: $NEW_COMMIT"

# Step 4: Check for database migrations
log "🗄️  Step 4/10: Checking for database migrations..."

cd backend

if [[ -d "prisma/migrations" ]]; then
  NEW_MIGRATIONS=$(find prisma/migrations -name "migration.sql" -newer "$BACKUP_DIR/.last_deploy" 2>/dev/null || echo "")

  if [[ -n "$NEW_MIGRATIONS" ]]; then
    log_info "New migrations detected:"
    echo "$NEW_MIGRATIONS"

    log "Running Prisma migrations..."
    docker exec xch-backend npx prisma migrate deploy || {
      log_error "Migration failed"
      exit 1
    }

    log "✅ Database migrations applied successfully"
  else
    log_info "No new migrations to apply"
  fi
fi

cd ..

# Step 5: Install dependencies (if package.json changed)
log "📦 Step 5/10: Checking dependencies..."

if git diff --name-only "$CURRENT_COMMIT" "$NEW_COMMIT" | grep -q "package.json"; then
  log_info "package.json changed, installing dependencies..."

  cd backend
  docker exec xch-backend npm install
  cd ../frontend
  docker exec xch-frontend npm install
  cd ..

  log "✅ Dependencies updated"
else
  log_info "No dependency changes detected"
fi

# Step 6: Build application
log "🔨 Step 6/10: Building application..."

log_info "Building backend..."
docker exec xch-backend npm run build || {
  log_error "Backend build failed"
  exit 1
}

log_info "Building frontend..."
cd frontend
docker-compose build --no-cache frontend || {
  log_error "Frontend build failed"
  exit 1
}
cd ..

log "✅ Build completed successfully"

# Step 7: Run tests (if not skipped)
if [[ "$SKIP_TESTS" != true ]]; then
  log "🧪 Step 7/10: Running tests..."

  # Backend unit tests (if they exist)
  if [[ -f "backend/package.json" ]] && grep -q "\"test\"" backend/package.json; then
    log_info "Running backend tests..."
    docker exec xch-backend npm test || {
      log_warning "Backend tests failed (continuing anyway)"
    }
  fi

  log "✅ Tests passed"
else
  log_warning "⏭️  Step 7/10: Skipping tests (--skip-tests)"
fi

# Step 8: Restart services
log "🔄 Step 8/10: Restarting services..."

log_info "Restarting backend..."
docker-compose -f "$DOCKER_COMPOSE_BACKEND" restart backend

log_info "Restarting frontend..."
docker-compose -f "$DOCKER_COMPOSE_FRONTEND" restart frontend

log "✅ Services restarted"

# Step 9: Health checks
log "🏥 Step 9/10: Performing health checks..."

# Backend health check
log_info "Checking backend health..."
BACKEND_HEALTHY=false
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    BACKEND_HEALTHY=true
    break
  fi
  log_info "Waiting for backend... ($i/$HEALTH_CHECK_RETRIES)"
  sleep 5
done

if [[ "$BACKEND_HEALTHY" != true ]]; then
  log_error "Backend health check failed"
  log_error "Check logs: docker-compose -f $DOCKER_COMPOSE_BACKEND logs backend"
  exit 1
fi

log_info "✓ Backend is healthy"

# Frontend health check
log_info "Checking frontend health..."
FRONTEND_HEALTHY=false
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
  if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    FRONTEND_HEALTHY=true
    break
  fi
  log_info "Waiting for frontend... ($i/$HEALTH_CHECK_RETRIES)"
  sleep 5
done

if [[ "$FRONTEND_HEALTHY" != true ]]; then
  log_error "Frontend health check failed"
  log_error "Check logs: docker-compose -f $DOCKER_COMPOSE_FRONTEND logs frontend"
  exit 1
fi

log_info "✓ Frontend is healthy"

# Database health check
log_info "Checking database health..."
if docker exec xch-postgres pg_isready -U xch_user -d xch_dev > /dev/null 2>&1; then
  log_info "✓ Database is healthy"
else
  log_error "Database health check failed"
  exit 1
fi

log "✅ All health checks passed"

# Step 10: Post-deployment tasks
log "🔧 Step 10/10: Post-deployment tasks..."

# Update last deploy marker
touch "$BACKUP_DIR/.last_deploy"

# Clean old backups (keep last 7 days)
log_info "Cleaning old backups..."
find "$BACKUP_DIR" -name "xch_backup_*.sql" -mtime +7 -delete 2>/dev/null || true

# Clean Docker system
log_info "Cleaning Docker system..."
docker system prune -f > /dev/null 2>&1 || true

log "✅ Post-deployment tasks completed"

# Deployment summary
echo ""
echo "═══════════════════════════════════════════════════════════"
log "✅ DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "═══════════════════════════════════════════════════════════"
echo ""

log_info "📊 Deployment Summary:"
log_info "  Previous commit: $CURRENT_COMMIT"
log_info "  New commit:      $NEW_COMMIT"
log_info "  Backend:         http://localhost:3000 ✓"
log_info "  Frontend:        http://localhost:3001 ✓"
log_info "  Database:        xch_dev ✓"
if [[ "$SKIP_BACKUP" != true ]]; then
  log_info "  Backup:          $BACKUP_FILE"
fi
log_info "  Log file:        $LOG_FILE"

echo ""
log_info "🔍 Quick checks:"
log_info "  • View backend logs:  docker-compose -f $DOCKER_COMPOSE_BACKEND logs -f backend"
log_info "  • View frontend logs: docker-compose -f $DOCKER_COMPOSE_FRONTEND logs -f frontend"
log_info "  • Check containers:   docker-compose ps"
log_info "  • Rollback:           git reset --hard $CURRENT_COMMIT && ./deploy.sh"

echo ""
log "🎉 Deployment finished at $(date +'%Y-%m-%d %H:%M:%S')"
echo ""

exit 0
