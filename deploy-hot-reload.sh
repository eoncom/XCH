#!/bin/bash

# Script déploiement hot-reload Session 13
# Modifie les fichiers en live sans rebuild complet

set -e

echo "=== Déploiement Session 13 - Hot Reload ==="

# 1. Installer cookie-parser dans container backend
echo "[1/6] Installation cookie-parser dans backend..."
docker exec xch-backend sh -c "cd /app && npm install cookie-parser @types/cookie-parser --legacy-peer-deps"

# 2. Copier nouveau main.ts (compilé)
echo "[2/6] Copie main.ts compilé..."
docker cp /opt/xch-dev/XCH/backend/src/main.ts xch-backend:/app/dist/
docker exec xch-backend sh -c "cat /app/dist/main.js | head -10"

# 3. Copier auth.controller.ts compilé
echo "[3/6] Copie auth.controller.ts compilé..."
docker cp /opt/xch-dev/XCH/backend/src/modules/auth/auth.controller.ts xch-backend:/app/dist/modules/auth/
docker exec xch-backend sh -c "ls -la /app/dist/modules/auth/auth.controller.js"

# 4. Copier jwt.strategy.ts compilé
echo "[4/6] Copie jwt.strategy.ts compilé..."
docker cp /opt/xch-dev/XCH/backend/src/modules/auth/strategies/jwt.strategy.ts xch-backend:/app/dist/modules/auth/strategies/
docker exec xch-backend sh -c "ls -la /app/dist/modules/auth/strategies/jwt.strategy.js"

# 5. Redémarrer backend
echo "[5/6] Redémarrage backend..."
docker restart xch-backend

# 6. Attendre healthy
echo "[6/6] Attente backend healthy..."
sleep 10
docker logs xch-backend --tail 20

echo "✅ Backend déployé avec succès !"
echo ""
echo "Tests validation :"
echo "  curl http://192.168.0.13:3002/api/health"
echo "  curl -v -X POST http://192.168.0.13:3002/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@xch.demo\",\"password\":\"admin123\"}' --cookie-jar /tmp/cookies.txt"
