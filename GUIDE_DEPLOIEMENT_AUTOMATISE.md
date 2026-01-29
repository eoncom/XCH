# Guide Déploiement Automatisé XCH

**Date:** 2026-01-29
**Version:** 2.0 - Professional Automated Deployment

---

## 🎯 Vue d'Ensemble

Système de déploiement professionnel entièrement automatisé avec:
- ✅ Health checks automatiques
- ✅ Backups base de données avant déploiement
- ✅ Rollback automatique en cas d'échec
- ✅ Logs détaillés de chaque déploiement
- ✅ Migrations Prisma automatiques
- ✅ Tests avant déploiement (optionnel)
- ✅ Zero downtime (blue-green possible)

---

## 📋 Prérequis Installation

### 1. Configuration Serveur

```bash
# Créer utilisateur dédié pour déploiement
sudo adduser xch-deploy
sudo usermod -aG docker xch-deploy

# Créer répertoires
sudo mkdir -p /opt/xch-dev
sudo mkdir -p /opt/xch-backups
sudo mkdir -p /var/log
sudo chown xch-deploy:xch-deploy /opt/xch-dev
sudo chown xch-deploy:xch-deploy /opt/xch-backups
sudo touch /var/log/xch-deploy.log
sudo chown xch-deploy:xch-deploy /var/log/xch-deploy.log

# Cloner projet
cd /opt/xch-dev
git clone https://github.com/eoncom/XCH.git
cd XCH

# Rendre scripts exécutables
chmod +x deploy.sh rollback.sh
```

### 2. Configuration Variables Environnement

```bash
# backend/.env
DATABASE_URL="postgresql://xch_user:PASSWORD@postgres:5432/xch_dev"
JWT_SECRET="your-secret-key"
MINIO_ENDPOINT="minio"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
REDIS_HOST="redis"
REDIS_PORT="6379"

# frontend/.env.local
NEXT_PUBLIC_API_URL="https://xchapi.eoncom.io"
```

### 3. Configuration SSH Git (pour pull automatique)

```bash
# Générer clé SSH pour xch-deploy user
sudo -u xch-deploy ssh-keygen -t ed25519 -C "deploy@xch.eoncom.io"

# Ajouter clé publique à GitHub
# https://github.com/eoncom/XCH/settings/keys/new

# Tester connexion
sudo -u xch-deploy ssh -T git@github.com
```

---

## 🚀 Utilisation

### Déploiement Complet (Recommandé)

```bash
# Déploiement standard avec tous les checks
sudo -u xch-deploy ./deploy.sh
```

**Ce script va automatiquement:**
1. ✅ Vérifier l'environnement (Docker, Git, permissions)
2. ✅ Créer backup base de données (`/opt/xch-backups/xch_backup_YYYYMMDD_HHMMSS.sql`)
3. ✅ Pull dernières modifications Git depuis `origin/main`
4. ✅ Détecter et appliquer migrations Prisma
5. ✅ Installer dépendances si `package.json` a changé
6. ✅ Builder backend + frontend
7. ✅ Exécuter tests (backend unit tests si disponibles)
8. ✅ Restart services Docker (backend + frontend)
9. ✅ Health checks (backend, frontend, database)
10. ✅ Nettoyer anciens backups (> 7 jours)

**Durée estimée:** 3-5 minutes

---

### Options Avancées

#### Skip Backup (déploiement rapide dev)
```bash
sudo -u xch-deploy ./deploy.sh --skip-backup
```

#### Skip Tests (déploiement rapide)
```bash
sudo -u xch-deploy ./deploy.sh --skip-tests
```

#### Force Deployment (même sans changements Git)
```bash
sudo -u xch-deploy ./deploy.sh --force
```

#### Combinaison options
```bash
sudo -u xch-deploy ./deploy.sh --skip-tests --skip-backup --force
```

---

### Rollback en Cas de Problème

#### Rollback code seulement
```bash
sudo -u xch-deploy ./rollback.sh HEAD~1
```

#### Rollback code + database
```bash
sudo -u xch-deploy ./rollback.sh HEAD~1 --restore-db
```

#### Rollback vers commit spécifique
```bash
sudo -u xch-deploy ./rollback.sh a1b2c3d4 --restore-db
```

---

## 📊 Logs et Monitoring

### Consulter Logs Déploiement

```bash
# Logs déploiement
tail -f /var/log/xch-deploy.log

# Logs rollback
tail -f /var/log/xch-rollback.log

# Logs backend en temps réel
docker-compose -f backend/docker-compose.yml logs -f backend

# Logs frontend en temps réel
docker-compose -f frontend/docker-compose.yml logs -f frontend

# Logs dernières 100 lignes
docker-compose -f backend/docker-compose.yml logs --tail=100 backend
```

### Vérifier État Services

```bash
# Status tous conteneurs
docker-compose ps

# Status backend spécifique
docker-compose -f backend/docker-compose.yml ps

# Health check manuel
curl -sf http://localhost:3000/api/health && echo "Backend OK"
curl -sf http://localhost:3001 && echo "Frontend OK"
```

---

## 🔄 Workflow Déploiement Typique

### Développement → Production

```bash
# Sur machine développement (Windows)
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin main

# Sur serveur production (automatiquement via script)
ssh xch-deploy@xch.eoncom.io
cd /opt/xch-dev/XCH
./deploy.sh

# Output attendu:
# ═══════════════════════════════════════════════════════════
# 🚀 XCH AUTOMATED DEPLOYMENT - STARTING
# ═══════════════════════════════════════════════════════════
#
# ✅ Step 1/10: Pre-flight checks passed
# ✅ Step 2/10: Database backup created (15.2MB)
# ✅ Step 3/10: Code updated to commit a1b2c3d
# ✅ Step 4/10: Database migrations applied (1 new)
# ✅ Step 5/10: Dependencies updated
# ✅ Step 6/10: Build completed successfully
# ✅ Step 7/10: Tests passed
# ✅ Step 8/10: Services restarted
# ✅ Step 9/10: All health checks passed
# ✅ Step 10/10: Post-deployment tasks completed
#
# ✅ DEPLOYMENT COMPLETED SUCCESSFULLY
```

---

## 🔧 Intégration Continue (CI/CD)

### GitHub Actions (Optionnel)

Créer `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production server
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: xch-deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/xch-dev/XCH
            ./deploy.sh --skip-tests
```

**Configuration secrets GitHub:**
- `PRODUCTION_HOST`: xch.eoncom.io
- `SSH_PRIVATE_KEY`: Clé privée SSH de xch-deploy

---

## 🛡️ Sécurité

### Permissions Fichiers

```bash
# Vérifier permissions
ls -la deploy.sh rollback.sh

# Output attendu:
# -rwxr-xr-x 1 xch-deploy xch-deploy deploy.sh
# -rwxr-xr-x 1 xch-deploy xch-deploy rollback.sh

# Corriger si nécessaire
chown xch-deploy:xch-deploy deploy.sh rollback.sh
chmod 755 deploy.sh rollback.sh
```

### Backups Automatiques

Les backups sont créés automatiquement à chaque déploiement:

```bash
# Lister backups
ls -lh /opt/xch-backups/

# Output:
# -rw-r--r-- 1 xch-deploy xch-deploy 15M janv. 29 14:30 xch_backup_20260129_143000.sql
# -rw-r--r-- 1 xch-deploy xch-deploy 14M janv. 28 10:15 xch_backup_20260128_101500.sql
# -rw-r--r-- 1 xch-deploy xch-deploy 14M janv. 27 16:45 xch_backup_20260127_164500.sql

# Restaurer backup manuellement si besoin
docker exec -i xch-postgres psql -U xch_user -d xch_dev < /opt/xch-backups/xch_backup_20260129_143000.sql
```

**Rétention:** Les backups > 7 jours sont automatiquement supprimés.

---

## 🧪 Tests Déploiement

### Test Complet Local (Avant Production)

```bash
# Sur machine développement Windows

# 1. Pull dernières modifications
git pull origin main

# 2. Tester build backend
cd backend
npm run build

# 3. Tester build frontend
cd ../frontend
npm run build

# 4. Tester migrations Prisma
cd ../backend
npx prisma migrate dev

# 5. Tester seed avec attachments
npx prisma db seed

# 6. Vérifier données démo attachments
npx prisma studio
# → Ouvrir table "attachments"
# → Vérifier 5 entrées existent
```

### Validation Post-Déploiement Production

```bash
# 1. Health checks
curl -sf https://xchapi.eoncom.io/api/health
curl -sf https://xch.eoncom.io

# 2. Test login
curl -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.demo","password":"admin123"}'

# 3. Test upload attachment (avec token JWT)
curl -X GET https://xchapi.eoncom.io/api/assets/asset_server1/attachments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 4. Vérifier données démo dans navigateur
# https://xch.eoncom.io/dashboard/assets/asset_server1
# → Onglet "Documents"
# → Vérifier 2 fichiers PDF affichés
```

---

## ⚠️ Troubleshooting

### Erreur: "Database migration failed"

```bash
# Vérifier status migrations
cd backend
docker exec xch-backend npx prisma migrate status

# Forcer application migration
docker exec xch-backend npx prisma migrate deploy

# Si échec, rollback + fix manuel
./rollback.sh HEAD~1 --restore-db
```

### Erreur: "Backend health check failed"

```bash
# Vérifier logs backend
docker-compose -f backend/docker-compose.yml logs backend --tail=100

# Erreurs communes:
# - Port 3000 déjà utilisé
# - Database connection failed (vérifier .env DATABASE_URL)
# - MinIO not accessible (vérifier conteneur minio)

# Restart manuel
docker-compose -f backend/docker-compose.yml restart backend
```

### Erreur: "Frontend health check failed"

```bash
# Vérifier logs frontend
docker-compose -f frontend/docker-compose.yml logs frontend --tail=100

# Erreurs communes:
# - Build failed (vérifier syntaxe TypeScript)
# - API URL incorrecte (.env.local NEXT_PUBLIC_API_URL)
# - Port 3001 déjà utilisé

# Rebuild + restart
cd frontend
docker-compose build --no-cache frontend
docker-compose restart frontend
```

### Rollback Complet d'Urgence

```bash
# 1. Identifier dernier commit stable
git log --oneline -20

# 2. Rollback code + DB
./rollback.sh COMMIT_HASH --restore-db

# 3. Vérifier services
docker-compose ps

# 4. Health checks
curl -sf http://localhost:3000/api/health
curl -sf http://localhost:3001

# 5. Si toujours problème, restart complet
docker-compose down
docker-compose up -d
```

---

## 📈 Métriques Déploiement

### KPIs à Surveiller

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Temps déploiement | < 5 min | Logs deploy.sh |
| Success rate | > 95% | Historique /var/log/xch-deploy.log |
| Rollback rate | < 5% | Compteur rollback.sh |
| Downtime | < 30s | Health checks timing |
| Backup size | Stable (~15MB) | ls -lh /opt/xch-backups/ |

### Historique Déploiements

```bash
# Compter déploiements réussis
grep "DEPLOYMENT COMPLETED SUCCESSFULLY" /var/log/xch-deploy.log | wc -l

# Compter rollbacks
grep "ROLLBACK COMPLETED" /var/log/xch-rollback.log | wc -l

# Temps moyen déploiement
grep "Deployment finished" /var/log/xch-deploy.log | tail -10
```

---

## 🎯 Checklist Déploiement Production

### Avant Déploiement
- [ ] Tests E2E passent en local (npm run test:e2e)
- [ ] Build backend réussit (npm run build)
- [ ] Build frontend réussit (npm run build)
- [ ] Migrations Prisma testées en local
- [ ] Commit + Push sur main
- [ ] Backup manuel créé (optionnel si critique)

### Pendant Déploiement
- [ ] Script deploy.sh exécuté
- [ ] Logs suivis en temps réel (tail -f /var/log/xch-deploy.log)
- [ ] Pas d'erreurs dans logs backend/frontend
- [ ] Health checks PASSED

### Après Déploiement
- [ ] Test login admin@xch.demo
- [ ] Vérifier fonctionnalités critiques (CRUD Sites, Assets, Tasks)
- [ ] Vérifier attachments (upload, download, delete)
- [ ] Vérifier dashboard stats
- [ ] Monitoring actif (Grafana si configuré)

---

## 📚 Ressources

### Documentation Complémentaire
- `DEPLOIEMENT_100_PERCENT_MVP.md` - Guide manuel détaillé
- `SESSION_COMPLETION_100_MVP.md` - Résumé implémentation attachments
- `docs/installation/INSTALL_PROD.md` - Guide installation serveur
- `backend/prisma/migrations/` - Historique migrations DB

### Support
- GitHub Issues: https://github.com/eoncom/XCH/issues
- Documentation: https://github.com/eoncom/XCH/tree/main/docs

---

## ✅ Résumé

**Déploiement automatisé professionnel avec:**
- Zero configuration manuelle
- Backups automatiques
- Rollback en 1 commande
- Health checks intégrés
- Logs détaillés

**Commande principale:**
```bash
sudo -u xch-deploy ./deploy.sh
```

**En cas de problème:**
```bash
sudo -u xch-deploy ./rollback.sh HEAD~1 --restore-db
```

**Simple. Fiable. Professionnel.** ✅

---

**Guide créé:** 2026-01-29
**Dernière mise à jour:** 2026-01-29
**Version:** 2.0
