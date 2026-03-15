#!/bin/bash
# =============================================================================
# XCH — Air-Gapped Installation Script
# Loads Docker images from archive and starts the stack
#
# Usage: ./scripts/install-airgap.sh [install_dir]
# Default install_dir: /opt/xch
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="${1:-/opt/xch}"

echo "======================================"
echo "  XCH Air-Gapped Installer"
echo "  $(date)"
echo "======================================"
echo ""

# ── Pre-checks ──────────────────────────────────────────────────────────────
echo "[0/5] Checking prerequisites..."

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed. Install Docker 24+ first."
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "ERROR: Docker Compose v2 is not installed."
  exit 1
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
echo "  Docker version: ${DOCKER_VERSION}"
echo "  Install directory: ${INSTALL_DIR}"
echo ""

# ── Step 1: Load Docker images ──────────────────────────────────────────────
echo "[1/5] Loading Docker images..."

if [ ! -d "${PACKAGE_DIR}/images" ]; then
  echo "ERROR: images/ directory not found in ${PACKAGE_DIR}"
  exit 1
fi

for tarfile in "${PACKAGE_DIR}/images/"*.tar; do
  if [ -f "$tarfile" ]; then
    echo "  Loading $(basename "$tarfile")..."
    docker load -i "$tarfile" --quiet
  fi
done

echo "  All images loaded."

# ── Step 2: Create install directory ─────────────────────────────────────────
echo "[2/5] Setting up installation directory..."
mkdir -p "${INSTALL_DIR}"

# Copy configuration files
cp "${PACKAGE_DIR}/docker-compose.prod.yml" "${INSTALL_DIR}/docker-compose.yml"
cp -r "${PACKAGE_DIR}/docker" "${INSTALL_DIR}/docker"
cp -r "${PACKAGE_DIR}/gatus" "${INSTALL_DIR}/gatus"
cp -r "${PACKAGE_DIR}/scripts" "${INSTALL_DIR}/scripts"
cp "${PACKAGE_DIR}/README-DEPLOY.md" "${INSTALL_DIR}/README-DEPLOY.md" 2>/dev/null || true
cp "${PACKAGE_DIR}/VERSION.json" "${INSTALL_DIR}/VERSION.json" 2>/dev/null || true

# ── Step 3: Configure environment ───────────────────────────────────────────
echo "[3/5] Configuring environment..."

ENV_FILE="${INSTALL_DIR}/backend/.env"
mkdir -p "${INSTALL_DIR}/backend"

if [ -f "${ENV_FILE}" ]; then
  echo "  Existing .env found — keeping it."
else
  cp "${PACKAGE_DIR}/.env.production.example" "${ENV_FILE}"

  # Generate random secrets
  JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
  JWT_REFRESH=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
  PG_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
  MINIO_KEY=$(head -c 16 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
  MINIO_SECRET=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
  WEBHOOK_SECRET=$(head -c 16 /dev/urandom | base64 | tr -d '/+=' | head -c 24)

  # Apply generated secrets
  sed -i "s|CHANGE_ME_strong_password_here|${PG_PASS}|g" "${ENV_FILE}"
  sed -i "s|CHANGE_ME_minio_access|${MINIO_KEY}|g" "${ENV_FILE}"
  sed -i "s|CHANGE_ME_minio_secret_min_16_chars|${MINIO_SECRET}|g" "${ENV_FILE}"
  sed -i "s|CHANGE_ME_random_64_char_string|${JWT_SECRET}|g" "${ENV_FILE}"
  sed -i "s|CHANGE_ME_different_random_64_char_string|${JWT_REFRESH}|g" "${ENV_FILE}"
  sed -i "s|CHANGE_ME_webhook_secret|${WEBHOOK_SECRET}|g" "${ENV_FILE}"

  # Also create the root .env.production for docker-compose vars
  cat > "${INSTALL_DIR}/.env" <<EOF
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=xch_dev
MINIO_ACCESS_KEY=${MINIO_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET}
HTTP_PORT=80
HTTPS_PORT=443
GATUS_PORT=8080
EOF

  echo "  Secrets generated and applied."
  echo "  Review: ${ENV_FILE}"
fi

# ── Step 4: Create data directories ─────────────────────────────────────────
echo "[4/5] Preparing data directories..."
mkdir -p "${INSTALL_DIR}/backups"

# ── Step 5: Start the stack ──────────────────────────────────────────────────
echo "[5/5] Starting XCH stack..."
cd "${INSTALL_DIR}"

docker compose -f docker-compose.yml up -d

echo ""
echo "======================================"
echo "  XCH Installation Complete!"
echo ""
echo "  Location:  ${INSTALL_DIR}"
echo "  URL:       http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
echo "  Setup:     Open the URL above → Setup Wizard"
echo ""
echo "  Useful commands:"
echo "    cd ${INSTALL_DIR}"
echo "    docker compose logs -f          # View logs"
echo "    docker compose ps               # Service status"
echo "    bash scripts/backup-full.sh     # Create backup"
echo "    bash scripts/restore-full.sh    # Restore backup"
echo "======================================"
