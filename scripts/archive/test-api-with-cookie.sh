#!/bin/bash

# Test login et récupération du cookie
echo "🔐 Test authentification avec cookies"
echo "======================================"
echo ""

# Login et sauvegarde des cookies
echo "1️⃣  Login avec admin@xch.demo..."
curl -s -c cookies.txt -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.demo","password":"admin123"}' > /dev/null

if [ -f cookies.txt ]; then
    echo "   ✅ Cookies sauvegardés"
    echo ""
    echo "   📋 Cookies reçus:"
    cat cookies.txt | grep -v '^#' | awk '{print "      " $6 "=" substr($7,1,40) "..."}'
    echo ""
else
    echo "   ❌ Échec sauvegarde cookies"
    exit 1
fi

# Test endpoint protégé
echo "2️⃣  Test endpoint protégé /api/sites avec cookie..."
SITES_RESPONSE=$(curl -s -b cookies.txt https://xchapi.eoncom.io/api/sites)
SITE_COUNT=$(echo "$SITES_RESPONSE" | grep -o '"id"' | wc -l)

if [ "$SITE_COUNT" -gt 0 ]; then
    echo "   ✅ API Sites accessible ($SITE_COUNT sites retournés)"
else
    echo "   ❌ API Sites échoué"
    echo "   Response: ${SITES_RESPONSE:0:200}"
fi
echo ""

# Test endpoint users
echo "3️⃣  Test endpoint /api/users avec cookie..."
USERS_RESPONSE=$(curl -s -b cookies.txt https://xchapi.eoncom.io/api/users)
USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"email"' | wc -l)

if [ "$USER_COUNT" -gt 0 ]; then
    echo "   ✅ API Users accessible ($USER_COUNT utilisateurs retournés)"
else
    echo "   ❌ API Users échoué"
fi
echo ""

# Cleanup
rm -f cookies.txt

echo "✅ Tests terminés"
