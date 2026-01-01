# DOCKER_PORTS.md - Gestion des Ports & Isolation Docker

**Date:** 2026-01-01
**Projet:** XCH - Gestion IT Chantiers Temporaires
**Objectif:** Guide complet sur la gestion des ports Docker et l'isolation des services

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture réseau Docker](#architecture-réseau-docker)
3. [Liste des ports par défaut](#liste-des-ports-par-défaut)
4. [Détection des conflits de ports](#détection-des-conflits-de-ports)
5. [Configuration personnalisée des ports](#configuration-personnalisée-des-ports)
6. [Isolation multi-instances](#isolation-multi-instances)
7. [Sécurité réseau](#sécurité-réseau)
8. [Scripts de vérification](#scripts-de-vérification)
9. [Troubleshooting](#troubleshooting)
10. [Exemples de scénarios](#exemples-de-scénarios)

---

## Vue d'ensemble

### Pourquoi gérer les ports Docker ?

XCH utilise plusieurs services Docker (PostgreSQL, Redis, MinIO) qui nécessitent des ports spécifiques. Les problèmes courants incluent :

- **Conflits de ports** - Un autre service utilise déjà le port (ex: PostgreSQL système sur 5432)
- **Multi-instances** - Plusieurs environnements XCH sur le même serveur (dev, staging, prod)
- **Sécurité** - Ports exposés inutilement sur internet
- **Isolation** - Services XCH qui interfèrent avec d'autres applications

### Philosophie de gestion des ports

1. **Ports configurables** - Tous les ports sont définis via variables d'environnement
2. **Valeurs par défaut sensées** - Utilisation des ports standards quand possible
3. **Isolation réseau** - Réseau Docker dédié (`xch-network`)
4. **Exposition minimale** - Seuls les ports nécessaires sont exposés sur l'hôte
5. **Documentation explicite** - Chaque port est documenté avec son usage

---

## Architecture réseau Docker

### Schéma réseau XCH

```
┌─────────────────────────────────────────────────────────────────┐
│                         SERVEUR HÔTE                            │
│  (Linux/Windows avec Docker)                                    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              RÉSEAU DOCKER : xch-network                  │ │
│  │              (Bridge isolé 172.18.0.0/16)                 │ │
│  │                                                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │ xch-postgres │  │  xch-redis   │  │  xch-minio   │  │ │
│  │  │ Port: 5432   │  │ Port: 6379   │  │ Port: 9000   │  │ │
│  │  │ (interne)    │  │ (interne)    │  │ Port: 9001   │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  │         ▲                 ▲                 ▲           │ │
│  │         │                 │                 │           │ │
│  │         └─────────────────┴─────────────────┘           │ │
│  │                           │                             │ │
│  │                  ┌────────▼─────────┐                   │ │
│  │                  │  xch-backend     │                   │ │
│  │                  │  Port: 3000      │                   │ │
│  │                  └──────────────────┘                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                           │                                   │
│                           │ (Mapping de ports)                │
│                           ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              PORTS EXPOSÉS SUR HÔTE                       │ │
│  │                                                           │ │
│  │  :5432 → xch-postgres:5432                               │ │
│  │  :6379 → xch-redis:6379                                  │ │
│  │  :9000 → xch-minio:9000 (API)                            │ │
│  │  :9001 → xch-minio:9001 (Console)                        │ │
│  │  :3000 → xch-backend:3000 (API)                          │ │
│  │  :3001 → xch-frontend:3000 (App)                         │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Firewall (UFW / iptables)                                      │
│  - Ports 80/443 ouverts (Nginx)                                 │
│  - Ports internes fermés (5432, 6379, 9000, etc.)              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
                     INTERNET / LAN
```

### Réseau Docker `xch-network`

Le réseau Docker dédié offre :

- **Isolation** - Les conteneurs XCH ne sont pas visibles par d'autres conteneurs
- **DNS interne** - Résolution automatique des noms de conteneurs
- **Contrôle du trafic** - Pas de communication entre réseaux Docker différents
- **Sécurité** - Les conteneurs ne peuvent pas accéder aux autres réseaux par défaut

**Configuration dans `docker-compose.yml` :**

```yaml
networks:
  xch-network:
    name: xch-network
    driver: bridge
    ipam:
      config:
        - subnet: 172.18.0.0/16
```

### Communication interne vs exposition externe

| Service        | Port interne | Port hôte | Exposition | Usage                          |
|----------------|--------------|-----------|------------|--------------------------------|
| PostgreSQL     | 5432         | ${POSTGRES_PORT:-5432} | **Dev seulement** | Accès DB depuis hôte pour pgAdmin |
| Redis          | 6379         | ${REDIS_PORT:-6379} | **Dev seulement** | Monitoring Redis CLI          |
| MinIO API      | 9000         | ${MINIO_PORT:-9000} | **Dev + Prod** | Upload fichiers (backend)     |
| MinIO Console  | 9001         | ${MINIO_CONSOLE_PORT:-9001} | **Dev seulement** | Interface admin MinIO         |
| Backend API    | 3000         | ${APP_PORT:-3000} | **Dev + Prod** | API NestJS                    |
| Frontend App   | 3000         | 3001      | **Dev + Prod** | Application Next.js           |

**⚠️ IMPORTANT pour la production :**

En production, **seuls les ports 80 (HTTP) et 443 (HTTPS)** doivent être exposés publiquement. Les autres ports (PostgreSQL, Redis, MinIO) ne doivent **jamais** être accessibles depuis internet.

```bash
# Configuration firewall production (UFW)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 5432/tcp     # PostgreSQL (bloqué)
sudo ufw deny 6379/tcp     # Redis (bloqué)
sudo ufw deny 9000:9001/tcp # MinIO (bloqué)
sudo ufw enable
```

---

## Liste des ports par défaut

### Services infrastructure (Docker Compose)

| Service       | Variable env            | Port par défaut | Protocole | Usage                                |
|---------------|-------------------------|-----------------|-----------|--------------------------------------|
| **PostgreSQL**| `POSTGRES_PORT`         | 5432            | TCP       | Base de données principale           |
| **Redis**     | `REDIS_PORT`            | 6379            | TCP       | Cache et sessions                    |
| **MinIO API** | `MINIO_PORT`            | 9000            | HTTP      | API S3-compatible (upload fichiers)  |
| **MinIO Console** | `MINIO_CONSOLE_PORT` | 9001            | HTTP      | Interface web admin MinIO            |

### Services application

| Service       | Variable env            | Port par défaut | Protocole | Usage                                |
|---------------|-------------------------|-----------------|-----------|--------------------------------------|
| **Backend**   | `APP_PORT`              | 3000            | HTTP      | API NestJS (REST + WebSocket)        |
| **Frontend**  | (hardcodé)              | 3001            | HTTP      | Application Next.js                  |

### Ports système courants (risques de conflits)

| Service            | Port par défaut | Conflit potentiel avec                      |
|--------------------|-----------------|---------------------------------------------|
| PostgreSQL         | 5432            | PostgreSQL système installé                 |
| Redis              | 6379            | Redis système installé                      |
| MinIO              | 9000            | Portainer, autres services S3               |
| Backend (3000)     | 3000            | Node.js dev servers, React CRA              |
| Frontend (3001)    | 3001            | Autres applications Next.js                 |

### Ports de monitoring (optionnels)

Si vous ajoutez des outils de monitoring :

| Outil              | Port par défaut | Usage                                       |
|--------------------|-----------------|---------------------------------------------|
| Prometheus         | 9090            | Métriques time-series                       |
| Grafana            | 3002            | Dashboard visualisation                     |
| pgAdmin            | 5050            | Interface web PostgreSQL                    |
| RedisInsight       | 8001            | Interface web Redis                         |

---

## Détection des conflits de ports

### Méthode 1 : Vérification manuelle (Linux/WSL)

#### Avec `netstat` (installé par défaut)

```bash
# Vérifier si PostgreSQL (5432) est utilisé
sudo netstat -tulnp | grep :5432

# Vérifier tous les ports XCH
sudo netstat -tulnp | grep -E ':(5432|6379|9000|9001|3000|3001)'
```

**Sortie exemple :**

```
tcp        0      0 0.0.0.0:5432     0.0.0.0:*       LISTEN      1234/postgres
tcp        0      0 127.0.0.1:6379   0.0.0.0:*       LISTEN      5678/redis-server
```

**Interprétation :**
- `0.0.0.0:5432` - PostgreSQL écoute sur toutes les interfaces (conflit !)
- `127.0.0.1:6379` - Redis écoute uniquement sur localhost (OK, mais conflit possible)

#### Avec `ss` (plus rapide, recommandé)

```bash
# Vérifier si un port est libre
ss -tuln | grep :5432

# Vérifier tous les ports XCH avec détails
ss -tulnp | grep -E ':(5432|6379|9000|9001|3000|3001)'
```

#### Avec `lsof` (affiche le processus complet)

```bash
# Installer lsof si nécessaire
sudo apt install lsof

# Voir quel processus utilise le port 5432
sudo lsof -i :5432

# Exemple de sortie :
# COMMAND     PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# postgres  12345  postgres    5u  IPv4  98765      0t0  TCP *:5432 (LISTEN)
```

### Méthode 2 : Vérification des conteneurs Docker actifs

```bash
# Lister tous les conteneurs avec ports mappés
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Exemple de sortie :
# NAMES              PORTS
# xch-postgres       0.0.0.0:5432->5432/tcp
# xch-redis          0.0.0.0:6379->6379/tcp
# other-postgres     0.0.0.0:5433->5432/tcp
```

### Méthode 3 : Vérification Windows (PowerShell)

```powershell
# Vérifier un port spécifique
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue

# Vérifier tous les ports XCH
5432,6379,9000,9001,3000,3001 | ForEach-Object {
    $port = $_
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "Port $port : UTILISÉ" -ForegroundColor Red
        $conn | Select-Object LocalPort, State, OwningProcess
    } else {
        Write-Host "Port $port : LIBRE" -ForegroundColor Green
    }
}
```

### Méthode 4 : Test de connexion (cross-platform)

```bash
# Tester si un port répond (Linux/macOS/WSL)
timeout 1 bash -c "echo > /dev/tcp/localhost/5432" 2>/dev/null && echo "Port 5432 utilisé" || echo "Port 5432 libre"

# Avec nc (netcat)
nc -zv localhost 5432
# Sortie si occupé : Connection to localhost 5432 port [tcp/postgresql] succeeded!
# Sortie si libre : nc: connect to localhost port 5432 (tcp) failed: Connection refused
```

### Méthode 5 : Script de vérification automatique

Créez `scripts/check-ports.sh` :

```bash
#!/bin/bash

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "  XCH - Vérification des ports requis"
echo "========================================="
echo ""

# Ports à vérifier
declare -A PORTS=(
    [5432]="PostgreSQL"
    [6379]="Redis"
    [9000]="MinIO API"
    [9001]="MinIO Console"
    [3000]="Backend NestJS"
    [3001]="Frontend Next.js"
)

CONFLICTS=0

for port in "${!PORTS[@]}"; do
    service="${PORTS[$port]}"

    # Vérification avec netstat/ss (selon disponibilité)
    if command -v ss &> /dev/null; then
        result=$(ss -tuln | grep ":$port " 2>/dev/null)
    elif command -v netstat &> /dev/null; then
        result=$(netstat -tuln | grep ":$port " 2>/dev/null)
    else
        echo -e "${YELLOW}⚠️  Ni ss ni netstat disponibles, installation de net-tools...${NC}"
        sudo apt-get install -y net-tools
        result=$(netstat -tuln | grep ":$port " 2>/dev/null)
    fi

    if [ -n "$result" ]; then
        echo -e "${RED}❌ Port $port ($service) : UTILISÉ${NC}"

        # Tenter d'identifier le processus
        if command -v lsof &> /dev/null; then
            echo "   Processus :"
            sudo lsof -i :$port | tail -n +2 | awk '{print "   - " $1 " (PID: " $2 ")"}'
        fi

        ((CONFLICTS++))
    else
        echo -e "${GREEN}✅ Port $port ($service) : LIBRE${NC}"
    fi
done

echo ""
echo "========================================="
if [ $CONFLICTS -eq 0 ]; then
    echo -e "${GREEN}✅ Tous les ports sont disponibles !${NC}"
    exit 0
else
    echo -e "${RED}❌ $CONFLICTS port(s) en conflit détecté(s)${NC}"
    echo ""
    echo "Solutions :"
    echo "1. Arrêter les services conflictuels :"
    echo "   sudo systemctl stop postgresql"
    echo "   sudo systemctl stop redis"
    echo ""
    echo "2. Utiliser des ports alternatifs (voir .env) :"
    echo "   POSTGRES_PORT=5433"
    echo "   REDIS_PORT=6380"
    echo "   MINIO_PORT=9002"
    echo ""
    echo "3. Utiliser Docker avec ports personnalisés :"
    echo "   Voir DOCKER_PORTS.md section 'Configuration personnalisée'"
    exit 1
fi
```

**Utilisation :**

```bash
# Rendre le script exécutable
chmod +x scripts/check-ports.sh

# Lancer la vérification
./scripts/check-ports.sh
```

**Sortie exemple :**

```
=========================================
  XCH - Vérification des ports requis
=========================================

✅ Port 5432 (PostgreSQL) : LIBRE
❌ Port 6379 (Redis) : UTILISÉ
   Processus :
   - redis-server (PID: 1234)
✅ Port 9000 (MinIO API) : LIBRE
✅ Port 9001 (MinIO Console) : LIBRE
✅ Port 3000 (Backend NestJS) : LIBRE
✅ Port 3001 (Frontend Next.js) : LIBRE

=========================================
❌ 1 port(s) en conflit détecté(s)

Solutions :
1. Arrêter les services conflictuels :
   sudo systemctl stop redis
...
```

---

## Configuration personnalisée des ports

### Fichier `.env` avec ports personnalisés

#### Développement (`.env`)

```env
# ================================
# PORTS PERSONNALISÉS (Développement)
# ================================

# Infrastructure Docker
POSTGRES_PORT=5433      # Alternative à 5432 (si conflit)
REDIS_PORT=6380         # Alternative à 6379 (si conflit)
MINIO_PORT=9002         # Alternative à 9000 (si conflit)
MINIO_CONSOLE_PORT=9003 # Alternative à 9001 (si conflit)

# Application
APP_PORT=3000           # Backend NestJS
# Frontend : port fixe 3001 (package.json)

# DATABASE_URL doit utiliser POSTGRES_PORT
DATABASE_URL="postgresql://xch_user:xch_password_dev@localhost:5433/xch_dev?schema=public"

# Redis URL avec port personnalisé
REDIS_HOST=localhost
REDIS_PORT=6380

# MinIO avec port personnalisé
MINIO_ENDPOINT=localhost
MINIO_PORT=9002
MINIO_USE_SSL=false
```

#### Production (`.env.production`)

```env
# ================================
# PORTS PERSONNALISÉS (Production)
# ================================

# ⚠️ En production, les ports internes Docker ne changent PAS
# Seuls les ports exposés sur l'hôte changent

# Infrastructure (ports hôte → conteneur)
POSTGRES_PORT=5433      # Hôte:5433 → Conteneur:5432
REDIS_PORT=6380         # Hôte:6380 → Conteneur:6379
MINIO_PORT=9002         # Hôte:9002 → Conteneur:9000
MINIO_CONSOLE_PORT=9003 # Hôte:9003 → Conteneur:9001

# Application
APP_PORT=3000           # Backend API (derrière Nginx)

# DATABASE_URL utilise le nom du conteneur (DNS interne)
DATABASE_URL="postgresql://xch_user:${POSTGRES_PASSWORD}@xch-postgres:5432/xch_production?schema=public"

# Redis avec nom de conteneur
REDIS_HOST=xch-redis
REDIS_PORT=6379         # Port INTERNE conteneur

# MinIO avec nom de conteneur
MINIO_ENDPOINT=xch-minio
MINIO_PORT=9000         # Port INTERNE conteneur
MINIO_USE_SSL=false
```

### Modifier `docker-compose.yml` pour ports variables

**Version de base (ports fixes) :**

```yaml
services:
  postgres:
    image: postgis/postgis:15-3.4
    container_name: xch-postgres
    ports:
      - "5432:5432"    # ❌ Port fixe
```

**Version avec variables d'environnement :**

```yaml
services:
  postgres:
    image: postgis/postgis:15-3.4
    container_name: xch-postgres
    ports:
      - "${POSTGRES_PORT:-5432}:5432"  # ✅ Port configurable
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-xch_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-xch_production}
    volumes:
      - xch-postgres-data:/var/lib/postgresql/data
    networks:
      - xch-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: xch-redis
    ports:
      - "${REDIS_PORT:-6379}:6379"  # ✅ Port configurable
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - xch-redis-data:/data
    networks:
      - xch-network
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: xch-minio
    ports:
      - "${MINIO_PORT:-9000}:9000"              # ✅ API
      - "${MINIO_CONSOLE_PORT:-9001}:9001"      # ✅ Console
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - xch-minio-data:/data
    networks:
      - xch-network
    restart: unless-stopped

networks:
  xch-network:
    name: xch-network
    driver: bridge

volumes:
  xch-postgres-data:
    name: xch-postgres-data
  xch-redis-data:
    name: xch-redis-data
  xch-minio-data:
    name: xch-minio-data
```

**Syntaxe `${VAR:-default}` :**

- `${POSTGRES_PORT:-5432}` : Utilise `$POSTGRES_PORT` si défini, sinon `5432`
- Permet de ne pas définir de variables si vous utilisez les ports par défaut
- Flexible pour multi-environnements

### Tester la configuration

```bash
# Vérifier que Docker Compose lit bien les variables
docker-compose config

# Vérifier les ports mappés avant de démarrer
docker-compose config | grep -A 5 "ports:"

# Démarrer avec ports personnalisés
docker-compose --env-file .env.production up -d

# Vérifier les ports actifs
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Sortie attendue avec ports personnalisés :**

```
NAMES              PORTS
xch-postgres       0.0.0.0:5433->5432/tcp
xch-redis          0.0.0.0:6380->6379/tcp
xch-minio          0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp
```

### Mise à jour du backend pour ports personnalisés

**`backend/src/config/database.config.ts` :**

```typescript
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService) => {
  // Le DATABASE_URL contient déjà le bon port
  const databaseUrl = configService.get<string>('DATABASE_URL');

  return {
    datasourceUrl: databaseUrl,
  };
};
```

**`backend/src/config/redis.config.ts` :**

```typescript
import { ConfigService } from '@nestjs/config';

export const getRedisConfig = (configService: ConfigService) => {
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),  // ✅ Port configurable
    password: configService.get<string>('REDIS_PASSWORD'),
  };
};
```

**`backend/src/config/minio.config.ts` :**

```typescript
import { ConfigService } from '@nestjs/config';

export const getMinioConfig = (configService: ConfigService) => {
  return {
    endPoint: configService.get<string>('MINIO_ENDPOINT', 'localhost'),
    port: configService.get<number>('MINIO_PORT', 9000),  // ✅ Port configurable
    useSSL: configService.get<boolean>('MINIO_USE_SSL', false),
    accessKey: configService.get<string>('MINIO_ROOT_USER'),
    secretKey: configService.get<string>('MINIO_ROOT_PASSWORD'),
  };
};
```

---

## Isolation multi-instances

### Scénario : Plusieurs environnements XCH sur le même serveur

Vous voulez exécuter 3 instances XCH simultanément :
- **Développement** - Ports 543x, 638x, 900x
- **Staging** - Ports 544x, 639x, 901x
- **Production** - Ports 545x, 640x, 902x

### Stratégie 1 : Dossiers séparés avec `.env` différents

**Structure :**

```
/opt/xch/
├── dev/
│   ├── .env
│   ├── docker-compose.yml
│   └── ...
├── staging/
│   ├── .env
│   ├── docker-compose.yml
│   └── ...
└── prod/
    ├── .env
    ├── docker-compose.yml
    └── ...
```

**Configuration `.env` pour chaque environnement :**

#### `/opt/xch/dev/.env`

```env
# Environnement : DÉVELOPPEMENT
COMPOSE_PROJECT_NAME=xch-dev

# Ports
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
APP_PORT=3100
# Frontend : 3101

# Database
DATABASE_URL="postgresql://xch_user:dev_pass@xch-dev-postgres:5432/xch_dev?schema=public"
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=dev_pass
POSTGRES_DB=xch_dev

# Redis
REDIS_HOST=xch-dev-redis
REDIS_PORT=6379
REDIS_PASSWORD=dev_redis_pass

# MinIO
MINIO_ENDPOINT=xch-dev-minio
MINIO_PORT=9000
MINIO_ROOT_USER=dev_minio_user
MINIO_ROOT_PASSWORD=dev_minio_pass
```

**Modifier `docker-compose.yml` pour préfixer les noms :**

```yaml
services:
  postgres:
    container_name: ${COMPOSE_PROJECT_NAME:-xch}-postgres
    # ... reste identique
    networks:
      - xch-dev-network

  redis:
    container_name: ${COMPOSE_PROJECT_NAME:-xch}-redis
    # ... reste identique
    networks:
      - xch-dev-network

  minio:
    container_name: ${COMPOSE_PROJECT_NAME:-xch}-minio
    # ... reste identique
    networks:
      - xch-dev-network

networks:
  xch-dev-network:
    name: ${COMPOSE_PROJECT_NAME:-xch}-network
    driver: bridge

volumes:
  xch-postgres-data:
    name: ${COMPOSE_PROJECT_NAME:-xch}-postgres-data
  xch-redis-data:
    name: ${COMPOSE_PROJECT_NAME:-xch}-redis-data
  xch-minio-data:
    name: ${COMPOSE_PROJECT_NAME:-xch}-minio-data
```

#### `/opt/xch/staging/.env`

```env
# Environnement : STAGING
COMPOSE_PROJECT_NAME=xch-staging

# Ports (décalés de +10)
POSTGRES_PORT=5442
REDIS_PORT=6389
MINIO_PORT=9010
MINIO_CONSOLE_PORT=9011
APP_PORT=3200
# Frontend : 3201

# Database
DATABASE_URL="postgresql://xch_user:staging_pass@xch-staging-postgres:5432/xch_staging?schema=public"
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=staging_pass
POSTGRES_DB=xch_staging

# Redis
REDIS_HOST=xch-staging-redis
REDIS_PORT=6379
REDIS_PASSWORD=staging_redis_pass

# MinIO
MINIO_ENDPOINT=xch-staging-minio
MINIO_PORT=9000
MINIO_ROOT_USER=staging_minio_user
MINIO_ROOT_PASSWORD=staging_minio_pass
```

#### `/opt/xch/prod/.env`

```env
# Environnement : PRODUCTION
COMPOSE_PROJECT_NAME=xch-prod

# Ports (décalés de +20)
POSTGRES_PORT=5452
REDIS_PORT=6399
MINIO_PORT=9020
MINIO_CONSOLE_PORT=9021
APP_PORT=3300
# Frontend : 3301

# Database
DATABASE_URL="postgresql://xch_user:STRONG_PROD_PASSWORD@xch-prod-postgres:5432/xch_production?schema=public"
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=STRONG_PROD_PASSWORD
POSTGRES_DB=xch_production

# Redis
REDIS_HOST=xch-prod-redis
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PASSWORD

# MinIO
MINIO_ENDPOINT=xch-prod-minio
MINIO_PORT=9000
MINIO_ROOT_USER=prod_minio_user
MINIO_ROOT_PASSWORD=STRONG_MINIO_PASSWORD
```

### Lancement des 3 environnements

```bash
# Développement
cd /opt/xch/dev
docker-compose up -d

# Staging
cd /opt/xch/staging
docker-compose up -d

# Production
cd /opt/xch/prod
docker-compose up -d

# Vérifier tous les conteneurs
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep xch
```

**Sortie attendue :**

```
NAMES                    PORTS
xch-dev-postgres         0.0.0.0:5432->5432/tcp
xch-dev-redis            0.0.0.0:6379->6379/tcp
xch-dev-minio            0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
xch-staging-postgres     0.0.0.0:5442->5432/tcp
xch-staging-redis        0.0.0.0:6389->6379/tcp
xch-staging-minio        0.0.0.0:9010->9000/tcp, 0.0.0.0:9011->9001/tcp
xch-prod-postgres        0.0.0.0:5452->5432/tcp
xch-prod-redis           0.0.0.0:6399->6379/tcp
xch-prod-minio           0.0.0.0:9020->9000/tcp, 0.0.0.0:9021->9001/tcp
```

### Accès aux différents environnements

| Environnement | Backend API | Frontend App | MinIO Console | PostgreSQL |
|---------------|-------------|--------------|---------------|------------|
| **Dev**       | http://localhost:3100 | http://localhost:3101 | http://localhost:9001 | localhost:5432 |
| **Staging**   | http://localhost:3200 | http://localhost:3201 | http://localhost:9011 | localhost:5442 |
| **Prod**      | http://localhost:3300 | http://localhost:3301 | http://localhost:9021 | localhost:5452 |

### Configuration Nginx pour multi-instances

**`/etc/nginx/sites-available/xch-multi`**

```nginx
# DÉVELOPPEMENT
server {
    listen 80;
    server_name dev.xch.local;

    location / {
        proxy_pass http://localhost:3101;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:3100;
    }
}

# STAGING
server {
    listen 80;
    server_name staging.xch.local;

    location / {
        proxy_pass http://localhost:3201;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:3200;
    }
}

# PRODUCTION
server {
    listen 80;
    server_name xch.local;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xch.local;

    ssl_certificate /etc/letsencrypt/live/xch.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xch.local/privkey.pem;

    location / {
        proxy_pass http://localhost:3301;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        rewrite ^/api/(.*) /$1 break;
        proxy_pass http://localhost:3300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Activer la configuration :**

```bash
sudo ln -s /etc/nginx/sites-available/xch-multi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Gestion des instances

**Scripts de gestion (`scripts/manage-instances.sh`) :**

```bash
#!/bin/bash

INSTANCES=("dev" "staging" "prod")
BASE_DIR="/opt/xch"

case "$1" in
    start)
        for instance in "${INSTANCES[@]}"; do
            echo "Starting $instance..."
            cd "$BASE_DIR/$instance"
            docker-compose up -d
        done
        ;;
    stop)
        for instance in "${INSTANCES[@]}"; do
            echo "Stopping $instance..."
            cd "$BASE_DIR/$instance"
            docker-compose down
        done
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep xch
        ;;
    logs)
        if [ -z "$2" ]; then
            echo "Usage: $0 logs [dev|staging|prod] [service]"
            exit 1
        fi
        cd "$BASE_DIR/$2"
        if [ -z "$3" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$3"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
```

**Utilisation :**

```bash
chmod +x scripts/manage-instances.sh

# Démarrer toutes les instances
./scripts/manage-instances.sh start

# Arrêter toutes les instances
./scripts/manage-instances.sh stop

# Voir le statut
./scripts/manage-instances.sh status

# Logs d'une instance spécifique
./scripts/manage-instances.sh logs prod
./scripts/manage-instances.sh logs dev postgres
```

---

## Sécurité réseau

### Principe du moindre privilège

**Règle d'or :** N'exposez QUE les ports strictement nécessaires.

#### Développement local

Tous les ports peuvent être exposés sur `localhost` :

```yaml
# docker-compose.yml (dev)
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # ✅ Localhost uniquement
```

#### Staging / Production

**Seuls les ports applicatifs doivent être exposés :**

```yaml
# docker-compose.yml (prod)
services:
  postgres:
    # ❌ PAS de ports: exposés (accessible uniquement via réseau Docker)
    networks:
      - xch-network

  redis:
    # ❌ PAS de ports: exposés
    networks:
      - xch-network

  minio:
    # ⚠️ Seulement si le backend est hors Docker
    ports:
      - "127.0.0.1:9000:9000"  # API MinIO (localhost seulement)
    # Console MinIO : NE PAS exposer en prod
    networks:
      - xch-network
```

### Bind sur localhost vs 0.0.0.0

| Syntaxe                    | Signification                              | Sécurité      |
|----------------------------|--------------------------------------------|---------------|
| `"5432:5432"`              | Expose sur **toutes les interfaces** (0.0.0.0) | ❌ Dangereux  |
| `"0.0.0.0:5432:5432"`      | Idem (explicite)                           | ❌ Dangereux  |
| `"127.0.0.1:5432:5432"`    | Expose **uniquement sur localhost**       | ✅ Sécurisé   |
| `"192.168.1.10:5432:5432"` | Expose sur IP spécifique                   | ⚠️ Limitée    |

**Exemple dangereux (production) :**

```yaml
services:
  postgres:
    ports:
      - "5432:5432"  # ❌ Accessible depuis internet si firewall mal configuré
```

**Exemple sécurisé :**

```yaml
services:
  postgres:
    # Pas de ports: du tout (uniquement réseau Docker interne)
    networks:
      - xch-network
```

### Firewall UFW (production)

**Configuration minimale :**

```bash
# Réinitialiser UFW
sudo ufw --force reset

# Politique par défaut : tout bloquer
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH (AVANT d'activer UFW !)
sudo ufw allow 22/tcp

# Autoriser HTTP/HTTPS (Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Bloquer explicitement les ports Docker
sudo ufw deny 5432/tcp comment 'Block PostgreSQL'
sudo ufw deny 6379/tcp comment 'Block Redis'
sudo ufw deny 9000:9001/tcp comment 'Block MinIO'
sudo ufw deny 3000:3001/tcp comment 'Block backend/frontend direct'

# Activer le firewall
sudo ufw enable

# Vérifier les règles
sudo ufw status numbered
```

**Sortie attendue :**

```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] 80/tcp                     ALLOW IN    Anywhere
[ 3] 443/tcp                    ALLOW IN    Anywhere
[ 4] 5432/tcp                   DENY IN     Anywhere    # Block PostgreSQL
[ 5] 6379/tcp                   DENY IN     Anywhere    # Block Redis
[ 6] 9000:9001/tcp              DENY IN     Anywhere    # Block MinIO
[ 7] 3000:3001/tcp              DENY IN     Anywhere    # Block backend/frontend direct
```

### Vérification de l'exposition des ports

```bash
# Vérifier les ports ouverts sur le serveur
sudo netstat -tuln | grep LISTEN

# Vérifier depuis l'extérieur (depuis un autre serveur)
nmap -p 5432,6379,9000,3000,3001 votre-serveur.com

# Test depuis internet (si serveur public)
telnet votre-serveur.com 5432  # Doit échouer
telnet votre-serveur.com 80    # Doit réussir
```

### Réseau Docker interne uniquement

Pour services qui ne doivent JAMAIS être exposés :

```yaml
services:
  postgres:
    networks:
      - xch-internal  # Réseau sans exposition

networks:
  xch-internal:
    name: xch-internal
    driver: bridge
    internal: true  # ✅ Pas d'accès internet, isolation totale
```

**Cas d'usage :**
- Base de données de cache interne
- Services de traitement batch
- Queues de messages internes

---

## Scripts de vérification

### Script 1 : Vérification complète des ports

Créez `scripts/check-all-ports.sh` :

```bash
#!/bin/bash

# ============================================
# XCH - Vérification complète des ports
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  XCH - Audit complet des ports${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Charger .env si existe
if [ -f .env ]; then
    echo -e "${GREEN}✅ Fichier .env trouvé, chargement...${NC}"
    set -a
    source .env
    set +a
else
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé, utilisation des valeurs par défaut${NC}"
fi

# Ports à vérifier avec valeurs .env ou par défaut
declare -A PORTS=(
    [${POSTGRES_PORT:-5432}]="PostgreSQL"
    [${REDIS_PORT:-6379}]="Redis"
    [${MINIO_PORT:-9000}]="MinIO API"
    [${MINIO_CONSOLE_PORT:-9001}]="MinIO Console"
    [${APP_PORT:-3000}]="Backend NestJS"
    [3001]="Frontend Next.js"
)

echo -e "${BLUE}Configuration détectée :${NC}"
echo "  POSTGRES_PORT=${POSTGRES_PORT:-5432}"
echo "  REDIS_PORT=${REDIS_PORT:-6379}"
echo "  MINIO_PORT=${MINIO_PORT:-9000}"
echo "  MINIO_CONSOLE_PORT=${MINIO_CONSOLE_PORT:-9001}"
echo "  APP_PORT=${APP_PORT:-3000}"
echo ""

# 1. Vérification système
echo -e "${BLUE}[1/4] Vérification ports système${NC}"
echo "────────────────────────────────────────"

CONFLICTS=0

for port in "${!PORTS[@]}"; do
    service="${PORTS[$port]}"

    # Utiliser ss ou netstat
    if command -v ss &> /dev/null; then
        result=$(ss -tuln | grep -w ":$port" 2>/dev/null || true)
    else
        result=$(netstat -tuln | grep -w ":$port" 2>/dev/null || true)
    fi

    if [ -n "$result" ]; then
        echo -e "${RED}❌ Port $port ($service) : UTILISÉ${NC}"

        # Identifier processus
        if command -v lsof &> /dev/null; then
            process=$(sudo lsof -i :$port 2>/dev/null | tail -n +2 | awk '{print $1 " (PID: " $2 ")"}' | head -1)
            if [ -n "$process" ]; then
                echo -e "   ${YELLOW}→ $process${NC}"
            fi
        fi

        ((CONFLICTS++))
    else
        echo -e "${GREEN}✅ Port $port ($service) : LIBRE${NC}"
    fi
done

echo ""

# 2. Vérification Docker
echo -e "${BLUE}[2/4] Vérification conteneurs Docker${NC}"
echo "────────────────────────────────────────"

if command -v docker &> /dev/null; then
    containers=$(docker ps --format "table {{.Names}}\t{{.Ports}}" | grep xch || true)

    if [ -n "$containers" ]; then
        echo "$containers"
    else
        echo -e "${YELLOW}⚠️  Aucun conteneur XCH en cours d'exécution${NC}"
    fi
else
    echo -e "${RED}❌ Docker non installé${NC}"
fi

echo ""

# 3. Vérification réseau Docker
echo -e "${BLUE}[3/4] Vérification réseaux Docker${NC}"
echo "────────────────────────────────────────"

if command -v docker &> /dev/null; then
    networks=$(docker network ls | grep xch || true)

    if [ -n "$networks" ]; then
        echo "$networks"

        # Détails du réseau principal
        if docker network inspect xch-network &>/dev/null; then
            echo ""
            echo -e "${GREEN}Réseau xch-network :${NC}"
            docker network inspect xch-network --format '  Subnet: {{range .IPAM.Config}}{{.Subnet}}{{end}}'
            docker network inspect xch-network --format '  Conteneurs connectés: {{len .Containers}}'
        fi
    else
        echo -e "${YELLOW}⚠️  Aucun réseau XCH trouvé${NC}"
    fi
else
    echo -e "${RED}❌ Docker non installé${NC}"
fi

echo ""

# 4. Vérification firewall (si root)
echo -e "${BLUE}[4/4] Vérification firewall${NC}"
echo "────────────────────────────────────────"

if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✅ UFW actif${NC}"
        echo ""
        echo "Règles pertinentes :"
        sudo ufw status numbered | grep -E "(5432|6379|9000|9001|3000|3001)" || echo "  Aucune règle explicite pour les ports XCH"
    else
        echo -e "${YELLOW}⚠️  UFW installé mais inactif${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  UFW non installé${NC}"
fi

echo ""
echo -e "${BLUE}=========================================${NC}"

# Résumé final
if [ $CONFLICTS -eq 0 ]; then
    echo -e "${GREEN}✅ RÉSULTAT : Tous les ports requis sont disponibles${NC}"
    echo ""
    echo "Vous pouvez démarrer XCH avec :"
    echo "  docker-compose up -d"
    exit 0
else
    echo -e "${RED}❌ RÉSULTAT : $CONFLICTS conflit(s) détecté(s)${NC}"
    echo ""
    echo -e "${YELLOW}Solutions recommandées :${NC}"
    echo ""
    echo "1. Arrêter services conflictuels :"
    echo "   sudo systemctl stop postgresql redis"
    echo ""
    echo "2. Modifier .env avec ports alternatifs :"
    echo "   POSTGRES_PORT=5433"
    echo "   REDIS_PORT=6380"
    echo "   MINIO_PORT=9002"
    echo "   MINIO_CONSOLE_PORT=9003"
    echo ""
    echo "3. Relancer cette vérification :"
    echo "   ./scripts/check-all-ports.sh"
    exit 1
fi
```

**Utilisation :**

```bash
chmod +x scripts/check-all-ports.sh
./scripts/check-all-ports.sh
```

### Script 2 : Génération automatique de ports libres

Créez `scripts/find-free-ports.sh` :

```bash
#!/bin/bash

# ============================================
# XCH - Recherche automatique de ports libres
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Fonction pour vérifier si un port est libre
is_port_free() {
    local port=$1
    if command -v ss &> /dev/null; then
        ! ss -tuln | grep -qw ":$port"
    else
        ! netstat -tuln | grep -qw ":$port"
    fi
}

# Fonction pour trouver un port libre à partir d'un port de base
find_free_port() {
    local base_port=$1
    local max_attempts=100
    local port=$base_port

    for ((i=0; i<max_attempts; i++)); do
        if is_port_free $port; then
            echo $port
            return 0
        fi
        ((port++))
    done

    echo -e "${RED}Erreur: Impossible de trouver un port libre après $max_attempts tentatives${NC}" >&2
    return 1
}

echo "========================================="
echo "  XCH - Recherche de ports libres"
echo "========================================="
echo ""

# Recherche de ports libres
POSTGRES_FREE=$(find_free_port 5432)
REDIS_FREE=$(find_free_port 6379)
MINIO_FREE=$(find_free_port 9000)
MINIO_CONSOLE_FREE=$(find_free_port 9001)
APP_FREE=$(find_free_port 3000)
FRONTEND_FREE=$(find_free_port 3001)

echo -e "${GREEN}Ports libres trouvés :${NC}"
echo ""
echo "POSTGRES_PORT=$POSTGRES_FREE"
echo "REDIS_PORT=$REDIS_FREE"
echo "MINIO_PORT=$MINIO_FREE"
echo "MINIO_CONSOLE_PORT=$MINIO_CONSOLE_FREE"
echo "APP_PORT=$APP_FREE"
echo "FRONTEND_PORT=$FRONTEND_FREE (Note: frontend hardcodé à 3001 dans package.json)"
echo ""

# Générer fichier .env si demandé
read -p "Générer un fichier .env avec ces ports ? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ENV_FILE=".env.generated"

    cat > $ENV_FILE <<EOF
# ================================
# XCH - Configuration des ports
# Généré automatiquement le $(date +"%Y-%m-%d %H:%M:%S")
# ================================

# Infrastructure Docker
POSTGRES_PORT=$POSTGRES_FREE
REDIS_PORT=$REDIS_FREE
MINIO_PORT=$MINIO_FREE
MINIO_CONSOLE_PORT=$MINIO_CONSOLE_FREE

# Application
APP_PORT=$APP_FREE

# NOTE: Frontend Next.js utilise le port 3001 (hardcodé dans package.json)
# Pour changer: Modifier "dev": "next dev -p XXXX" dans frontend/package.json

# ================================
# Configuration base de données
# ================================

DATABASE_URL="postgresql://xch_user:xch_password@localhost:$POSTGRES_FREE/xch_dev?schema=public"
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=xch_password
POSTGRES_DB=xch_dev

# ================================
# Configuration Redis
# ================================

REDIS_HOST=localhost
REDIS_PORT=$REDIS_FREE
REDIS_PASSWORD=redis_password

# ================================
# Configuration MinIO
# ================================

MINIO_ENDPOINT=localhost
MINIO_PORT=$MINIO_FREE
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123

# ================================
# Application
# ================================

NODE_ENV=development
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:3001
EOF

    echo -e "${GREEN}✅ Fichier $ENV_FILE généré avec succès${NC}"
    echo ""
    echo "Prochaines étapes :"
    echo "1. Vérifier le contenu : cat $ENV_FILE"
    echo "2. Copier vers .env : cp $ENV_FILE .env"
    echo "3. Personnaliser les mots de passe si nécessaire"
    echo "4. Démarrer Docker Compose : docker-compose up -d"
fi
```

**Utilisation :**

```bash
chmod +x scripts/find-free-ports.sh
./scripts/find-free-ports.sh
```

**Sortie exemple :**

```
=========================================
  XCH - Recherche de ports libres
=========================================

Ports libres trouvés :

POSTGRES_PORT=5433
REDIS_PORT=6380
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
APP_PORT=3000
FRONTEND_PORT=3001 (Note: frontend hardcodé à 3001 dans package.json)

Générer un fichier .env avec ces ports ? (y/N) y
✅ Fichier .env.generated généré avec succès

Prochaines étapes :
1. Vérifier le contenu : cat .env.generated
2. Copier vers .env : cp .env.generated .env
3. Personnaliser les mots de passe si nécessaire
4. Démarrer Docker Compose : docker-compose up -d
```

---

## Troubleshooting

### Problème 1 : Port déjà utilisé lors du démarrage Docker

**Erreur :**

```
Error starting userland proxy: listen tcp4 0.0.0.0:5432: bind: address already in use
```

**Cause :** Un service utilise déjà le port 5432.

**Solutions :**

#### Solution A : Identifier et arrêter le service

```bash
# Identifier le processus
sudo lsof -i :5432
# Sortie : postgres  1234  postgres    5u  IPv4  12345      0t0  TCP *:5432 (LISTEN)

# Arrêter PostgreSQL système
sudo systemctl stop postgresql
sudo systemctl disable postgresql  # Pour éviter le redémarrage automatique

# Relancer Docker Compose
docker-compose up -d
```

#### Solution B : Utiliser un port alternatif

```bash
# Modifier .env
echo "POSTGRES_PORT=5433" >> .env

# Relancer Docker Compose
docker-compose down
docker-compose up -d

# Vérifier
docker ps | grep postgres
# Sortie : xch-postgres  0.0.0.0:5433->5432/tcp
```

#### Solution C : Utiliser le script de recherche automatique

```bash
./scripts/find-free-ports.sh
cp .env.generated .env
docker-compose up -d
```

### Problème 2 : Backend ne peut pas se connecter à PostgreSQL

**Erreur dans les logs backend :**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes possibles :**

1. **Port mal configuré dans DATABASE_URL**

```bash
# Vérifier .env
cat .env | grep DATABASE_URL

# Si POSTGRES_PORT=5433, DATABASE_URL doit refléter cela :
# ❌ Incorrect :
DATABASE_URL="postgresql://xch_user:pass@localhost:5432/xch_dev"

# ✅ Correct :
DATABASE_URL="postgresql://xch_user:pass@localhost:5433/xch_dev"
```

**Solution :**

```bash
# Corriger DATABASE_URL dans .env
sed -i 's/:5432\//:5433\//' .env

# Ou mieux : utiliser le nom du conteneur (DNS Docker)
DATABASE_URL="postgresql://xch_user:pass@xch-postgres:5432/xch_dev"
# Note : Port interne toujours 5432, seul le port hôte change
```

2. **Backend hors Docker ne trouve pas le conteneur**

Si le backend tourne hors Docker (npm run start:dev) :

```bash
# Utiliser localhost + port hôte
DATABASE_URL="postgresql://xch_user:pass@localhost:5433/xch_dev"
```

Si le backend tourne dans Docker :

```bash
# Utiliser nom conteneur + port interne
DATABASE_URL="postgresql://xch_user:pass@xch-postgres:5432/xch_dev"
```

### Problème 3 : MinIO inaccessible depuis le backend

**Erreur :**

```
Error: connect ECONNREFUSED 127.0.0.1:9000
```

**Solution :**

Vérifier la cohérence entre `.env` et la configuration MinIO :

```env
# Si backend dans Docker
MINIO_ENDPOINT=xch-minio  # ✅ Nom conteneur
MINIO_PORT=9000           # ✅ Port interne

# Si backend hors Docker
MINIO_ENDPOINT=localhost  # ✅ Localhost
MINIO_PORT=9002           # ✅ Port hôte (si personnalisé)
```

### Problème 4 : Firewall bloque les connexions

**Symptôme :** Impossible d'accéder à l'application depuis un navigateur distant.

**Vérification :**

```bash
# Vérifier si UFW bloque le port 80/443
sudo ufw status

# Tester depuis l'extérieur
curl -I http://votre-serveur.com
# Si timeout → firewall bloque
```

**Solution :**

```bash
# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Vérifier
sudo ufw status numbered
```

### Problème 5 : Plusieurs instances Docker en conflit

**Symptôme :** Démarrage échoue car les noms de conteneurs existent déjà.

**Erreur :**

```
Error response from daemon: Conflict. The container name "/xch-postgres" is already in use by container...
```

**Cause :** Plusieurs instances XCH avec le même `COMPOSE_PROJECT_NAME`.

**Solution :**

```bash
# Vérifier les conteneurs existants
docker ps -a | grep xch

# Arrêter et supprimer les anciens conteneurs
docker-compose down

# Ou forcer la suppression
docker rm -f xch-postgres xch-redis xch-minio

# Utiliser COMPOSE_PROJECT_NAME unique par instance
# Instance 1 (.env)
COMPOSE_PROJECT_NAME=xch-dev

# Instance 2 (.env)
COMPOSE_PROJECT_NAME=xch-staging
```

### Problème 6 : Port exposé sur internet par erreur

**Symptôme :** Scan de sécurité révèle PostgreSQL exposé sur internet.

**Vérification :**

```bash
# Depuis un serveur externe
nmap -p 5432 votre-serveur-public.com
# Résultat : 5432/tcp open  postgresql  ❌ DANGEREUX !
```

**Cause :** `docker-compose.yml` expose le port sur toutes les interfaces.

```yaml
# ❌ Configuration dangereuse
services:
  postgres:
    ports:
      - "5432:5432"  # Expose sur 0.0.0.0 (toutes interfaces)
```

**Solution :**

```yaml
# ✅ Configuration sécurisée (production)
services:
  postgres:
    # Pas de ports: du tout (uniquement réseau Docker)
    networks:
      - xch-network

# OU pour développement local :
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"  # Localhost seulement
```

```bash
# Reconstruire et redémarrer
docker-compose down
docker-compose up -d

# Vérifier depuis l'extérieur
nmap -p 5432 votre-serveur-public.com
# Résultat : 5432/tcp filtered  ✅ Bloqué
```

### Problème 7 : Réseau Docker ne communique pas

**Symptôme :** Conteneurs ne se voient pas entre eux.

**Erreur :**

```
backend_1  | Error: getaddrinfo ENOTFOUND xch-postgres
```

**Causes possibles :**

1. **Conteneurs sur des réseaux différents**

```bash
# Vérifier les réseaux
docker network inspect xch-network

# Tous les conteneurs doivent être dans "Containers": {...}
```

**Solution :**

```yaml
# S'assurer que tous les services utilisent le même réseau
services:
  postgres:
    networks:
      - xch-network
  redis:
    networks:
      - xch-network
  backend:
    networks:
      - xch-network

networks:
  xch-network:
    name: xch-network
    driver: bridge
```

2. **Nom de conteneur incorrect**

```bash
# Vérifier les noms de conteneurs
docker ps --format "{{.Names}}"

# Utiliser le nom exact dans DATABASE_URL
# ❌ Incorrect :
DATABASE_URL="postgresql://user:pass@postgres:5432/db"

# ✅ Correct (nom du conteneur) :
DATABASE_URL="postgresql://user:pass@xch-postgres:5432/db"
```

### Problème 8 : Docker Compose n'utilise pas les variables .env

**Symptôme :** Les ports par défaut sont utilisés malgré la configuration .env.

**Vérification :**

```bash
# Voir la configuration effective
docker-compose config

# Vérifier que .env est lu
docker-compose config | grep POSTGRES_PORT
```

**Causes et solutions :**

1. **Fichier .env mal placé**

```bash
# .env doit être dans le même dossier que docker-compose.yml
ls -la | grep -E '(\.env|docker-compose)'
# Sortie attendue :
# -rw-r--r-- .env
# -rw-r--r-- docker-compose.yml
```

2. **Variables non exportées**

```bash
# Forcer le rechargement
docker-compose down
docker-compose --env-file .env up -d
```

3. **Cache Docker Compose**

```bash
# Rebuild complet
docker-compose down -v  # Supprime aussi les volumes
docker-compose build --no-cache
docker-compose up -d
```

---

## Exemples de scénarios

### Scénario 1 : Installation propre sur serveur vierge

**Contexte :** Nouveau serveur Ubuntu 22.04, aucun service installé.

**Étapes :**

```bash
# 1. Vérifier les ports (tous doivent être libres)
./scripts/check-ports.sh

# Sortie attendue : Tous ✅

# 2. Utiliser les ports par défaut
cp .env.example .env

# 3. Démarrer Docker Compose
docker-compose up -d

# 4. Vérifier
docker ps
# Tous les conteneurs doivent être "Up"
```

**Configuration firewall :**

```bash
sudo ufw allow 22,80,443/tcp
sudo ufw deny 5432,6379,9000:9001,3000:3001/tcp
sudo ufw enable
```

### Scénario 2 : Serveur avec PostgreSQL système déjà installé

**Contexte :** PostgreSQL 14 tourne déjà sur le port 5432.

**Étapes :**

```bash
# 1. Vérifier le conflit
./scripts/check-ports.sh
# ❌ Port 5432 (PostgreSQL) : UTILISÉ

# 2. Option A : Arrêter PostgreSQL système (si non utilisé)
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# 3. Option B : Utiliser un port alternatif pour XCH
echo "POSTGRES_PORT=5433" >> .env
sed -i 's/:5432\//:5433\//' .env  # Mettre à jour DATABASE_URL

# 4. Démarrer XCH
docker-compose up -d

# 5. Vérifier
docker ps | grep postgres
# xch-postgres  0.0.0.0:5433->5432/tcp
```

### Scénario 3 : Multi-tenant avec 3 instances (dev, staging, prod)

**Contexte :** Un seul serveur héberge 3 environnements complets.

**Architecture :**

```
/opt/xch/
├── dev/       → Ports 5432, 6379, 9000, 9001, 3100, 3101
├── staging/   → Ports 5442, 6389, 9010, 9011, 3200, 3201
└── prod/      → Ports 5452, 6399, 9020, 9021, 3300, 3301
```

**Configuration :**

```bash
# Créer la structure
sudo mkdir -p /opt/xch/{dev,staging,prod}

# Copier le projet dans chaque dossier
sudo cp -r . /opt/xch/dev/
sudo cp -r . /opt/xch/staging/
sudo cp -r . /opt/xch/prod/

# Configurer .env pour chaque instance
cd /opt/xch/dev
cat > .env <<EOF
COMPOSE_PROJECT_NAME=xch-dev
POSTGRES_PORT=5432
REDIS_PORT=6379
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
APP_PORT=3100
DATABASE_URL="postgresql://xch_user:dev_pass@xch-dev-postgres:5432/xch_dev?schema=public"
EOF

cd /opt/xch/staging
cat > .env <<EOF
COMPOSE_PROJECT_NAME=xch-staging
POSTGRES_PORT=5442
REDIS_PORT=6389
MINIO_PORT=9010
MINIO_CONSOLE_PORT=9011
APP_PORT=3200
DATABASE_URL="postgresql://xch_user:staging_pass@xch-staging-postgres:5432/xch_staging?schema=public"
EOF

cd /opt/xch/prod
cat > .env <<EOF
COMPOSE_PROJECT_NAME=xch-prod
POSTGRES_PORT=5452
REDIS_PORT=6399
MINIO_PORT=9020
MINIO_CONSOLE_PORT=9021
APP_PORT=3300
DATABASE_URL="postgresql://xch_user:prod_pass@xch-prod-postgres:5432/xch_production?schema=public"
EOF

# Démarrer toutes les instances
for env in dev staging prod; do
    cd /opt/xch/$env
    docker-compose up -d
done

# Vérifier
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Nginx multi-domaines :**

```nginx
# dev.xch.com
server {
    listen 80;
    server_name dev.xch.com;
    location / { proxy_pass http://localhost:3101; }
    location /api { rewrite ^/api/(.*) /$1 break; proxy_pass http://localhost:3100; }
}

# staging.xch.com
server {
    listen 80;
    server_name staging.xch.com;
    location / { proxy_pass http://localhost:3201; }
    location /api { rewrite ^/api/(.*) /$1 break; proxy_pass http://localhost:3200; }
}

# xch.com (production)
server {
    listen 443 ssl http2;
    server_name xch.com;
    ssl_certificate /etc/letsencrypt/live/xch.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xch.com/privkey.pem;
    location / { proxy_pass http://localhost:3301; }
    location /api { rewrite ^/api/(.*) /$1 break; proxy_pass http://localhost:3300; }
}
```

### Scénario 4 : Migration depuis installation locale vers Docker

**Contexte :** XCH tourne actuellement sans Docker (PostgreSQL + Redis système).

**Étapes :**

```bash
# 1. Backup base de données existante
pg_dump -U xch_user xch_dev > /tmp/xch_backup.sql

# 2. Arrêter services système
sudo systemctl stop postgresql redis

# 3. Démarrer Docker avec ports par défaut
docker-compose up -d

# 4. Attendre que PostgreSQL soit prêt
docker-compose logs -f postgres
# Attendre : "database system is ready to accept connections"

# 5. Restaurer la base de données
docker exec -i xch-postgres psql -U xch_user -d xch_dev < /tmp/xch_backup.sql

# 6. Vérifier
docker-compose exec postgres psql -U xch_user -d xch_dev -c "\dt"

# 7. Redémarrer backend/frontend
cd backend && npm run start:dev
cd frontend && npm run dev
```

### Scénario 5 : Dépannage réseau après changement de ports

**Contexte :** Après avoir changé `POSTGRES_PORT=5433`, le backend ne se connecte plus.

**Diagnostic :**

```bash
# 1. Vérifier que PostgreSQL Docker écoute bien sur 5433
docker ps | grep postgres
# xch-postgres  0.0.0.0:5433->5432/tcp  ✅

# 2. Tester la connexion depuis l'hôte
psql -h localhost -p 5433 -U xch_user -d xch_dev
# Si ça fonctionne → problème dans DATABASE_URL

# 3. Vérifier DATABASE_URL
cat .env | grep DATABASE_URL
# ❌ Incorrect :
# DATABASE_URL="postgresql://xch_user:pass@localhost:5432/xch_dev"

# ✅ Correct :
# DATABASE_URL="postgresql://xch_user:pass@localhost:5433/xch_dev"

# 4. Corriger
sed -i 's/:5432\//:5433\//' .env

# 5. Redémarrer backend
cd backend
npm run start:dev

# 6. Vérifier logs
# [Nest] INFO [DatabaseModule] Database connected successfully ✅
```

---

## Résumé des bonnes pratiques

### ✅ À FAIRE

1. **Toujours utiliser des variables d'environnement** pour les ports
2. **Documenter les ports** dans README.md et .env.example
3. **Vérifier les conflits** avant de démarrer (`./scripts/check-ports.sh`)
4. **Utiliser localhost binding** en développement (`127.0.0.1:5432:5432`)
5. **Ne pas exposer de ports** inutiles en production
6. **Configurer UFW** pour bloquer les ports internes
7. **Utiliser DNS Docker** (noms de conteneurs) dans docker-compose
8. **Préfixer les noms** de conteneurs/réseaux/volumes pour multi-instances
9. **Tester la configuration** avec `docker-compose config` avant de lancer
10. **Monitorer les ports** exposés régulièrement (nmap, netstat)

### ❌ À ÉVITER

1. **Ne jamais hardcoder les ports** dans le code
2. **Ne pas exposer PostgreSQL/Redis** sur internet (0.0.0.0)
3. **Ne pas utiliser les mêmes ports** pour plusieurs instances
4. **Ne pas oublier** de mettre à jour DATABASE_URL après changement de port
5. **Ne pas ignorer** les avertissements de conflits de ports
6. **Ne pas utiliser** `0.0.0.0` en production sans firewall
7. **Ne pas mélanger** noms de conteneurs et localhost dans DATABASE_URL
8. **Ne pas exposer MinIO Console** en production
9. **Ne pas démarrer** sans vérifier `docker ps` et `netstat`
10. **Ne pas partager** les mêmes volumes entre instances

---

## Checklist de déploiement

### Développement local

- [ ] Exécuter `./scripts/check-ports.sh`
- [ ] Configurer `.env` avec ports disponibles
- [ ] Vérifier `DATABASE_URL` utilise le bon port
- [ ] Démarrer Docker Compose : `docker-compose up -d`
- [ ] Vérifier conteneurs : `docker ps`
- [ ] Tester connexion DB : `psql -h localhost -p 5432 -U xch_user`
- [ ] Démarrer backend : `cd backend && npm run start:dev`
- [ ] Démarrer frontend : `cd frontend && npm run dev`
- [ ] Accéder à http://localhost:3001

### Staging / Production

- [ ] Exécuter `./scripts/check-all-ports.sh`
- [ ] Générer secrets forts : `openssl rand -base64 32`
- [ ] Configurer `.env.production` avec ports personnalisés
- [ ] Modifier `docker-compose.yml` pour ne PAS exposer PostgreSQL/Redis
- [ ] Utiliser noms de conteneurs dans DATABASE_URL
- [ ] Configurer UFW : autoriser 22,80,443 / bloquer 5432,6379,9000+
- [ ] Démarrer Docker : `docker-compose --env-file .env.production up -d`
- [ ] Vérifier isolation réseau : `docker network inspect xch-network`
- [ ] Configurer Nginx avec SSL (Let's Encrypt)
- [ ] Tester depuis l'extérieur : `nmap -p 5432,6379 votre-serveur.com` (doit être bloqué)
- [ ] Configurer backups automatiques
- [ ] Mettre en place monitoring (uptime, logs)

---

## Références

### Documentation officielle

- **Docker Compose Networking** : https://docs.docker.com/compose/networking/
- **Docker Compose Environment Variables** : https://docs.docker.com/compose/environment-variables/
- **UFW (Uncomplicated Firewall)** : https://help.ubuntu.com/community/UFW
- **PostgreSQL Docker** : https://hub.docker.com/_/postgres
- **Redis Docker** : https://hub.docker.com/_/redis
- **MinIO Docker** : https://min.io/docs/minio/container/operations/installation.html

### Outils de diagnostic

- `netstat` - Affiche les connexions réseau et ports
- `ss` - Version moderne de netstat (plus rapide)
- `lsof` - Liste les fichiers ouverts (inclut les sockets réseau)
- `nmap` - Scanner de ports
- `docker ps` - Liste les conteneurs avec ports mappés
- `docker network inspect` - Inspecte un réseau Docker
- `ufw status` - État du firewall UFW

### Scripts fournis

- `scripts/check-ports.sh` - Vérification rapide des ports XCH
- `scripts/check-all-ports.sh` - Audit complet (ports + Docker + firewall)
- `scripts/find-free-ports.sh` - Recherche automatique de ports libres
- `scripts/manage-instances.sh` - Gestion multi-instances

---

**Version du document :** 1.0
**Dernière mise à jour :** 2026-01-01
**Mainteneur :** Équipe XCH

**📧 Contact :** Pour toute question sur la gestion des ports, consultez `INSTALL_DEV.md` ou `INSTALL_PROD.md`.

---

✅ **DOCKER_PORTS.md : TERMINÉ**
