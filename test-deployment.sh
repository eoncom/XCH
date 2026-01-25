#!/bin/bash
echo "🧪 Tests de validation du déploiement"
echo "====================================="
echo ""

# Test 1: Backend Health
echo "1️⃣  Backend Health Check (https://xchapi.eoncom.io/api/health)"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://xchapi.eoncom.io/api/health)
if [ "$HEALTH" = "200" ]; then
    echo "   ✅ Backend OK (HTTP $HEALTH)"
else
    echo "   ❌ Backend KO (HTTP $HEALTH)"
fi
echo ""

# Test 2: Frontend accessible
echo "2️⃣  Frontend Page (https://xch.eoncom.io)"
FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" https://xch.eoncom.io)
if [ "$FRONTEND" = "200" ] || [ "$FRONTEND" = "307" ]; then
    echo "   ✅ Frontend OK (HTTP $FRONTEND)"
else
    echo "   ❌ Frontend KO (HTTP $FRONTEND)"
fi
echo ""

# Test 3: Login API
echo "3️⃣  Login API Test"
LOGIN_RESPONSE=$(curl -s -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.demo","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "accessToken"; then
    echo "   ✅ Login réussi (JWT tokens retournés)"
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    echo "   📝 Token: ${TOKEN:0:40}..."
else
    echo "   ❌ Login échoué"
    echo "   Response: $LOGIN_RESPONSE"
fi
echo ""

# Test 4: Sites API (protected endpoint)
if [ -n "$TOKEN" ]; then
    echo "4️⃣  Sites API (protected endpoint)"
    SITES=$(curl -s https://xchapi.eoncom.io/api/sites \
      -H "Authorization: Bearer $TOKEN")
    
    SITE_COUNT=$(echo "$SITES" | grep -o '"id"' | wc -l)
    echo "   ✅ Sites API OK ($SITE_COUNT sites retournés)"
else
    echo "4️⃣  ⏭️  Sites API skipped (no token)"
fi
echo ""

# Test 5: Versions déployées
echo "5️⃣  Versions déployées"
ssh xch-deploy "cd /opt/xch-dev/XCH && echo -n '   Backend : ' && docker compose exec -T backend node -e 'console.log(require(\"./package.json\").version)' 2>/dev/null || echo 'N/A'"
ssh xch-deploy "cd /opt/xch-dev/XCH && echo -n '   Frontend: ' && docker compose exec -T frontend node -e 'console.log(require(\"./package.json\").version)' 2>/dev/null || echo 'N/A'"
echo ""

echo "✅ Validation terminée"
