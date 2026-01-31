# Déploiement Production - Instructions Immédiates

**Date:** 2026-01-29
**Action:** Déployer MVP 100% + Système automatisé sur serveur production

---

## 🚀 DÉPLOIEMENT RAPIDE (5 minutes)

### Étape 1: Connexion SSH

```bash
ssh xch-deploy@xch.eoncom.io
# Ou si utilisateur différent:
ssh root@xch.eoncom.io
```

### Étape 2: Pull Dernières Modifications

```bash
cd /opt/xch-dev/XCH
git pull origin main
```

**Modifications récupérées:**
- ✅ Système upload attachments complet (Assets + Tasks)
- ✅ Migration Prisma attachments
- ✅ Seed avec 5 attachments démo
- ✅ Scripts déploiement automatisés (deploy.sh, rollback.sh)
- ✅ Documentation complète

### Étape 3: Rendre Scripts Exécutables

```bash
chmod +x deploy.sh rollback.sh
```

### Étape 4: Lancer Déploiement Automatisé

```bash
# Si utilisateur xch-deploy existe:
sudo -u xch-deploy ./deploy.sh

# Sinon, en tant que root:
./deploy.sh --force
```

**Le script va automatiquement:**
1. ✅ Créer backup base de données
2. ✅ Appliquer migration Prisma (table attachments)
3. ✅ Installer dépendances (cuid2 package)
4. ✅ Builder backend + frontend
5. ✅ Restart services Docker
6. ✅ Valider health checks

**Durée:** 3-5 minutes

---

## 📋 ALTERNATIVE: Déploiement Manuel Pas-à-Pas

Si le script automatisé échoue, voici les commandes manuelles:

### 1. Backup Base de Données

```bash
# Créer répertoire backups
mkdir -p /opt/xch-backups

# Créer backup
docker exec xch-postgres pg_dump -U xch_user -d xch_dev > /opt/xch-backups/xch_backup_$(date +%Y%m%d_%H%M%S).sql

# Vérifier backup créé
ls -lh /opt/xch-backups/
```

### 2. Appliquer Migration Prisma

```bash
cd /opt/xch-dev/XCH/backend

# Appliquer migration attachments
docker exec xch-backend npx prisma migrate deploy

# Vérifier migration appliquée
docker exec xch-postgres psql -U xch_user -d xch_dev -c "\d attachments"
```

**Résultat attendu:**
```
Table "public.attachments"
  Column       | Type         | Nullable
---------------+--------------+----------
 id            | text         | not null
 tenantId      | text         | not null
 assetId       | text         |
 taskId        | text         |
 filename      | text         | not null
 ...
```

### 3. Installer Dépendances

```bash
# Backend (cuid2 pour génération IDs)
cd /opt/xch-dev/XCH/backend
docker exec xch-backend npm install

# Frontend
cd /opt/xch-dev/XCH/frontend
docker exec xch-frontend npm install
```

### 4. Builder Applications

```bash
# Backend
docker exec xch-backend npm run build

# Frontend (rebuild image)
cd /opt/xch-dev/XCH/frontend
docker-compose build --no-cache frontend
```

### 5. Restart Services

```bash
# Backend
cd /opt/xch-dev/XCH/backend
docker-compose restart backend

# Attendre 10 secondes
sleep 10

# Frontend
cd /opt/xch-dev/XCH/frontend
docker-compose restart frontend

# Attendre 10 secondes
sleep 10
```

### 6. Vérifier Services

```bash
# Status conteneurs
docker-compose ps

# Backend health check
curl -f http://localhost:3000/api/health && echo "✅ Backend OK"

# Frontend health check
curl -f http://localhost:3001 && echo "✅ Frontend OK"

# Database health check
docker exec xch-postgres pg_isready -U xch_user -d xch_dev && echo "✅ Database OK"
```

### 7. Vérifier Logs

```bash
# Backend logs (dernières 50 lignes)
docker-compose -f /opt/xch-dev/XCH/backend/docker-compose.yml logs backend --tail=50

# Frontend logs (dernières 50 lignes)
docker-compose -f /opt/xch-dev/XCH/frontend/docker-compose.yml logs frontend --tail=50

# Rechercher erreurs
docker-compose logs backend 2>&1 | grep -i error
docker-compose logs frontend 2>&1 | grep -i error
```

---

## ✅ VALIDATION POST-DÉPLOIEMENT

### 1. Vérifier Table Attachments

```bash
docker exec xch-postgres psql -U xch_user -d xch_dev -c "SELECT COUNT(*) FROM attachments;"
```

**Résultat attendu:** `0` (table vide, seed pas encore exécuté)

### 2. Charger Données Démo (Optionnel)

```bash
cd /opt/xch-dev/XCH/backend

# Exécuter seed (ATTENTION: supprime données existantes!)
docker exec xch-backend npx prisma db seed
```

**Résultat attendu:**
```
✅ Attachments created: 5 total (3 assets, 2 tasks)
🎉 COMPREHENSIVE DEMO SEED COMPLETED SUCCESSFULLY!
```

### 3. Tester Upload Attachment via UI

1. Ouvrir navigateur: `https://xch.eoncom.io`
2. Login: `admin@xch.demo` / `admin123`
3. Aller à **Dashboard → Assets → [Sélectionner asset]**
4. Cliquer onglet **"Documents"**
5. **Upload fichier test:**
   - Sélectionner fichier (PDF, PNG, JPG < 10MB)
   - Choisir catégorie (spec, invoice, etc.)
   - Cliquer "Uploader le fichier"
6. **Vérifier:**
   - ✅ Toast "Fichier uploadé avec succès"
   - ✅ Fichier apparaît dans liste
   - ✅ Cliquer download → ouvre fichier

### 4. Vérifier MinIO

```bash
# Vérifier bucket attachments existe
docker exec xch-minio mc ls local/

# Si bucket n'existe pas, créer
docker exec xch-minio mc mb local/attachments

# Configurer politique publique (pour presigned URLs)
docker exec xch-minio mc anonymous set download local/attachments

# Lister fichiers uploadés
docker exec xch-minio mc ls local/attachments --recursive
```

### 5. Vérifier Endpoints API

```bash
# Récupérer JWT token (remplacer par vraies credentials)
TOKEN=$(curl -s -X POST https://xchapi.eoncom.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.demo","password":"admin123"}' \
  | jq -r '.accessToken')

# Tester endpoint list attachments
curl -H "Authorization: Bearer $TOKEN" \
  https://xchapi.eoncom.io/api/assets/asset_server1/attachments
```

**Résultat attendu (si seed exécuté):**
```json
[
  {
    "id": "attach_asset_server1_spec",
    "filename": "1738158600000_dell_poweredge_r740_specs.pdf",
    "originalFilename": "dell_poweredge_r740_specs.pdf",
    "size": 2456789,
    "category": "spec",
    "url": "https://..."
  }
]
```

---

## 🔥 EN CAS DE PROBLÈME

### Erreur: Migration Prisma échoue

```bash
# Vérifier status migrations
docker exec xch-backend npx prisma migrate status

# Résoudre conflits
docker exec xch-backend npx prisma migrate resolve --applied 20260129000000_add_attachments

# Forcer application
docker exec xch-backend npx prisma migrate deploy
```

### Erreur: Backend ne démarre pas

```bash
# Vérifier logs détaillés
docker-compose -f /opt/xch-dev/XCH/backend/docker-compose.yml logs backend --tail=100

# Erreurs communes:
# - "Cannot find module '@paralleldrive/cuid2'" → npm install
# - "Port 3000 already in use" → docker-compose restart backend
# - "Cannot connect to database" → vérifier .env DATABASE_URL

# Restart forcé
docker-compose -f /opt/xch-dev/XCH/backend/docker-compose.yml down
docker-compose -f /opt/xch-dev/XCH/backend/docker-compose.yml up -d
```

### Erreur: MinIO bucket n'existe pas

```bash
# Créer bucket manuellement
docker exec xch-minio mc mb local/attachments

# Configurer politique
docker exec xch-minio mc anonymous set download local/attachments

# Vérifier
docker exec xch-minio mc ls local/
```

### ROLLBACK D'URGENCE

```bash
cd /opt/xch-dev/XCH

# Rollback code vers commit précédent
git reset --hard HEAD~5

# Restaurer backup DB
LATEST_BACKUP=$(ls -t /opt/xch-backups/xch_backup_*.sql | head -1)
docker exec -i xch-postgres psql -U xch_user -d xch_dev < $LATEST_BACKUP

# Restart services
docker-compose -f backend/docker-compose.yml restart backend
docker-compose -f frontend/docker-compose.yml restart frontend
```

---

## 📊 CHECKLIST FINALE

### Déploiement
- [ ] Git pull réussi (commit 809291c ou plus récent)
- [ ] Scripts exécutables (chmod +x deploy.sh rollback.sh)
- [ ] deploy.sh exécuté SANS erreur
- [ ] Ou commandes manuelles exécutées (si script échoue)

### Validation Services
- [ ] Backend UP (docker-compose ps | grep backend)
- [ ] Frontend UP (docker-compose ps | grep frontend)
- [ ] Database UP (docker-compose ps | grep postgres)
- [ ] MinIO UP (docker-compose ps | grep minio)

### Health Checks
- [ ] Backend health: `curl http://localhost:3000/api/health` → 200 OK
- [ ] Frontend health: `curl http://localhost:3001` → 200 OK
- [ ] Database health: `docker exec xch-postgres pg_isready` → accepting connections

### Validation Fonctionnelle
- [ ] Login réussi: `https://xch.eoncom.io` (admin@xch.demo)
- [ ] Table attachments existe: `\d attachments` dans psql
- [ ] Bucket MinIO existe: `mc ls local/attachments`
- [ ] Upload fichier réussit (via UI onglet Documents)
- [ ] Download fichier réussit (bouton download)
- [ ] Delete fichier réussit (bouton delete)

### Données Démo (Optionnel)
- [ ] Seed exécuté: `npx prisma db seed`
- [ ] 5 attachments démo créés: `SELECT COUNT(*) FROM attachments;` → 5

---

## 🎯 RÉSULTAT ATTENDU

**Après déploiement réussi:**

```
✅ Backend: https://xchapi.eoncom.io/api/health (200 OK)
✅ Frontend: https://xch.eoncom.io (accessible)
✅ Database: xch_dev (table attachments créée)
✅ MinIO: bucket attachments (configuré)
✅ Upload: Fonctionnel (Assets + Tasks)
✅ Download: Presigned URLs fonctionnels (7 jours)
✅ Delete: Suppression fichiers (MinIO + DB)
```

**Application MVP 100% déployée** ✅

---

## 📞 SUPPORT

**Si blocage:**
1. Copier logs erreur: `docker-compose logs backend --tail=100`
2. Vérifier fichiers: `ls -la /opt/xch-dev/XCH/`
3. Vérifier conteneurs: `docker-compose ps`
4. Consulter guide: `GUIDE_DEPLOIEMENT_AUTOMATISE.md`

**Rollback si critique:**
```bash
./rollback.sh HEAD~5 --restore-db
```

---

**Guide créé:** 2026-01-29
**Durée déploiement:** 5-10 minutes
**Difficulté:** Facile (script automatisé) ou Moyenne (manuel)
