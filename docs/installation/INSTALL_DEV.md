# 🛠️ Installation Développement - XCH

**Dernière mise à jour :** 2026-01-01

Guide complet pour installer et développer XCH sur Windows avec WSL2.

---

## 📋 Vue d'ensemble

Ce guide vous permettra d'installer XCH en mode développement avec :
- Hot-reload backend (NestJS)
- Hot-reload frontend (Next.js)
- Docker Compose pour infrastructure (PostgreSQL, Redis, MinIO)
- Debugging VS Code ready
- TypeScript watch mode

**Temps d'installation :** ~20 minutes

---

## ✅ Prérequis

### Logiciels requis

| Logiciel | Version minimale | Téléchargement |
|----------|-----------------|----------------|
| **Node.js** | 18.17.0+ | https://nodejs.org/ |
| **npm** | 9.0.0+ | Inclus avec Node.js |
| **Git** | 2.40.0+ | https://git-scm.com/ |
| **Docker Desktop** | 24.0.0+ | https://www.docker.com/products/docker-desktop/ |
| **WSL2** (Windows) | Ubuntu 22.04 | Voir section ci-dessous |
| **VS Code** (recommandé) | Latest | https://code.visualstudio.com/ |

### Installation WSL2 sur Windows

```powershell
# Ouvrir PowerShell en Administrateur

# Activer WSL
wsl --install

# Redémarrer l'ordinateur

# Installer Ubuntu 22.04
wsl --install -d Ubuntu-22.04

# Vérifier l'installation
wsl --list --verbose
```

### Vérification des versions

```bash
# Node.js
node --version
# Doit afficher : v18.x.x ou supérieur

# npm
npm --version
# Doit afficher : 9.x.x ou supérieur

# Git
git --version
# Doit afficher : 2.x.x

# Docker
docker --version
# Doit afficher : 24.x.x ou supérieur

# Docker Compose
docker compose version
# Doit afficher : v2.x.x
```

---

## 📥 1. Clone du Repository

```bash
# Créer dossier projets (si nécessaire)
mkdir -p ~/projects
cd ~/projects

# Cloner le repository
git clone https://github.com/votre-org/xch.git
cd xch

# Vérifier la structure
ls -la
# Doit afficher : backend/, frontend/, docs/, docker-compose.yml, etc.
```

---

## 🗄️ 2. Installation Backend

### 2.1 Installer les dépendances

```bash
cd backend

# Installer les packages npm
npm install

# Vérifier que node_modules existe
ls -la | grep node_modules
```

### 2.2 Configuration .env développement

```bash
# Copier le template
cp .env.example .env

# Éditer avec votre éditeur préféré
nano .env
# ou
code .env
```

**Contenu `.env` développement :**

```env
# ==========================================
# ENVIRONNEMENT
# ==========================================
NODE_ENV=development

# ==========================================
# APPLICATION
# ==========================================
APP_NAME=XCH
APP_PORT=3000
APP_URL=http://localhost:3000

# ==========================================
# DATABASE (PostgreSQL + PostGIS)
# ==========================================
DATABASE_URL="postgresql://xch_user:xch_password_dev@localhost:5432/xch_dev?schema=public"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=xch_password_dev
POSTGRES_DB=xch_dev

# ==========================================
# REDIS
# ==========================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_dev

# ==========================================
# MINIO (S3-compatible storage)
# ==========================================
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=xch-storage

# ==========================================
# JWT AUTHENTICATION
# ==========================================
# Clés pour développement (À CHANGER EN PRODUCTION!)
JWT_SECRET=dev_jwt_secret_change_in_production_32chars
JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production_32chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ==========================================
# OIDC (Optionnel en dev)
# ==========================================
OIDC_ENABLED=false
OIDC_ISSUER=https://auth.example.com
OIDC_CLIENT_ID=xch-client
OIDC_CLIENT_SECRET=your-client-secret
OIDC_CALLBACK_URL=http://localhost:3000/auth/oidc/callback

# ==========================================
# CORS
# ==========================================
CORS_ORIGIN=http://localhost:3001

# ==========================================
# LOGGING
# ==========================================
LOG_LEVEL=debug
```

### 2.3 Démarrer l'infrastructure Docker

```bash
# Retour à la racine du projet
cd ..

# Démarrer PostgreSQL, Redis, MinIO
docker compose up -d

# Vérifier que les containers tournent
docker compose ps
# Doit afficher : postgres, redis, minio (tous "Up")

# Voir les logs (optionnel)
docker compose logs -f
# Ctrl+C pour sortir
```

### 2.4 Migration base de données

```bash
cd backend

# Générer Prisma Client
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev --name init

# Seed données de test
npx prisma db seed

# Vérifier avec Prisma Studio (optionnel)
npx prisma studio
# Ouvre http://localhost:5555
```

### 2.5 Démarrer le backend

```bash
# Mode développement avec hot-reload
npm run start:dev

# Le serveur démarre sur http://localhost:3000
# Swagger disponible sur http://localhost:3000/api
```

**Messages attendus :**
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] AppModule dependencies initialized
[Nest] LOG [RoutesResolver] Mapped {/auth/login, POST} route
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG Application is running on: http://localhost:3000
[Nest] LOG Swagger documentation: http://localhost:3000/api
```

---

## 🎨 3. Installation Frontend

### 3.1 Installer les dépendances

Ouvrir un **nouveau terminal** :

```bash
cd ~/projects/xch/frontend

# Installer les packages npm
npm install

# Vérifier que node_modules existe
ls -la | grep node_modules
```

### 3.2 Configuration .env développement

```bash
# Créer le fichier .env.local
nano .env.local
# ou
code .env.local
```

**Contenu `.env.local` développement :**

```env
# API Backend
NEXT_PUBLIC_API_URL=http://localhost:3000

# Application
NEXT_PUBLIC_APP_NAME=XCH
```

### 3.3 Générer les PWA icons

```bash
# Générer les icons 192x192 et 512x512
npm run generate-icons

# Vérifier que les fichiers sont créés
ls public/icon-*.png
# Doit afficher : icon-192.png, icon-512.png
```

### 3.4 Démarrer le frontend

```bash
# Mode développement avec hot-reload
npm run dev

# L'application démarre sur http://localhost:3001
```

**Messages attendus :**
```
   ▲ Next.js 15.1.3
   - Local:        http://localhost:3001
   - Network:      http://192.168.x.x:3001

 ✓ Ready in 2.3s
```

---

## ✅ 4. Vérification de l'Installation

### 4.1 Vérifier les services

| Service | URL | Statut attendu |
|---------|-----|----------------|
| **Backend API** | http://localhost:3000 | `{"message":"Welcome to XCH API"}` |
| **Swagger Docs** | http://localhost:3000/api | Interface Swagger UI |
| **Frontend App** | http://localhost:3001 | Page de login XCH |
| **Prisma Studio** | http://localhost:5555 | Interface DB (si lancé) |
| **MinIO Console** | http://localhost:9001 | Console MinIO |

### 4.2 Test de connexion

1. **Ouvrir le navigateur :** http://localhost:3001
2. **Credentials de test :**
   - Email : `admin@xch.local`
   - Password : `admin`
3. **Cliquer "Se connecter"**
4. **Vérifier redirection vers :** http://localhost:3001/dashboard

### 4.3 Vérifier les containers Docker

```bash
# Lister les containers
docker compose ps

# Sortie attendue :
NAME                SERVICE             STATUS
xch-postgres-1      postgres            Up
xch-redis-1         redis               Up
xch-minio-1         minio               Up
```

### 4.4 Vérifier les logs

```bash
# Logs backend (dans terminal backend)
# Doit afficher les requêtes HTTP

# Logs frontend (dans terminal frontend)
# Doit afficher les compilations Next.js

# Logs Docker
docker compose logs --tail=50
```

---

## 🐛 5. Troubleshooting

### Problème : Port déjà utilisé (Backend)

**Erreur :**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution :**
```bash
# Trouver le processus utilisant le port 3000
netstat -ano | findstr :3000
# ou sur WSL/Linux
lsof -i :3000

# Tuer le processus
# Windows PowerShell
taskkill /PID <PID> /F

# WSL/Linux
kill -9 <PID>

# Ou changer le port dans backend/.env
APP_PORT=3100
```

### Problème : Port déjà utilisé (Frontend)

**Erreur :**
```
Port 3001 is already in use
```

**Solution :**
```bash
# Modifier frontend/package.json
"dev": "next dev -p 3002"

# Puis mettre à jour CORS_ORIGIN dans backend/.env
CORS_ORIGIN=http://localhost:3002
```

### Problème : PostgreSQL container ne démarre pas

**Erreur :**
```
Error: port 5432 already allocated
```

**Solution :**
```bash
# Vérifier si PostgreSQL local tourne
# Windows
sc query postgresql-x64-14

# WSL/Linux
sudo systemctl status postgresql

# Arrêter PostgreSQL local
# Windows
net stop postgresql-x64-14

# WSL/Linux
sudo systemctl stop postgresql

# Ou changer le port Docker (voir DOCKER_PORTS.md)
```

### Problème : Prisma migration échoue

**Erreur :**
```
Error: P1001: Can't reach database server
```

**Solution :**
```bash
# Vérifier que PostgreSQL Docker tourne
docker compose ps postgres

# Vérifier DATABASE_URL dans .env
# Doit être : postgresql://xch_user:xch_password_dev@localhost:5432/xch_dev

# Tester connexion
docker compose exec postgres psql -U xch_user -d xch_dev -c "SELECT 1;"

# Si échec, recréer le container
docker compose down
docker compose up -d postgres
npm run prisma:migrate
```

### Problème : npm install échoue

**Erreur :**
```
ERESOLVE unable to resolve dependency tree
```

**Solution :**
```bash
# Forcer la résolution (legacy peer deps)
npm install --legacy-peer-deps

# Ou nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install
```

### Problème : Hot-reload ne fonctionne pas (Windows)

**Solution :**
```bash
# Utiliser WSL2 au lieu de Windows natif
# Cloner le projet dans WSL2 filesystem
cd ~
git clone https://github.com/votre-org/xch.git

# Éviter /mnt/c/ qui a des problèmes de file watching
```

### Problème : CORS errors dans le navigateur

**Erreur :**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution :**
```bash
# Vérifier backend/.env
CORS_ORIGIN=http://localhost:3001

# Redémarrer le backend
# Ctrl+C puis npm run start:dev
```

### Problème : Redis connection refused

**Erreur :**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution :**
```bash
# Vérifier que Redis Docker tourne
docker compose ps redis

# Redémarrer Redis
docker compose restart redis

# Voir les logs
docker compose logs redis
```

---

## 🔄 6. Workflow Développement Quotidien

### Démarrage rapide

```bash
# Terminal 1 : Infrastructure Docker
cd ~/projects/xch
docker compose up -d

# Terminal 2 : Backend
cd ~/projects/xch/backend
npm run start:dev

# Terminal 3 : Frontend
cd ~/projects/xch/frontend
npm run dev
```

### Hot-reload

**Backend (NestJS) :**
- Modifications fichiers `.ts` → Recompile automatique
- Pas besoin de redémarrer

**Frontend (Next.js) :**
- Modifications fichiers → Fast Refresh automatique
- Visible instantanément dans le navigateur

### Debugging VS Code

**Backend launch.json :**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Frontend launch.json :**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Next.js: debug",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/frontend",
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

### Voir les logs

```bash
# Logs backend (dans terminal backend)
# Affichage en temps réel

# Logs Docker
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f minio

# Logs base de données (requêtes SQL)
# Prisma Client affiche automatiquement les queries en mode debug
```

### Reset base de données

```bash
cd backend

# Supprimer et recréer la DB
npx prisma migrate reset

# Reseed
npx prisma db seed
```

### Mise à jour dépendances

```bash
# Backend
cd backend
npm update
npm audit fix

# Frontend
cd ../frontend
npm update
npm audit fix
```

---

## 📚 7. Commandes Utiles

### Docker Compose

```bash
# Démarrer tous les services
docker compose up -d

# Arrêter tous les services
docker compose down

# Redémarrer un service
docker compose restart postgres

# Voir les logs
docker compose logs -f

# Voir les stats (CPU, RAM)
docker stats

# Nettoyer volumes (ATTENTION : supprime les données!)
docker compose down -v
```

### Prisma

```bash
cd backend

# Générer Prisma Client
npx prisma generate

# Créer une migration
npx prisma migrate dev --name nom_migration

# Appliquer migrations
npx prisma migrate deploy

# Reset complet
npx prisma migrate reset

# Ouvrir Prisma Studio
npx prisma studio

# Seed data
npx prisma db seed
```

### npm

```bash
# Backend
cd backend
npm run start:dev          # Mode développement
npm run start:debug        # Mode debug
npm run build              # Build production
npm run test               # Tests unitaires
npm run test:e2e           # Tests E2E
npm run lint               # ESLint
npm run format             # Prettier

# Frontend
cd frontend
npm run dev                # Mode développement
npm run build              # Build production
npm run start              # Serveur production
npm run lint               # ESLint
npm run generate-icons     # Générer PWA icons
```

### Git

```bash
# Créer une branche feature
git checkout -b feature/nom-feature

# Commit
git add .
git commit -m "feat: description"

# Push
git push origin feature/nom-feature

# Pull latest
git pull origin main
```

---

## 🖥️ 9. Test sur Serveur Linux de Développement

### 9.1 Vue d'ensemble

**Workflow de développement hybride :**

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKFLOW DÉVELOPPEMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DEV LOCAL (PC Windows/WSL2)                                │
│     ├─ Développement rapide                                    │
│     ├─ Hot-reload backend/frontend                             │
│     ├─ Tests unitaires                                         │
│     └─ Commit + Push GitHub                                    │
│                                                                 │
│  2. TEST SERVEUR LINUX (Docker isolé)                          │
│     ├─ git pull sur serveur                                    │
│     ├─ Build containers Docker                                 │
│     ├─ Tests intégration                                       │
│     ├─ Tests performance                                       │
│     └─ Validation pré-production                               │
│                                                                 │
│  3. PRODUCTION                                                  │
│     └─ Déploiement final (voir INSTALL_PROD.md)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Avantages de tester sur serveur avant production :**

✅ **Environnement réaliste**
- Même OS que production (Ubuntu/Debian)
- Containers Docker isolés
- Réseau similaire à production

✅ **Détection précoce des problèmes**
- Conflits de ports avec services existants
- Problèmes de ressources (RAM, CPU, disque)
- Issues réseau Docker

✅ **Validation multi-environnements**
- Comportement différent Windows vs Linux
- Permissions fichiers Unix
- Compatibilité architectures

✅ **Tests d'intégration**
- Interactions avec autres services (Nginx Proxy Manager, Home Assistant)
- Performance réelle serveur
- Charge réseau

---

### 9.2 Prérequis Serveur

#### Serveur Linux (Ubuntu 22.04+ / Debian 12+)

**Déjà installés (votre setup) :**
- ✅ Docker 24+
- ✅ Portainer (gestion containers)
- ✅ Nginx Proxy Manager (domaines/SSL)
- ✅ Home Assistant + autres containers

**À vérifier :**

```bash
# Connexion SSH
ssh user@IP_SERVEUR

# Vérifier versions Docker
docker --version
docker-compose --version

# Vérifier Git
git --version

# Si Git manquant
sudo apt update
sudo apt install -y git

# Vérifier espace disque disponible (min 20 GB)
df -h

# Vérifier RAM disponible (min 4 GB libre)
free -h
```

#### Ports potentiellement occupés

**Lister tous les ports actifs :**

```bash
# Méthode 1 : netstat (tous les ports TCP/UDP en écoute)
sudo netstat -tulpn | grep LISTEN

# Méthode 2 : ss (plus rapide)
sudo ss -tulnp | grep LISTEN

# Méthode 3 : Ports Docker mappés
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Méthode 4 : Ports système classiques
sudo lsof -i :5432 # PostgreSQL
sudo lsof -i :6379 # Redis
sudo lsof -i :9000 # MinIO / Portainer
sudo lsof -i :3000 # Backend
sudo lsof -i :3001 # Frontend
sudo lsof -i :80   # HTTP
sudo lsof -i :443  # HTTPS
```

**Exemple de sortie (votre serveur) :**

```
# Ports probablement occupés :
:80    → Nginx Proxy Manager
:443   → Nginx Proxy Manager
:5432  → PostgreSQL (autre projet ?)
:6379  → Redis (autre projet ?)
:8123  → Home Assistant
:9000  → Portainer
:9443  → Portainer SSL
```

**Solution :** Utiliser des ports personnalisés pour XCH (section 9.4).

---

### 9.3 Déploiement Test sur Serveur

#### Étape 1 : Connexion SSH et préparation

```bash
# Connexion SSH au serveur
ssh votre-user@IP_SERVEUR

# Créer dossier pour projets (si inexistant)
sudo mkdir -p /opt/xch-dev
sudo chown $USER:$USER /opt/xch-dev
cd /opt/xch-dev

# Ou utiliser home directory
mkdir -p ~/projects/xch-dev
cd ~/projects/xch-dev
```

#### Étape 2 : Cloner le repository

```bash
# Cloner depuis GitHub (remplacer USERNAME par votre compte)
git clone https://github.com/USERNAME/xch.git
cd xch

# Vérifier la branche
git branch -a
git checkout main  # ou develop

# Voir les fichiers
ls -la
```

#### Étape 3 : Détecter les conflits de ports

**Script automatique de détection :**

Créer `scripts/check-server-ports.sh` :

```bash
#!/bin/bash

echo "======================================"
echo "  XCH - Détection Ports Serveur"
echo "======================================"
echo ""

# Ports requis par XCH (défaut)
declare -A XCH_PORTS=(
    [5432]="PostgreSQL"
    [6379]="Redis"
    [9000]="MinIO API"
    [9001]="MinIO Console"
    [3000]="Backend NestJS"
    [3001]="Frontend Next.js"
)

# Ports suggérés si conflits
declare -A ALT_PORTS=(
    [5432]=5433
    [6379]=6380
    [9000]=9002
    [9001]=9003
    [3000]=3100
    [3001]=3101
)

CONFLICTS=0

echo "Vérification des ports..."
echo ""

for port in "${!XCH_PORTS[@]}"; do
    service="${XCH_PORTS[$port]}"

    # Vérifier si port est utilisé
    if sudo ss -tuln | grep -qw ":$port "; then
        echo "❌ Port $port ($service) : OCCUPÉ"

        # Identifier le processus
        process=$(sudo lsof -i :$port 2>/dev/null | tail -n +2 | awk '{print $1 " (PID: " $2 ")"}' | head -1)
        if [ -n "$process" ]; then
            echo "   → $process"
        fi

        alt_port=${ALT_PORTS[$port]}
        echo "   ✅ Port alternatif recommandé : $alt_port"

        ((CONFLICTS++))
    else
        echo "✅ Port $port ($service) : LIBRE"
    fi
done

echo ""
echo "======================================"

if [ $CONFLICTS -eq 0 ]; then
    echo "✅ Aucun conflit détecté"
    echo ""
    echo "Vous pouvez utiliser les ports par défaut."
    echo "Copiez .env.example vers .env"
else
    echo "⚠️  $CONFLICTS conflit(s) détecté(s)"
    echo ""
    echo "Générer fichier $ENV_FILE avec ports personnalisés ?"
    read -p "Générer $ENV_FILE ? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Générer .env avec ports alternatifs
        cat > $ENV_FILE <<EOF
# ================================
# XCH - Configuration Serveur Dev
# Généré le $(date +"%Y-%m-%d %H:%M:%S")
# ================================

# Environnement
NODE_ENV=development

# Ports personnalisés (conflits détectés)
POSTGRES_PORT=${ALT_PORTS[5432]}
REDIS_PORT=${ALT_PORTS[6379]}
MINIO_PORT=${ALT_PORTS[9000]}
MINIO_CONSOLE_PORT=${ALT_PORTS[9001]}
APP_PORT=${ALT_PORTS[3000]}
# FRONTEND_PORT=${ALT_PORTS[3001]}  # Modifier dans frontend/package.json

# ================================
# Configuration PostgreSQL
# ================================

DATABASE_URL="postgresql://xch_user:xch_dev_password@localhost:${ALT_PORTS[5432]}/xch_dev?schema=public"
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=xch_dev_password
POSTGRES_DB=xch_dev

# ================================
# Configuration Redis
# ================================

REDIS_HOST=localhost
REDIS_PORT=${ALT_PORTS[6379]}
REDIS_PASSWORD=redis_dev_password

# ================================
# Configuration MinIO
# ================================

MINIO_ENDPOINT=localhost
MINIO_PORT=${ALT_PORTS[9000]}
MINIO_USE_SSL=false
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET_NAME=xch-uploads

# ================================
# Configuration Application
# ================================

JWT_SECRET=dev_jwt_secret_change_for_server_test
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=dev_refresh_secret_change_for_server_test
JWT_REFRESH_EXPIRES_IN=7d

# URL Frontend (pour CORS)
FRONTEND_URL=http://localhost:${ALT_PORTS[3001]}
CORS_ORIGIN=http://localhost:${ALT_PORTS[3001]}

# ================================
# Configuration OIDC (optionnel)
# ================================

OIDC_ENABLED=false
# OIDC_ISSUER=
# OIDC_CLIENT_ID=
# OIDC_CLIENT_SECRET=

# ================================
# Intégrations (optionnel)
# ================================

NETBOX_ENABLED=false
# NETBOX_URL=
# NETBOX_TOKEN=

UPTIME_KUMA_ENABLED=false
# UPTIME_KUMA_URL=
EOF

        echo ""
        echo "✅ Fichier $ENV_FILE créé avec ports personnalisés"
        echo ""
        echo "Prochaines étapes :"
        echo "1. Copier vers .env : cp $ENV_FILE .env"
        echo "2. Modifier backend/docker-compose.yml (voir section 9.4)"
        echo "3. Modifier frontend/package.json (port 3101)"
    fi
fi

echo ""
echo "======================================"
```

**Exécuter le script :**

```bash
# Rendre exécutable
chmod +x scripts/check-server-ports.sh

# Lancer la vérification
./scripts/check-server-ports.sh
```

**Sortie exemple (avec conflits) :**

```
======================================
  XCH - Détection Ports Serveur
======================================

Vérification des ports...

❌ Port 5432 (PostgreSQL) : OCCUPÉ
   → postgres (PID: 1234)
   ✅ Port alternatif recommandé : 5433
❌ Port 6379 (Redis) : OCCUPÉ
   → redis-server (PID: 5678)
   ✅ Port alternatif recommandé : 6380
❌ Port 9000 (MinIO API) : OCCUPÉ
   → portainer (PID: 9012)
   ✅ Port alternatif recommandé : 9002
✅ Port 9001 (MinIO Console) : LIBRE
✅ Port 3000 (Backend NestJS) : LIBRE
✅ Port 3001 (Frontend Next.js) : LIBRE

======================================
⚠️  3 conflit(s) détecté(s)

Générer fichier .env.server-dev avec ports personnalisés ?
Générer .env.server-dev ? (y/N) y

✅ Fichier .env.server-dev créé avec ports personnalisés

Prochaines étapes :
1. Copier vers .env : cp .env.server-dev .env
2. Modifier backend/docker-compose.yml (voir section 9.4)
3. Modifier frontend/package.json (port 3101)

======================================
```

#### Étape 4 : Configurer docker-compose.yml pour ports personnalisables

**Modifier `backend/docker-compose.yml` :**

```bash
cd backend
nano docker-compose.yml
```

**Remplacer les ports fixes par variables :**

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.4
    container_name: xch-dev-postgres
    ports:
      - "${POSTGRES_PORT:-5432}:5432"  # ✅ Variable
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-xch_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-xch_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-xch_dev}
    volumes:
      - xch-dev-postgres-data:/var/lib/postgresql/data
    networks:
      - xch-dev-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: xch-dev-redis
    ports:
      - "${REDIS_PORT:-6379}:6379"  # ✅ Variable
    command: redis-server --requirepass ${REDIS_PASSWORD:-redis_dev_password}
    volumes:
      - xch-dev-redis-data:/data
    networks:
      - xch-dev-network
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: xch-dev-minio
    ports:
      - "${MINIO_PORT:-9000}:9000"              # ✅ Variable API
      - "${MINIO_CONSOLE_PORT:-9001}:9001"      # ✅ Variable Console
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    command: server /data --console-address ":9001"
    volumes:
      - xch-dev-minio-data:/data
    networks:
      - xch-dev-network
    restart: unless-stopped

networks:
  xch-dev-network:
    name: xch-dev-network
    driver: bridge

volumes:
  xch-dev-postgres-data:
    name: xch-dev-postgres-data
  xch-dev-redis-data:
    name: xch-dev-redis-data
  xch-dev-minio-data:
    name: xch-dev-minio-data
```

**Sauvegarder :** `Ctrl+O`, `Enter`, `Ctrl+X`

#### Étape 5 : Copier la configuration

```bash
# Copier .env généré vers backend/
cp .env.server-dev backend/.env

# Vérifier le contenu
cat backend/.env
```

#### Étape 6 : Modifier le port frontend (si conflit)

Si le port 3001 est occupé, modifier `frontend/package.json` :

```bash
cd ../frontend
nano package.json
```

**Remplacer :**

```json
{
  "scripts": {
    "dev": "next dev -p 3101",     // ✅ Port personnalisé
    "start": "next start -p 3101"  // ✅ Port personnalisé
  }
}
```

**Sauvegarder :** `Ctrl+O`, `Enter`, `Ctrl+X`

#### Étape 7 : Démarrer les services Docker

```bash
# Retourner au dossier backend
cd ../backend

# Démarrer l'infrastructure Docker
docker-compose up -d

# Vérifier les conteneurs
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Sortie attendue :**

```
NAMES                STATUS              PORTS
xch-dev-postgres     Up 10 seconds       0.0.0.0:5433->5432/tcp
xch-dev-redis        Up 10 seconds       0.0.0.0:6380->6379/tcp
xch-dev-minio        Up 10 seconds       0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp
```

**Vérifier les logs :**

```bash
# Logs de tous les services
docker-compose logs -f

# Logs PostgreSQL uniquement
docker-compose logs -f postgres

# Vérifier que PostgreSQL est prêt
docker-compose logs postgres | grep "ready to accept connections"
# Sortie : database system is ready to accept connections
```

#### Étape 8 : Installer dépendances backend

```bash
# Toujours dans backend/
npm install

# Vérifier installation
ls node_modules | wc -l  # Doit afficher ~300-400 packages
```

#### Étape 9 : Migrations Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev --name init

# Seed la base de données
npx prisma db seed
```

**Vérifier la base de données :**

```bash
# Se connecter à PostgreSQL
docker-compose exec postgres psql -U xch_user -d xch_dev

# Dans psql :
\dt              # Lister les tables
SELECT * FROM "User";  # Voir les utilisateurs seed
\q               # Quitter
```

#### Étape 10 : Démarrer le backend

```bash
# Mode développement
npm run start:dev

# Laisser tourner dans le terminal, ou utiliser PM2 (optionnel)
```

**Vérifier que le backend fonctionne :**

```bash
# Dans un autre terminal SSH
curl http://localhost:3100/health  # Si APP_PORT=3100
# Sortie : {"status":"ok","timestamp":"..."}
```

#### Étape 11 : Installer et démarrer le frontend

```bash
# Nouveau terminal SSH (ou session tmux)
cd /opt/xch-dev/xch/frontend  # ou ~/projects/xch-dev/xch/frontend

# Installer dépendances
npm install

# Générer les icônes PWA
npm run generate-icons

# Démarrer le frontend
npm run dev
```

**Vérifier que le frontend fonctionne :**

```bash
# Dans un autre terminal
curl http://localhost:3101  # Si port personnalisé 3101
# Sortie : HTML de l'application Next.js
```

#### Étape 12 : Accéder depuis votre PC Windows

**Ouvrir dans le navigateur :**

```
http://IP_SERVEUR:3101
```

**Exemple :**
```
http://192.168.1.100:3101
```

**Compte admin par défaut :**
- Email : `admin@xch.local`
- Password : `admin123`

---

### 9.4 Intégration Nginx Proxy Manager (Optionnel)

**Avantage :** Accéder à l'application via un nom de domaine au lieu de `IP:PORT`.

#### Étape 1 : Connecter XCH au réseau Nginx Proxy Manager

**Vérifier le réseau NPM :**

```bash
# Lister les réseaux Docker
docker network ls

# Inspecter le réseau NPM (nom peut varier)
docker network inspect npm_default
# ou
docker network inspect nginxproxymanager_default
```

**Modifier `backend/docker-compose.yml` :**

```yaml
services:
  # ... services existants ...

networks:
  xch-dev-network:
    name: xch-dev-network
    driver: bridge

  # ✅ Ajouter le réseau NPM (externe)
  nginxproxymanager_default:
    external: true
```

**Connecter le frontend au réseau NPM :**

⚠️ **Problème :** Le frontend tourne via `npm run dev` (pas dans Docker).

**Solution 1 : Proxy vers localhost**

Dans Nginx Proxy Manager, créer un proxy vers `localhost:3101` (le port du frontend sur le serveur).

**Solution 2 : Dockeriser le frontend (recommandé pour serveur test)**

Créer `frontend/Dockerfile.dev` :

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copier package.json
COPY package*.json ./

# Installer dépendances
RUN npm install

# Copier le code source
COPY . .

# Générer icônes PWA
RUN npm run generate-icons

# Exposer le port
EXPOSE 3001

# Démarrer en mode développement
CMD ["npm", "run", "dev"]
```

**Ajouter le service frontend dans `backend/docker-compose.yml` :**

```yaml
services:
  # ... postgres, redis, minio ...

  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile.dev
    container_name: xch-dev-frontend
    ports:
      - "3101:3001"  # Port externe : port interne
    environment:
      - NEXT_PUBLIC_API_URL=http://xch-dev-backend:3000
    volumes:
      - ../frontend:/app
      - /app/node_modules
      - /app/.next
    networks:
      - xch-dev-network
      - nginxproxymanager_default  # ✅ Connecté au réseau NPM
    depends_on:
      - postgres
      - redis
      - minio
    restart: unless-stopped

  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile.dev
    container_name: xch-dev-backend
    ports:
      - "${APP_PORT:-3000}:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ../backend:/app
      - /app/node_modules
    networks:
      - xch-dev-network
      - nginxproxymanager_default  # ✅ Connecté au réseau NPM
    depends_on:
      - postgres
      - redis
      - minio
    restart: unless-stopped

networks:
  xch-dev-network:
    name: xch-dev-network
    driver: bridge

  nginxproxymanager_default:
    external: true
```

**Créer `backend/Dockerfile.dev` :**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copier package.json
COPY package*.json ./

# Installer dépendances
RUN npm install

# Copier le code source
COPY . .

# Générer Prisma Client
RUN npx prisma generate

# Exposer le port
EXPOSE 3000

# Démarrer en mode développement
CMD ["npm", "run", "start:dev"]
```

**Redémarrer avec Docker Compose :**

```bash
cd backend
docker-compose down
docker-compose up -d --build
```

**Vérifier les conteneurs :**

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Sortie attendue :**

```
NAMES                PORTS
xch-dev-frontend     0.0.0.0:3101->3001/tcp
xch-dev-backend      0.0.0.0:3100->3000/tcp
xch-dev-postgres     0.0.0.0:5433->5432/tcp
xch-dev-redis        0.0.0.0:6380->6379/tcp
xch-dev-minio        0.0.0.0:9002->9000/tcp, 0.0.0.0:9003->9001/tcp
```

#### Étape 2 : Configurer Proxy Host dans NPM

**Accéder à Nginx Proxy Manager :**

```
http://IP_SERVEUR:81
```

**Créer un Proxy Host :**

1. **Proxy Hosts** → **Add Proxy Host**

2. **Details :**
   - **Domain Names :** `xch-dev.local` (ou `xch-dev.votre-domaine.com`)
   - **Scheme :** `http`
   - **Forward Hostname / IP :** `xch-dev-frontend` (nom du conteneur)
   - **Forward Port :** `3001` (port interne du conteneur)
   - **Cache Assets :** ✅ Activé
   - **Block Common Exploits :** ✅ Activé
   - **Websockets Support :** ✅ Activé (pour hot-reload)

3. **SSL :**
   - Si domaine public : **Request a new SSL Certificate** (Let's Encrypt)
   - Si domaine local : **Use a Custom SSL Certificate** ou laisser HTTP

4. **Advanced (optionnel) :**

```nginx
# Proxy vers backend API
location /api {
    proxy_pass http://xch-dev-backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

5. **Save**

#### Étape 3 : Configuration DNS locale (PC Windows)

**Éditer le fichier hosts Windows :**

```powershell
# Ouvrir PowerShell en Administrateur
notepad C:\Windows\System32\drivers\etc\hosts
```

**Ajouter :**

```
192.168.1.100   xch-dev.local
```

**Sauvegarder et fermer.**

#### Étape 4 : Accéder via le domaine

**Ouvrir dans le navigateur (PC Windows) :**

```
http://xch-dev.local
```

**Ou avec SSL (si configuré) :**

```
https://xch-dev.local
```

---

### 9.5 Workflow Dev → Serveur

**Workflow complet pour développer en local et tester sur serveur :**

#### 1. Développement local (PC Windows/WSL2)

```bash
# WSL2 Terminal

# Créer une branche feature
git checkout -b feature/nouvelle-fonctionnalite

# Développer (hot-reload actif)
# - Modifier le code backend/frontend
# - Tester localement : http://localhost:3001

# Commit
git add .
git commit -m "feat: ajout nouvelle fonctionnalité"

# Push vers GitHub
git push origin feature/nouvelle-fonctionnalite
```

#### 2. Test sur serveur Linux

```bash
# SSH vers serveur
ssh user@IP_SERVEUR

# Aller dans le dossier XCH
cd /opt/xch-dev/xch  # ou ~/projects/xch-dev/xch

# Récupérer les dernières modifications
git fetch origin
git checkout feature/nouvelle-fonctionnalite
git pull origin feature/nouvelle-fonctionnalite

# Rebuild les containers (si modifications Dockerfile/dépendances)
cd backend
docker-compose up -d --build

# Si modifications backend seulement (sans rebuild)
docker-compose restart backend

# Si modifications Prisma schema
docker-compose exec backend npx prisma migrate dev
docker-compose exec backend npx prisma generate
docker-compose restart backend

# Si modifications frontend seulement
docker-compose restart frontend

# Vérifier les logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### 3. Tester depuis PC Windows

```
http://IP_SERVEUR:3101
# ou
http://xch-dev.local
```

#### 4. Valider et merger

```bash
# Si tests OK sur serveur, merger dans main
git checkout main
git merge feature/nouvelle-fonctionnalite
git push origin main

# Sur serveur, passer sur main
ssh user@IP_SERVEUR
cd /opt/xch-dev/xch
git checkout main
git pull origin main
cd backend
docker-compose up -d --build
```

#### Script d'automatisation (optionnel)

Créer `scripts/deploy-server-dev.sh` :

```bash
#!/bin/bash

# ============================================
# Script de déploiement serveur dev
# ============================================

set -e

SERVER_USER="votre-user"
SERVER_IP="192.168.1.100"
PROJECT_PATH="/opt/xch-dev/xch"

echo "======================================"
echo "  Déploiement XCH Serveur Dev"
echo "======================================"
echo ""

# Vérifier que les modifications locales sont commitées
if [[ -n $(git status -s) ]]; then
    echo "❌ Modifications locales non commitées détectées"
    echo ""
    git status -s
    echo ""
    echo "Commitez vos modifications avant de déployer."
    exit 1
fi

# Récupérer la branche actuelle
BRANCH=$(git branch --show-current)
echo "📦 Branche actuelle : $BRANCH"
echo ""

# Pusher vers GitHub
echo "⬆️  Push vers GitHub..."
git push origin $BRANCH
echo ""

# Se connecter au serveur et déployer
echo "🚀 Déploiement sur serveur $SERVER_IP..."
echo ""

ssh $SERVER_USER@$SERVER_IP << EOF
    set -e

    echo "📂 Navigation vers projet..."
    cd $PROJECT_PATH

    echo "⬇️  Pull dernières modifications..."
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH

    echo "🔨 Rebuild containers..."
    cd backend
    docker-compose up -d --build

    echo "⏳ Attente démarrage (10s)..."
    sleep 10

    echo "✅ Vérification statut containers..."
    docker-compose ps

    echo ""
    echo "======================================"
    echo "  ✅ Déploiement terminé !"
    echo "======================================"
    echo ""
    echo "Accès application :"
    echo "  http://$SERVER_IP:3101"
    echo "  http://xch-dev.local (si DNS configuré)"
    echo ""
EOF

echo ""
echo "🎉 Déploiement réussi !"
```

**Utilisation :**

```bash
# Rendre exécutable (local WSL2)
chmod +x scripts/deploy-server-dev.sh

# Lancer le déploiement
./scripts/deploy-server-dev.sh
```

---

### 9.6 Troubleshooting Serveur

#### Problème 1 : Conflits de ports persistants

**Erreur :**

```
Error starting userland proxy: listen tcp4 0.0.0.0:5432: bind: address already in use
```

**Solution 1 : Identifier et arrêter le service**

```bash
# Identifier le processus
sudo lsof -i :5432

# Exemple de sortie :
# COMMAND   PID      USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
# postgres  1234  postgres    5u  IPv4  98765      0t0  TCP *:5432 (LISTEN)

# Arrêter PostgreSQL système
sudo systemctl stop postgresql
sudo systemctl disable postgresql

# Redémarrer XCH Docker
cd /opt/xch-dev/xch/backend
docker-compose up -d
```

**Solution 2 : Utiliser les ports personnalisés**

```bash
# Relancer le script de détection
./scripts/check-server-ports.sh

# Générer .env avec ports alternatifs (y)
# Copier vers backend
cp .env.server-dev backend/.env

# Vérifier docker-compose.yml utilise ${POSTGRES_PORT:-5432}
cat backend/docker-compose.yml | grep POSTGRES_PORT

# Relancer Docker
cd backend
docker-compose down
docker-compose up -d
```

#### Problème 2 : Backend ne se connecte pas à PostgreSQL

**Erreur dans logs :**

```
docker-compose logs backend
# Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause :** DATABASE_URL utilise `localhost` au lieu du nom du conteneur.

**Solution :**

```bash
# Éditer backend/.env
nano backend/.env
```

**Corriger DATABASE_URL :**

```env
# ❌ Incorrect (si backend dans Docker)
DATABASE_URL="postgresql://xch_user:password@localhost:5432/xch_dev"

# ✅ Correct (utiliser nom du conteneur)
DATABASE_URL="postgresql://xch_user:password@xch-dev-postgres:5432/xch_dev"
```

**Redémarrer le backend :**

```bash
docker-compose restart backend
docker-compose logs -f backend
```

#### Problème 3 : Conflit réseau Docker

**Erreur :**

```
Error response from daemon: network xch-dev-network has active endpoints
```

**Solution :**

```bash
# Lister les conteneurs connectés au réseau
docker network inspect xch-dev-network

# Arrêter tous les conteneurs XCH
cd backend
docker-compose down

# Supprimer le réseau manuellement (si nécessaire)
docker network rm xch-dev-network

# Recréer
docker-compose up -d
```

#### Problème 4 : Containers ne démarrent pas (ressources)

**Symptômes :**

```bash
docker-compose ps
# État : Restarting ou Exited
```

**Vérifier les ressources :**

```bash
# RAM disponible
free -h
# Si < 2 GB libre → Problème mémoire

# CPU
top
# Vérifier charge (load average)

# Disque
df -h
# Si > 90% utilisé → Problème espace

# Logs Docker
docker-compose logs postgres
# Rechercher "out of memory" ou "no space left"
```

**Solutions :**

**Libérer de la mémoire :**

```bash
# Arrêter containers non essentiels
docker stop $(docker ps -q)  # Arrête TOUS les containers (⚠️ ATTENTION)

# Ou arrêter sélectivement
docker stop home-assistant portainer  # Exemples

# Nettoyer Docker
docker system prune -a --volumes  # ⚠️ Supprime tout ce qui n'est pas utilisé
```

**Libérer de l'espace disque :**

```bash
# Supprimer images Docker inutilisées
docker image prune -a

# Supprimer volumes Docker orphelins
docker volume prune

# Nettoyer logs système
sudo journalctl --vacuum-time=3d
```

#### Problème 5 : Frontend ne charge pas (CORS)

**Erreur dans navigateur (F12 Console) :**

```
Access to fetch at 'http://IP_SERVEUR:3100/api/...' from origin 'http://IP_SERVEUR:3101' has been blocked by CORS policy
```

**Solution :**

```bash
# Éditer backend/.env
nano backend/.env
```

**Ajouter l'IP du serveur dans CORS_ORIGIN :**

```env
# Autoriser frontend depuis IP serveur
CORS_ORIGIN=http://192.168.1.100:3101,http://localhost:3101,http://xch-dev.local

# Ou autoriser tout (développement seulement !)
CORS_ORIGIN=*
```

**Redémarrer le backend :**

```bash
docker-compose restart backend
```

#### Problème 6 : Hot-reload ne fonctionne pas

**Cause :** Volumes Docker mal configurés.

**Solution :**

Vérifier `docker-compose.yml` :

```yaml
services:
  backend:
    volumes:
      - ../backend:/app           # ✅ Source code
      - /app/node_modules         # ✅ Exclure node_modules
      - /app/dist                 # ✅ Exclure dist

  frontend:
    volumes:
      - ../frontend:/app          # ✅ Source code
      - /app/node_modules         # ✅ Exclure node_modules
      - /app/.next                # ✅ Exclure .next
```

**Redémarrer :**

```bash
docker-compose down
docker-compose up -d --build
```

#### Problème 7 : Nginx Proxy Manager ne route pas correctement

**Symptôme :** `http://xch-dev.local` affiche erreur 502 Bad Gateway.

**Vérification :**

```bash
# Vérifier que le frontend est UP
docker ps | grep xch-dev-frontend
# État doit être "Up"

# Tester connexion directe
curl http://xch-dev-frontend:3001
# Doit retourner HTML

# Vérifier les logs NPM
docker logs nginx-proxy-manager  # Nom peut varier
```

**Solution :**

1. **Vérifier réseau NPM :**

```bash
docker network inspect nginxproxymanager_default | grep xch-dev-frontend
# Le conteneur doit apparaître dans "Containers"
```

2. **Reconnecter au réseau :**

```bash
docker network connect nginxproxymanager_default xch-dev-frontend
```

3. **Recréer Proxy Host dans NPM UI :**
   - Forward Hostname : `xch-dev-frontend` (nom exact du conteneur)
   - Forward Port : `3001` (port interne)
   - Websockets : ✅ Activé

---

### 9.7 Nettoyage Serveur Test

**Pour supprimer complètement XCH du serveur :**

```bash
# SSH vers serveur
ssh user@IP_SERVEUR

# Aller dans le dossier projet
cd /opt/xch-dev/xch/backend  # ou ~/projects/xch-dev/xch/backend

# Arrêter et supprimer tous les containers + volumes
docker-compose down -v

# Supprimer les images Docker XCH
docker images | grep xch
docker rmi xch-dev-backend xch-dev-frontend  # Si images custom

# Supprimer le réseau
docker network rm xch-dev-network

# Déconnecter du réseau NPM (si connecté)
docker network disconnect nginxproxymanager_default xch-dev-frontend 2>/dev/null || true
docker network disconnect nginxproxymanager_default xch-dev-backend 2>/dev/null || true

# Revenir au dossier parent
cd ../..

# Supprimer le dossier projet
rm -rf xch

# Vérifier que tout est supprimé
docker ps -a | grep xch
docker volume ls | grep xch
docker network ls | grep xch
docker images | grep xch

# Doit retourner vide
```

**Nettoyage Docker global (optionnel) :**

```bash
# Nettoyer tous les containers arrêtés
docker container prune

# Nettoyer toutes les images inutilisées
docker image prune -a

# Nettoyer tous les volumes orphelins
docker volume prune

# Nettoyer tout (⚠️ ATTENTION : supprime TOUT ce qui n'est pas utilisé)
docker system prune -a --volumes
```

**Restaurer les services système (si arrêtés) :**

```bash
# Si PostgreSQL système a été arrêté
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Si Redis système a été arrêté
sudo systemctl start redis
sudo systemctl enable redis
```

---

## ✅ Récapitulatif Section 9

**Vous savez maintenant :**

✅ **Déployer XCH sur serveur Linux de dev** avec isolation complète
✅ **Détecter et résoudre les conflits de ports** automatiquement
✅ **Configurer docker-compose.yml** avec ports personnalisables
✅ **Intégrer avec Nginx Proxy Manager** pour accès via domaine
✅ **Workflow dev local → test serveur** avec script automatisé
✅ **Troubleshooter les problèmes courants** (ports, réseau, ressources)
✅ **Nettoyer proprement** le serveur après tests

**Workflow complet :**

```
PC Windows (WSL2)               Serveur Linux Dev
─────────────────               ─────────────────
1. Développer localement    →   3. git pull
2. Commit + Push GitHub     →   4. docker-compose up -d --build
                                5. Tester via http://IP_SERVEUR:3101
                                6. Valider avant production
```

**Prochaine étape :** Production (voir `INSTALL_PROD.md`)

---

## 🎯 8. Prochaines Étapes

Maintenant que l'installation est complète :

1. **Explorer l'application :** http://localhost:3001
2. **Consulter la documentation API :** http://localhost:3000/api
3. **Lire le guide développement :** `DEVELOPMENT_GUIDE.md`
4. **Consulter l'architecture :** `docs/architecture/tech-stack.md`
5. **Voir le cahier des charges :** `docs/cahier-des-charges.md`

---

## 📞 Support

**Problèmes non résolus ?**

1. Consulter `DEVELOPMENT_GUIDE.md`
2. Voir les issues GitHub
3. Consulter la documentation technique dans `docs/`

---

**✅ Installation Développement Terminée !**

Vous êtes prêt à développer sur XCH. Happy coding! 🚀
