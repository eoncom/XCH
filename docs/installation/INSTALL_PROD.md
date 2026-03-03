# 🚀 Installation Production - XCH

**Dernière mise à jour :** 2026-03-03

Guide complet pour déployer XCH sur serveur Linux en production.

> **🚀 Installation rapide :** Le script `install.sh` à la racine automatise tout le déploiement.
> ```bash
> git clone https://github.com/eoncom/XCH.git && cd XCH
> chmod +x install.sh && ./install.sh   # Choisir mode 1 (Nginx intégré) ou 2 (Nginx externe)
> ```
> Le guide ci-dessous détaille chaque étape pour référence.

---

## 📋 Vue d'ensemble

Ce guide couvre :
- Déploiement sur serveur Linux (Ubuntu 22.04 / Debian 12)
- Configuration sécurisée en production
- Docker Compose avec ports personnalisables
- Nginx reverse proxy
- SSL/TLS avec Let's Encrypt
- Backups automatiques
- Monitoring et logs
- Procédures de mise à jour et rollback

**Temps d'installation :** ~1 heure

---

## ✅ Prérequis Serveur

### Spécifications minimales

| Ressource | Minimum | Recommandé |
|-----------|---------|------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disque** | 20 GB | 50 GB SSD |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Réseau** | IPv4 publique | IPv4 + IPv6 |

### Logiciels requis

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances
sudo apt install -y \
  git \
  curl \
  wget \
  ca-certificates \
  gnupg \
  lsb-release \
  ufw \
  fail2ban

# Vérifier les versions
lsb_release -a
# Doit afficher : Ubuntu 22.04 ou Debian 12
```

### Installation Docker

```bash
# Ajouter le repository Docker officiel
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Se déconnecter/reconnecter pour appliquer
# ou utiliser
newgrp docker

# Vérifier l'installation
docker --version
docker compose version

# Test
docker run hello-world
```

---

## 🔒 1. Sécurité Serveur

### 1.1 Firewall (UFW)

```bash
# Activer UFW
sudo ufw enable

# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Vérifier le statut
sudo ufw status verbose

# Sortie attendue :
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere
# 443/tcp                    ALLOW       Anywhere
```

### 1.2 Fail2ban

```bash
# Installer Fail2ban
sudo apt install -y fail2ban

# Créer configuration locale
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Éditer
sudo nano /etc/fail2ban/jail.local

# Ajouter/modifier :
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

# Démarrer Fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Vérifier
sudo fail2ban-client status
```

---

## 📥 2. Clone et Configuration

### 2.1 Créer utilisateur dédié (recommandé)

```bash
# Créer utilisateur xch
sudo useradd -m -s /bin/bash xch

# Ajouter au groupe docker
sudo usermod -aG docker xch

# Passer à l'utilisateur xch
sudo su - xch
```

### 2.2 Clone du repository

```bash
# Créer dossier
mkdir -p ~/apps
cd ~/apps

# Cloner le projet
git clone https://github.com/votre-org/xch.git
cd xch

# Vérifier la branche
git branch
# Passer en production si nécessaire
git checkout production
```

---

## ⚙️ 3. Configuration Production

### 3.1 Détecter les ports utilisés

**IMPORTANT :** Avant de configurer, vérifier les ports disponibles pour éviter les conflits.

```bash
# Lister tous les ports utilisés
sudo netstat -tulpn | grep LISTEN

# Ou avec ss (plus moderne)
sudo ss -tulpn | grep LISTEN

# Vérifier ports Docker
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Vérifier services système courants
sudo systemctl status postgresql  # Port 5432
sudo systemctl status redis       # Port 6379
sudo systemctl status nginx       # Ports 80, 443
```

**Si des ports sont occupés,** utilisez les ports alternatifs dans la configuration ci-dessous.

### 3.2 Configuration .env backend (Production)

```bash
cd ~/apps/xch/backend

# Créer .env à partir du template
cp .env.example .env

# Éditer avec nano ou vim
nano .env
```

**Contenu `.env` production :**

```env
# ==========================================
# ENVIRONNEMENT
# ==========================================
NODE_ENV=production

# ==========================================
# APPLICATION
# ==========================================
APP_NAME=XCH
# Port backend (changez si 3000 est utilisé)
APP_PORT=3000
APP_URL=https://xch.votre-domaine.com

# ==========================================
# DATABASE (PostgreSQL + PostGIS)
# ==========================================
# IMPORTANT : Générer un mot de passe fort!
# Exemple : openssl rand -base64 32

# Si PostgreSQL local existe déjà, utilisez 5433 au lieu de 5432
POSTGRES_PORT=5432
POSTGRES_HOST=localhost
POSTGRES_USER=xch_user
POSTGRES_PASSWORD=CHANGEZ_MOI_AVEC_MOT_DE_PASSE_FORT_32_CHARS
POSTGRES_DB=xch_production

DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

# ==========================================
# REDIS
# ==========================================
# Si Redis local existe déjà, utilisez 6380 au lieu de 6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=CHANGEZ_MOI_REDIS_PASSWORD_FORT_32_CHARS

# ==========================================
# MINIO (S3-compatible storage)
# ==========================================
# Si MinIO doit tourner sur autre port, changez 9000/9001
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=CHANGEZ_MOI_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=CHANGEZ_MOI_MINIO_SECRET_KEY_32_CHARS
MINIO_BUCKET_NAME=xch-storage

# ==========================================
# JWT AUTHENTICATION
# ==========================================
# CRITIQUE : Générer des secrets forts uniques!
# Commande : openssl rand -base64 32

JWT_SECRET=CHANGEZ_MOI_JWT_SECRET_32_CHARS_MINIMUM
JWT_REFRESH_SECRET=CHANGEZ_MOI_JWT_REFRESH_SECRET_32_CHARS_MINIMUM
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ==========================================
# OIDC (Si utilisé)
# ==========================================
OIDC_ENABLED=true
OIDC_ISSUER=https://auth.votre-domaine.com
OIDC_CLIENT_ID=xch-production
OIDC_CLIENT_SECRET=CHANGEZ_MOI_OIDC_CLIENT_SECRET
OIDC_CALLBACK_URL=https://xch.votre-domaine.com/auth/oidc/callback

# ==========================================
# CORS
# ==========================================
CORS_ORIGIN=https://xch.votre-domaine.com
# Accepter toutes les origines si derrière un reverse proxy de confiance
TRUST_PROXY_CORS=true

# ==========================================
# BACKUP
# ==========================================
# Activer le backup automatique quotidien à 2h AM
AUTO_BACKUP=false

# ==========================================
# LOGGING
# ==========================================
LOG_LEVEL=info
```

### 3.3 Générer secrets sécurisés

```bash
# Générer JWT_SECRET (32 bytes base64)
openssl rand -base64 32

# Générer JWT_REFRESH_SECRET
openssl rand -base64 32

# Générer POSTGRES_PASSWORD
openssl rand -base64 32

# Générer REDIS_PASSWORD
openssl rand -base64 32

# Générer MINIO_SECRET_KEY
openssl rand -base64 32

# Copier ces valeurs dans .env
# NE JAMAIS committer .env dans Git!
```

### 3.4 Configuration .env frontend

```bash
cd ~/apps/xch/frontend

# Créer .env.local (ou .env.production)
nano .env.production.local
```

**Contenu :**

```env
# API Backend
NEXT_PUBLIC_API_URL=https://xch.votre-domaine.com/api

# Application
NEXT_PUBLIC_APP_NAME=XCH
```

### 3.5 Modifier docker-compose.yml pour ports personnalisables

```bash
cd ~/apps/xch

# Éditer docker-compose.yml
nano docker-compose.yml
```

**Sections à modifier pour ports personnalisables :**

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3
    container_name: xch-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-xch_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-xch_production}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - xch-postgres-data:/var/lib/postgresql/data
    networks:
      - xch-network

  redis:
    image: redis:7-alpine
    container_name: xch-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - xch-redis-data:/data
    networks:
      - xch-network

  minio:
    image: minio/minio:latest
    container_name: xch-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    volumes:
      - xch-minio-data:/data
    command: server /data --console-address ":9001"
    networks:
      - xch-network

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

**Exemple avec ports alternatifs (si conflits) :**

Dans `.env` :
```env
POSTGRES_PORT=5433
REDIS_PORT=6380
MINIO_PORT=9002
MINIO_CONSOLE_PORT=9003
```

---

## 🐳 4. Déploiement Docker

### 4.1 Build et démarrage

```bash
cd ~/apps/xch

# Charger les variables .env
source backend/.env

# Démarrer l'infrastructure
docker compose up -d

# Vérifier le statut
docker compose ps

# Vérifier les logs
docker compose logs -f

# Ctrl+C pour sortir
```

### 4.2 Migration base de données

> **Note :** Avec le déploiement Docker (recommandé), les migrations sont automatiquement exécutées par `docker-entrypoint.sh` au démarrage du container backend. **Aucune action manuelle n'est nécessaire.**

Les données initiales (organisation, admin, démo) sont créées via le **Setup Wizard** accessible à `http://votre-domaine/setup` lors du premier lancement.

**En cas de déploiement sans Docker (non recommandé) :**

```bash
cd ~/apps/xch/backend

# Installer dépendances
npm ci --only=production

# Générer Prisma Client
npx prisma generate

# Appliquer les migrations (PRODUCTION!)
npx prisma migrate deploy

# Les données sont chargées via le Setup Wizard, PAS via prisma db seed
```

### 4.3 Build backend et frontend

```bash
# Backend
cd ~/apps/xch/backend
npm run build

# Frontend
cd ~/apps/xch/frontend
npm ci --only=production
npm run build
```

### 4.4 Démarrer en mode production

**Option 1 : PM2 (Recommandé)**

```bash
# Installer PM2 globalement
sudo npm install -g pm2

# Backend
cd ~/apps/xch/backend
pm2 start dist/main.js --name xch-backend -- node

# Frontend
cd ~/apps/xch/frontend
pm2 start npm --name xch-frontend -- start

# Sauvegarder la config PM2
pm2 save

# Auto-démarrage au boot
pm2 startup
# Suivre les instructions affichées (copier/coller commande sudo)

# Voir le statut
pm2 list
pm2 logs

# Monitoring
pm2 monit
```

**Option 2 : systemd**

```bash
# Créer service backend
sudo nano /etc/systemd/system/xch-backend.service
```

**Contenu :**
```ini
[Unit]
Description=XCH Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=xch
WorkingDirectory=/home/xch/apps/xch/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Créer service frontend
sudo nano /etc/systemd/system/xch-frontend.service
```

**Contenu :**
```ini
[Unit]
Description=XCH Frontend
After=network.target

[Service]
Type=simple
User=xch
WorkingDirectory=/home/xch/apps/xch/frontend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Démarrer services
sudo systemctl start xch-backend
sudo systemctl start xch-frontend

# Activer au boot
sudo systemctl enable xch-backend
sudo systemctl enable xch-frontend

# Vérifier le statut
sudo systemctl status xch-backend
sudo systemctl status xch-frontend
```

---

## 🌐 5. Nginx Reverse Proxy (Avec Domaine)

### 5.1 Installation Nginx

```bash
sudo apt install -y nginx

# Démarrer et activer
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérifier
sudo systemctl status nginx
```

### 5.2 Configuration Nginx

```bash
# Créer configuration XCH
sudo nano /etc/nginx/sites-available/xch.conf
```

**Contenu (HTTP seulement au début) :**

```nginx
# Redirect HTTP to HTTPS (sera ajouté après certbot)
server {
    listen 80;
    listen [::]:80;
    server_name xch.votre-domaine.com;

    # Temporaire pour Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API (les routes backend incluent déjà /api/)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/xch.conf /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 5.3 SSL/TLS avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir certificat SSL
sudo certbot --nginx -d xch.votre-domaine.com

# Suivre les instructions:
# 1. Entrer email
# 2. Accepter ToS
# 3. Choisir "2" pour redirect HTTP->HTTPS

# Vérifier renouvellement automatique
sudo certbot renew --dry-run

# Certbot ajoute automatiquement un cron job pour le renouvellement
```

**Nginx sera automatiquement mis à jour avec HTTPS par certbot.**

---

## 💾 6. Backups Automatiques

### 6.1 Script backup PostgreSQL

```bash
# Créer dossier backups
mkdir -p ~/backups/postgres

# Créer script
nano ~/backups/backup-postgres.sh
```

**Contenu :**
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/xch/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="xch-postgres"
DB_NAME="xch_production"
DB_USER="xch_user"
RETENTION_DAYS=7

# Créer backup
docker exec $CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/xch_backup_$DATE.sql.gz"

# Nettoyer anciens backups (> 7 jours)
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: xch_backup_$DATE.sql.gz"
```

```bash
# Rendre exécutable
chmod +x ~/backups/backup-postgres.sh

# Tester
~/backups/backup-postgres.sh
```

### 6.2 Cron job backup quotidien

```bash
# Éditer crontab
crontab -e

# Ajouter (backup à 2h du matin chaque jour)
0 2 * * * /home/xch/backups/backup-postgres.sh >> /home/xch/backups/backup.log 2>&1
```

### 6.3 Restauration depuis backup

```bash
# Lister les backups
ls -lh ~/backups/postgres/

# Restaurer un backup
gunzip < ~/backups/postgres/xch_backup_YYYYMMDD_HHMMSS.sql.gz | \
docker exec -i xch-postgres psql -U xch_user -d xch_production
```

---

## 📊 7. Monitoring et Logs

### 7.1 Logs application

```bash
# Logs PM2
pm2 logs xch-backend
pm2 logs xch-frontend

# Logs systemd
sudo journalctl -u xch-backend -f
sudo journalctl -u xch-frontend -f

# Logs Docker
docker compose logs -f
docker compose logs -f postgres
docker compose logs -f redis
```

### 7.2 Monitoring santé containers

```bash
# Stats en temps réel
docker stats

# Santé PostgreSQL
docker exec xch-postgres pg_isready -U xch_user

# Santé Redis
docker exec xch-redis redis-cli -a $REDIS_PASSWORD ping
# Doit répondre: PONG
```

### 7.3 Script healthcheck

```bash
# Créer script
nano ~/healthcheck.sh
```

**Contenu :**
```bash
#!/bin/bash

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "=== XCH Health Check ==="
echo ""

# Check PostgreSQL
if docker exec xch-postgres pg_isready -U xch_user > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL: OK"
else
  echo -e "${RED}✗${NC} PostgreSQL: FAILED"
fi

# Check Redis
if docker exec xch-redis redis-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Redis: OK"
else
  echo -e "${RED}✗${NC} Redis: FAILED"
fi

# Check Backend
if curl -s http://localhost:3000 > /dev/null; then
  echo -e "${GREEN}✓${NC} Backend: OK"
else
  echo -e "${RED}✗${NC} Backend: FAILED"
fi

# Check Frontend
if curl -s http://localhost:3001 > /dev/null; then
  echo -e "${GREEN}✓${NC} Frontend: OK"
else
  echo -e "${RED}✗${NC} Frontend: FAILED"
fi

echo ""
```

```bash
chmod +x ~/healthcheck.sh
~/healthcheck.sh
```

---

## 🔄 8. Mise à Jour Application

### 8.1 Procédure update

```bash
cd ~/apps/xch

# 1. Backup base de données
~/backups/backup-postgres.sh

# 2. Arrêter services
pm2 stop all
# ou
sudo systemctl stop xch-backend xch-frontend

# 3. Pull dernières modifications
git pull origin production

# 4. Backend updates
cd backend
npm ci --only=production
npx prisma generate
npx prisma migrate deploy
npm run build

# 5. Frontend updates
cd ../frontend
npm ci --only=production
npm run build

# 6. Redémarrer services
pm2 restart all
# ou
sudo systemctl restart xch-backend xch-frontend

# 7. Vérifier
pm2 logs
~/healthcheck.sh
```

### 8.2 Rollback en cas de problème

```bash
# 1. Revenir à version précédente (Git)
git log --oneline -10
git checkout <commit-hash-stable>

# 2. Restaurer base de données
gunzip < ~/backups/postgres/xch_backup_LAST_STABLE.sql.gz | \
docker exec -i xch-postgres psql -U xch_user -d xch_production

# 3. Rebuild
cd backend && npm run build
cd ../frontend && npm run build

# 4. Redémarrer
pm2 restart all
```

---

## 🐛 9. Troubleshooting Production

### Problème : Containers ne démarrent pas

```bash
# Vérifier les logs
docker compose logs

# Vérifier ports conflits
sudo netstat -tulpn | grep LISTEN

# Solution : Changer ports dans .env
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Problème : 502 Bad Gateway (Nginx)

```bash
# Vérifier backend/frontend tournent
pm2 list
sudo systemctl status xch-backend xch-frontend

# Vérifier logs Nginx
sudo tail -f /var/log/nginx/error.log

# Vérifier config Nginx
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

### Problème : SSL certificate expiré

```bash
# Vérifier expiration
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew

# Forcer renouvellement
sudo certbot renew --force-renewal
```

### Problème : Disk space full

```bash
# Vérifier espace
df -h

# Nettoyer logs Docker
docker system prune -a --volumes

# Nettoyer anciens backups
find ~/backups/postgres -mtime +30 -delete

# Nettoyer logs Nginx
sudo truncate -s 0 /var/log/nginx/*.log
```

### Problème : High memory usage

```bash
# Voir utilisation
free -h
docker stats

# Redémarrer containers
docker compose restart

# Limiter mémoire containers (docker-compose.yml)
services:
  postgres:
    mem_limit: 2g
  redis:
    mem_limit: 512m
```

---

## 📚 10. Commandes Utiles Production

### PM2

```bash
pm2 list                # Liste processus
pm2 logs                # Tous les logs
pm2 logs xch-backend    # Logs backend
pm2 monit               # Monitoring temps réel
pm2 restart all         # Redémarrer tous
pm2 stop all            # Arrêter tous
pm2 delete all          # Supprimer tous
pm2 save                # Sauvegarder config
```

### Docker

```bash
docker compose ps              # Status containers
docker compose logs -f         # Logs en direct
docker compose restart         # Redémarrer tout
docker compose down            # Arrêter tout
docker compose up -d           # Démarrer tout
docker system prune -a         # Nettoyer tout
```

### Nginx

```bash
sudo nginx -t                  # Tester config
sudo systemctl reload nginx    # Recharger config
sudo systemctl restart nginx   # Redémarrer
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ Checklist Post-Installation

- [ ] Tous les containers Docker démarrent (docker compose ps)
- [ ] Backend accessible (curl http://localhost:3000)
- [ ] Frontend accessible (curl http://localhost:3001)
- [ ] Nginx configuré et fonctionne
- [ ] SSL/TLS actif (https://)
- [ ] Backup automatique configuré (cron)
- [ ] Healthcheck script fonctionne
- [ ] Firewall configuré (UFW)
- [ ] Fail2ban actif
- [ ] PM2/systemd services actifs au boot
- [ ] Monitoring logs OK
- [ ] Login admin fonctionne
- [ ] Secrets .env changés (pas de valeurs dev!)

---

**✅ Installation Production Terminée !**

Votre application XCH est maintenant déployée en production de manière sécurisée. 🚀

**Documentation complémentaire :**
- [DOCKER_PORTS.md](./DOCKER_PORTS.md) - Gestion ports et isolation
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - Guide développement
- [MVP_COMPLET.md](./MVP_COMPLET.md) - Vue d'ensemble MVP
