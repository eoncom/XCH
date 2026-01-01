# 🛠️ Installation Développement - XCH

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
