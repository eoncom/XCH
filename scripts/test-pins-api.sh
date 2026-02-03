#!/bin/bash

# Script de test pour vérifier les données des pins via l'API
# Usage: bash scripts/test-pins-api.sh

# Configuration
API_URL="${1:-https://xchapi.eoncom.io}"
EMAIL="${2:-admin@xch.demo}"
PASSWORD="${3:-admin123}"

echo "========================================="
echo "Test de l'API Pins - XCH"
echo "========================================="
echo "API URL: $API_URL"
echo "Email: $EMAIL"
echo ""

# 1. Login pour obtenir le token
echo "[1/4] Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Échec login. Réponse:"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login réussi"
echo ""

# 2. Récupérer la liste des floor plans
echo "[2/4] Récupération floor plans..."
FLOOR_PLANS=$(curl -s -X GET "$API_URL/api/floor-plans" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$FLOOR_PLANS" | jq '.' 2>/dev/null || echo "$FLOOR_PLANS"
echo ""

# Extraire le premier floor plan ID
FLOOR_PLAN_ID=$(echo "$FLOOR_PLANS" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$FLOOR_PLAN_ID" ]; then
  echo "⚠️  Aucun floor plan trouvé"
  exit 0
fi

echo "Floor plan ID: $FLOOR_PLAN_ID"
echo ""

# 3. Récupérer les détails du floor plan avec les pins
echo "[3/4] Récupération floor plan avec pins..."
FLOOR_PLAN_DETAIL=$(curl -s -X GET "$API_URL/api/floor-plans/$FLOOR_PLAN_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$FLOOR_PLAN_DETAIL" | jq '.' 2>/dev/null || echo "$FLOOR_PLAN_DETAIL"
echo ""

# 4. Extraire et afficher uniquement les pins
echo "[4/4] Analyse des pins..."
PINS=$(echo "$FLOOR_PLAN_DETAIL" | jq '.pins' 2>/dev/null)

if [ "$PINS" = "null" ] || [ -z "$PINS" ]; then
  echo "⚠️  Aucun pin trouvé pour ce floor plan"
else
  PIN_COUNT=$(echo "$PINS" | jq 'length' 2>/dev/null)
  echo "✅ $PIN_COUNT pin(s) trouvé(s)"
  echo ""
  echo "Détails des pins:"
  echo "$PINS" | jq -r '.[] | "  - ID: \(.id)\n    Type: \(.pinType)\n    Position: (\(.x), \(.y))\n    Label: \(.label // "N/A")\n    Asset: \(.asset.name // "N/A")\n"' 2>/dev/null || echo "$PINS"
fi

echo ""
echo "========================================="
echo "Test terminé"
echo "========================================="
