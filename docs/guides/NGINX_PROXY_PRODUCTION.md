# Configuration Nginx Proxy Manager - XCH Application

**Date:** 2026-01-17
**Infrastructure:** Nginx Proxy Manager avec wildcard SSL `*.eoncom.io`

---

## 📋 Vue d'ensemble

L'application XCH nécessite 2 proxy hosts dans Nginx Proxy Manager:

1. **Frontend** - `xch.eoncom.io` → `192.168.0.39:3001` (Next.js)
2. **Backend API** - `xchapi.eoncom.io` → `192.168.0.39:3002` (NestJS)

**Architecture cookies HTTP-only:**
- Backend crée les cookies avec `sameSite: 'none'` + `secure: true`
- Cookies partagés entre `xch.eoncom.io` ↔ `xchapi.eoncom.io` (cross-subdomain)
- HTTPS obligatoire pour `sameSite: 'none'`

---

## 🔧 Configuration Proxy Host 1 - Frontend

### Détails du domaine

**Domain Names:**
```
xch.eoncom.io
```

**Scheme:** `http`
**Forward Hostname/IP:** `192.168.0.39`
**Forward Port:** `3001`

### SSL

- ✅ **SSL Certificate:** Wildcard `*.eoncom.io`
- ✅ **Force SSL:** Activé (redirect HTTP → HTTPS)
- ✅ **HTTP/2 Support:** Activé
- ✅ **HSTS Enabled:** Recommandé (sécurité renforcée)

### Advanced Configuration

```nginx
# Next.js specific headers
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# WebSocket support (si nécessaire future)
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";

# Timeouts
proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;
```

---

## 🔧 Configuration Proxy Host 2 - Backend API

### Détails du domaine

**Domain Names:**
```
xchapi.eoncom.io
```

**Scheme:** `http`
**Forward Hostname/IP:** `192.168.0.39`
**Forward Port:** `3002`

### SSL

- ✅ **SSL Certificate:** Wildcard `*.eoncom.io`
- ✅ **Force SSL:** Activé (redirect HTTP → HTTPS)
- ✅ **HTTP/2 Support:** Activé
- ✅ **HSTS Enabled:** Recommandé

### Advanced Configuration

```nginx
# NestJS API headers
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Port $server_port;

# CORS headers (géré par NestJS, mais backup si nécessaire)
# add_header 'Access-Control-Allow-Origin' 'https://xch.eoncom.io' always;
# add_header 'Access-Control-Allow-Credentials' 'true' always;

# Timeouts (API peut avoir requêtes longues)
proxy_connect_timeout 120s;
proxy_send_timeout 120s;
proxy_read_timeout 120s;

# File upload support
client_max_body_size 50M;
```

---

## ✅ Tests de validation

### 1. Test Backend API

```bash
# Health check (endpoint n'existe pas, mais teste connexion)
curl -v https://xchapi.eoncom.io/api/auth/session

# Doit retourner: 401 Unauthorized (normal, pas de cookie)
# ✅ Si 401: Backend répond correctement
# ❌ Si timeout/502: Problème proxy ou backend down
```

### 2. Test Frontend

```bash
# Test page login
curl -I https://xch.eoncom.io/login

# Doit retourner: 200 OK
# ✅ Si 200: Frontend répond correctement
# ❌ Si 502: Problème proxy ou frontend down
```

### 3. Test Login complet (navigateur)

1. **Ouvrir:** https://xch.eoncom.io/login
2. **Credentials:** admin@xch.demo / admin123
3. **Submit**

**Vérifications DevTools (F12):**

**Network Tab → login request:**
```
Request URL: https://xchapi.eoncom.io/api/auth/login
Status: 200 OK (ou 201)
Response Headers:
  Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=None
  Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=None
```

**Application Tab → Cookies → https://xch.eoncom.io:**
```
accessToken:
  Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  HttpOnly: ✅
  Secure: ✅
  SameSite: None
  Domain: xch.eoncom.io

refreshToken:
  Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  HttpOnly: ✅
  Secure: ✅
  SameSite: None
  Domain: xch.eoncom.io
  Path: /api/auth/refresh
```

**Redirect:** https://xch.eoncom.io/dashboard

### 4. Test Session Persistante (F5 Reload)

1. **Sur:** https://xch.eoncom.io/dashboard
2. **F5** (reload page)

**Attendu:**
- ✅ Pas de redirect vers /login
- ✅ Dashboard affiche données utilisateur
- ✅ Cookies toujours présents dans DevTools

**Si redirect /login → PROBLÈME:**
- Backend n'a pas reçu le cookie
- Vérifier configuration CORS backend
- Vérifier cookies dans Application tab

### 5. Test Logout

1. **Clic:** Bouton Logout (user menu)

**Network Tab → logout request:**
```
Request URL: https://xchapi.eoncom.io/api/auth/logout
Status: 200 OK (ou 201)
Response Headers:
  Set-Cookie: accessToken=; Max-Age=0
  Set-Cookie: refreshToken=; Max-Age=0
```

**Application Tab → Cookies:**
```
✅ accessToken: supprimé
✅ refreshToken: supprimé
```

**Redirect:** https://xch.eoncom.io/login

---

## 🚨 Troubleshooting

### Problème 1: "Failed to fetch" lors login

**Cause:** CORS credentials non autorisé ou backend inaccessible

**Vérifications:**
```bash
# Backend .env
ssh xch-deploy "cat /opt/xch-dev/XCH/backend/.env | grep FRONTEND_URL"
# Doit afficher: FRONTEND_URL="https://xch.eoncom.io"

# Backend logs
ssh xch-deploy "docker logs xch-backend --tail 50 | grep -i cors"
# Doit afficher: enableCors({ origin: 'https://xch.eoncom.io', credentials: true })

# Test direct backend
curl -v https://xchapi.eoncom.io/api/auth/session \
  -H "Origin: https://xch.eoncom.io" \
  2>&1 | grep -i "access-control"
# Doit afficher: Access-Control-Allow-Origin: https://xch.eoncom.io
# Doit afficher: Access-Control-Allow-Credentials: true
```

**Solution:**
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH/backend
echo 'FRONTEND_URL="https://xch.eoncom.io"' >> .env
docker restart xch-backend
```

---

### Problème 2: Cookies non créés après login

**Cause:** `sameSite: 'none'` requiert HTTPS (`secure: true`)

**Vérifications DevTools:**
- Application → Cookies → https://xch.eoncom.io
- Si vide après login → backend n'a pas envoyé Set-Cookie

**Vérifications backend:**
```bash
# Logs backend pendant login
ssh xch-deploy "docker logs xch-backend -f"

# Test curl avec verbose
curl -v -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://xch.eoncom.io" \
  -d '{"email":"admin@xch.demo","password":"admin123"}' \
  --cookie-jar /tmp/test-cookies.txt

# Vérifier cookies créés
cat /tmp/test-cookies.txt
# Doit afficher: xch.eoncom.io FALSE / TRUE ... accessToken ...
```

**Solution:**
- Vérifier backend `auth.controller.ts` contient `secure: true, sameSite: 'none'`
- Rebuild backend si nécessaire

---

### Problème 3: Session perdue après F5 (reload)

**Cause 1:** Cookies non envoyés dans requête `/api/auth/session`

**Vérification DevTools:**
- Network → session request → Request Headers → Cookie
- Doit contenir: `accessToken=eyJhbG...`

**Si absent:**
- Vérifier cookies présents dans Application tab
- Vérifier `credentials: 'include'` dans `frontend/src/stores/auth-store.ts`

**Cause 2:** JWT expiré (15 minutes)

**Vérification:**
```bash
# Décoder JWT (utiliser jwt.io ou commande)
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | base64 -d
# Vérifier "exp": timestamp
```

**Solution:**
- Refresh automatique via `/api/auth/refresh` avec `refreshToken` cookie (7 jours)
- Vérifier `api-client.ts` gère refresh automatique

---

### Problème 4: 502 Bad Gateway

**Cause:** Container backend ou frontend down

**Vérifications:**
```bash
ssh xch-deploy

# Status containers
docker ps --filter name=xch

# Doit afficher:
# xch-backend   Up XX minutes   0.0.0.0:3002->3002/tcp
# xch-frontend  Up XX minutes   0.0.0.0:3001->3001/tcp

# Si down, restart
docker restart xch-backend xch-frontend

# Logs errors
docker logs xch-backend --tail 100
docker logs xch-frontend --tail 100
```

---

### Problème 5: CORS errors dans console navigateur

**Erreur typique:**
```
Access to fetch at 'https://xchapi.eoncom.io/api/auth/login' from origin 'https://xch.eoncom.io'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true'
when the request's credentials mode is 'include'.
```

**Cause:** Backend CORS credentials non configuré

**Solution:**
```bash
# Vérifier backend main.ts
ssh xch-deploy "docker exec xch-backend cat src/main.ts | grep -A5 enableCors"

# Doit contenir:
# app.enableCors({
#   origin: configService.get('FRONTEND_URL', 'http://localhost:3001'),
#   credentials: true,
# });

# Si absent, recompiler backend avec fix
```

---

## 📊 Métriques attendues

| Métrique | Avant (192.168.0.13:port) | Après (SSL domain) |
|----------|---------------------------|---------------------|
| **Login success** | ❌ Cookies non partagés | ✅ Cookies HTTP-only |
| **F5 reload** | ❌ Redirect /login | ✅ Session maintenue |
| **Logout** | ❌ Timeout | ✅ Fonctionnel |
| **Sécurité** | 🟡 HTTP + localStorage | ✅ HTTPS + HttpOnly |
| **Tests E2E** | 2/57 (3%) | 57/57 attendu (100%) |

---

## 📞 Support

**Logs temps réel:**
```bash
# Backend
ssh xch-deploy "docker logs xch-backend -f"

# Frontend
ssh xch-deploy "docker logs xch-frontend -f"

# Nginx Proxy Manager
# Voir logs dans interface NPM ou container logs
```

**Restart complet:**
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
docker restart xch-backend xch-frontend
```

**Configuration actuelle:**
- **Backend:** `/opt/xch-dev/XCH/backend/.env`
- **Frontend:** `/opt/xch-dev/XCH/frontend/.env.local`
- **Docker Compose:** `/opt/xch-dev/XCH/docker-compose.yml`

---

**Guide créé par:** Claude Sonnet 4.5
**Date:** 2026-01-17
**Session:** 13 - Fix SSR/CSR Cookies avec SSL/Nginx Proxy Manager
