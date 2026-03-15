#!/bin/bash
# =============================================================================
# XCH — Package Release
# Builds all Docker images and creates a portable archive for deployment
#
# Usage: ./scripts/package-release.sh [version]
# Example: ./scripts/package-release.sh v1.0.0-rc1
# =============================================================================

set -euo pipefail

VERSION="${1:-v1.0.0-rc1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="/tmp/xch-release-${VERSION}"
ARCHIVE_NAME="xch-${VERSION}-full.tar.gz"
OUTPUT_DIR="${PROJECT_DIR}/releases"

echo "======================================"
echo "  XCH Release Packager"
echo "  Version: ${VERSION}"
echo "  $(date)"
echo "======================================"
echo ""

# ── Step 1: Build Docker images ─────────────────────────────────────────────
echo "[1/5] Building Docker images..."
cd "$PROJECT_DIR"

docker compose -f docker-compose.prod.yml build backend frontend

# Tag images
docker tag xch-backend:${VERSION} xch-backend:${VERSION}
docker tag xch-frontend:${VERSION} xch-frontend:${VERSION}

echo "  Backend image built: xch-backend:${VERSION}"
echo "  Frontend image built: xch-frontend:${VERSION}"

# ── Step 2: Export images ────────────────────────────────────────────────────
echo "[2/5] Exporting Docker images..."
mkdir -p "${BUILD_DIR}/images"

# Application images
docker save xch-backend:${VERSION} -o "${BUILD_DIR}/images/xch-backend.tar"
docker save xch-frontend:${VERSION} -o "${BUILD_DIR}/images/xch-frontend.tar"

# Infrastructure images (pull + save)
INFRA_IMAGES=(
  "postgis/postgis:15-3.4-alpine"
  "redis:7-alpine"
  "minio/minio:latest"
  "minio/mc:latest"
  "twinproduction/gatus:latest"
  "nginx:alpine"
)

for img in "${INFRA_IMAGES[@]}"; do
  echo "  Pulling ${img}..."
  docker pull "${img}" --quiet
  safe_name=$(echo "${img}" | tr '/:' '_')
  docker save "${img}" -o "${BUILD_DIR}/images/${safe_name}.tar"
done

echo "  All images exported."
echo "  Total size: $(du -sh "${BUILD_DIR}/images" | cut -f1)"

# ── Step 3: Copy configuration files ────────────────────────────────────────
echo "[3/5] Copying configuration files..."

# docker-compose
cp "${PROJECT_DIR}/docker-compose.prod.yml" "${BUILD_DIR}/docker-compose.prod.yml"

# nginx
mkdir -p "${BUILD_DIR}/docker/nginx"
cp "${PROJECT_DIR}/docker/nginx/nginx.conf" "${BUILD_DIR}/docker/nginx/nginx.conf"
mkdir -p "${BUILD_DIR}/docker/nginx/ssl"

# postgres init
mkdir -p "${BUILD_DIR}/docker/postgres"
cp "${PROJECT_DIR}/docker/postgres/init.sql" "${BUILD_DIR}/docker/postgres/init.sql"

# gatus
mkdir -p "${BUILD_DIR}/gatus"
cp "${PROJECT_DIR}/gatus/config.yaml" "${BUILD_DIR}/gatus/config.yaml"

# env example
cp "${PROJECT_DIR}/.env.production.example" "${BUILD_DIR}/.env.production.example"

# backend env template (stripped secrets)
cp "${PROJECT_DIR}/.env.production.example" "${BUILD_DIR}/backend/.env.example" 2>/dev/null || \
  cp "${PROJECT_DIR}/.env.production.example" "${BUILD_DIR}/.env.production.example"
mkdir -p "${BUILD_DIR}/backend"
cp "${PROJECT_DIR}/.env.production.example" "${BUILD_DIR}/backend/.env.example"

# ── Step 4: Copy scripts ────────────────────────────────────────────────────
echo "[4/5] Copying scripts..."
mkdir -p "${BUILD_DIR}/scripts"

cp "${SCRIPT_DIR}/install-airgap.sh" "${BUILD_DIR}/scripts/install-airgap.sh"
cp "${SCRIPT_DIR}/backup-full.sh" "${BUILD_DIR}/scripts/backup-full.sh"
cp "${SCRIPT_DIR}/restore-full.sh" "${BUILD_DIR}/scripts/restore-full.sh"
chmod +x "${BUILD_DIR}/scripts/"*.sh

# Copy README
cp "${PROJECT_DIR}/README-DEPLOY.md" "${BUILD_DIR}/README-DEPLOY.md" 2>/dev/null || true

# Create version metadata
cat > "${BUILD_DIR}/VERSION.json" <<EOF
{
  "version": "${VERSION}",
  "built_at": "$(date -Iseconds)",
  "built_by": "$(whoami)@$(hostname)",
  "images": [
    "xch-backend:${VERSION}",
    "xch-frontend:${VERSION}",
    "postgis/postgis:15-3.4-alpine",
    "redis:7-alpine",
    "minio/minio:latest",
    "minio/mc:latest",
    "twinproduction/gatus:latest",
    "nginx:alpine"
  ]
}
EOF

# ── Step 5: Create archive ──────────────────────────────────────────────────
echo "[5/5] Creating release archive..."
mkdir -p "${OUTPUT_DIR}"

cd /tmp
tar czf "${OUTPUT_DIR}/${ARCHIVE_NAME}" "xch-release-${VERSION}"

# Cleanup
rm -rf "${BUILD_DIR}"

# Summary
ARCHIVE_SIZE=$(du -sh "${OUTPUT_DIR}/${ARCHIVE_NAME}" | cut -f1)

echo ""
echo "======================================"
echo "  Release packaged successfully!"
echo ""
echo "  Archive: ${OUTPUT_DIR}/${ARCHIVE_NAME}"
echo "  Size:    ${ARCHIVE_SIZE}"
echo ""
echo "  Deploy on target server:"
echo "    tar xzf ${ARCHIVE_NAME}"
echo "    cd xch-release-${VERSION}"
echo "    bash scripts/install-airgap.sh"
echo "======================================"
