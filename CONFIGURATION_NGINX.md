# Configuration Nginx Proxy Manager - XCH Application

**Date:** 2026-01-31
**Environnement:** Production

## Domaines Configurés

### 1. xch.eoncom.io (Frontend - Application Web)

| Paramètre | Valeur |
|-----------|--------|
| **Domain Names** | `xch.eoncom.io` |
| **Scheme** | `http` |
| **Forward Hostname/IP** | `xch-frontend` (nom du conteneur Docker) |
| **Forward Port** | `3001` |
| **Block Common Exploits** | ✅ Activé |
| **Websockets Support** | ✅ Activé (pour PWA) |
| **SSL Certificate** | Let's Encrypt |
| **Force SSL** | ✅ Activé |
| **HTTP/2 Support** | ✅ Activé |

**Custom Nginx Configuration (Advanced):**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

### 2. xchapi.eoncom.io (Backend - API)

| Paramètre | Valeur |
|-----------|--------|
| **Domain Names** | `xchapi.eoncom.io` |
| **Scheme** | `http` |
| **Forward Hostname/IP** | `xch-backend` (nom du conteneur Docker) |
| **Forward Port** | `3002` |
| **Block Common Exploits** | ✅ Activé |
| **Websockets Support** | ❌ Désactivé |
| **SSL Certificate** | Let's Encrypt |
| **Force SSL** | ✅ Activé |
| **HTTP/2 Support** | ✅ Activé |

**Custom Nginx Configuration (Advanced):**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# CORS headers (handled by backend, but can be added here as backup)
# add_header 'Access-Control-Allow-Origin' 'https://xch.eoncom.io' always;
# add_header 'Access-Control-Allow-Credentials' 'true' always;
```

---

### 3. xchstr.eoncom.io (Storage - MinIO S3)

| Paramètre | Valeur |
|-----------|--------|
| **Domain Names** | `xchstr.eoncom.io` |
| **Scheme** | `http` |
| **Forward Hostname/IP** | `xch-minio` (nom du conteneur Docker) |
| **Forward Port** | `9000` |
| **Cache Assets** | ✅ Activé (recommandé pour fichiers statiques) |
| **Block Common Exploits** | ✅ Activé |
| **Websockets Support** | ❌ Désactivé |
| **SSL Certificate** | Let's Encrypt |
| **Force SSL** | ✅ Activé |
| **HTTP/2 Support** | ✅ Activé |

**Custom Nginx Configuration (Advanced):**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Cache configuration for static files
proxy_cache_valid 200 1h;
proxy_cache_valid 404 1m;
```

---

## Architecture Réseau

```
Internet (HTTPS)
    ↓
Nginx Proxy Manager (Ports 80/443)
    ├── xch.eoncom.io → xch-frontend:3001 (Next.js)
    ├── xchapi.eoncom.io → xch-backend:3002 (NestJS)
    └── xchstr.eoncom.io → xch-minio:9000 (MinIO S3)
```

## Conteneurs Docker (Réseau: xch_xch-network)

| Nom Conteneur | Service | Port Interne | Port Externe | Image |
|--------------|---------|--------------|--------------|-------|
| `xch-frontend` | Frontend | 3001 | 3001 | xch_frontend |
| `xch-backend` | Backend API | 3002 | 3002 | xch_backend |
| `xch-postgres` | Base de données | 5432 | 5433 | postgis/postgis:15-3.4-alpine |
| `xch-redis` | Cache/Queue | 6379 | 6380 | redis:7-alpine |
| `xch-minio` | Stockage S3 | 9000 | 9000 | minio/minio:latest |

## Variables d'Environnement Critiques

### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://xch_user:PASSWORD@postgres:5432/xch_dev"

# CORS
FRONTEND_URL="https://xch.eoncom.io"

# MinIO Storage
STORAGE_TYPE=minio
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_BUCKET=xch-storage
MINIO_PUBLIC_URL=https://xchstr.eoncom.io  # ⚠️ IMPORTANT: URL publique via Nginx
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://xchapi.eoncom.io  # ⚠️ IMPORTANT: API backend
NEXT_PUBLIC_APP_NAME=XCH
```

## Vérification Post-Déploiement

### 1. Test Frontend
```bash
curl -I https://xch.eoncom.io
# Expected: HTTP/2 200 OK ou 307 Redirect to /login
```

### 2. Test Backend API
```bash
curl -I https://xchapi.eoncom.io/api/auth/session
# Expected: HTTP/2 401 Unauthorized (normal sans cookies)
```

### 3. Test MinIO Storage
```bash
curl -I https://xchstr.eoncom.io/xch-storage/
# Expected: HTTP/2 200 ou 403 (selon bucket policy)
```

### 4. Test Complet Application
1. Ouvrir https://xch.eoncom.io
2. Login avec `admin@xch.demo` / `admin123`
3. Uploader un floor-plan ou attachment
4. Vérifier que l'URL commence par `https://xchstr.eoncom.io/xch-storage/`
5. Vérifier que l'image s'affiche correctement

## Troubleshooting

### Erreur CORS
- Vérifier `FRONTEND_URL` dans backend/.env
- Vérifier que les cookies sont activés dans le navigateur
- Vérifier les headers CORS dans Nginx (si configurés)

### Erreur 502 Bad Gateway
- Vérifier que les conteneurs Docker sont UP: `docker ps`
- Vérifier les logs: `docker logs xch-backend` ou `docker logs xch-frontend`
- Vérifier que les noms de conteneurs sont corrects (pas de préfixe aléatoire)

### Images MinIO ne chargent pas
- Vérifier `MINIO_PUBLIC_URL` dans backend/.env
- Vérifier que `xchstr.eoncom.io` est configuré dans Nginx
- Vérifier les permissions du bucket MinIO: doit être public en lecture

### Conteneurs avec préfixes aléatoires
```bash
cd /opt/xch-dev/XCH
docker-compose stop
docker-compose rm -f
docker-compose up -d
```

## Sécurité

### Headers de Sécurité (Recommandés dans Nginx)
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Rate Limiting (Optionnel)
Pour protéger l'API backend contre les abus:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req zone=api_limit burst=20 nodelay;
```

## Maintenance

### Backup Base de Données
```bash
docker exec xch-postgres pg_dump -U xch_user xch_dev > backup.sql
```

### Backup MinIO
```bash
docker exec xch-minio mc mirror /data/xch-storage /backup/xch-storage
```

### Mise à Jour Application
```bash
cd /opt/xch-dev/XCH
git pull origin main
docker-compose build
docker-compose stop backend frontend
docker-compose rm -f backend frontend
docker-compose up -d
```

---

**Dernière mise à jour:** 2026-01-31
**Configuration validée:** ✅ Production Ready
