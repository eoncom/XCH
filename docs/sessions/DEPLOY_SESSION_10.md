# DÉPLOIEMENT SESSION 10 - Guide Production

**Date:** 2026-01-12
**Serveur:** 192.168.0.13
**Commit:** a45021f
**Packages:** session10-frontend-updates.tar.gz + session10-backend-updates.tar.gz

---

## ✅ CONTENU DU DÉPLOIEMENT

### Bugs corrigés
1. **Bug #1** - Rack Viewer Konva Crash (TypeScript errors backend)
2. **Bug #5** - Rack data inconsistency (occupation calculation)
3. **Bug #7** - Mobile responsive design (hamburger menu)

### Pages CRUD créées
1. **Users:** new + edit (2 pages)
2. **Assets:** edit (1 page)
3. **Racks:** new + edit (2 pages)
4. **Tasks:** new + edit (2 pages)
5. **UI Component:** textarea.tsx (1 composant)

### Fichiers modifiés
- **Backend:** `backend/src/modules/racks/racks.service.ts` (357 lines)
- **Frontend:**
  - `frontend/src/app/dashboard/layout.tsx` (162 lines)
  - `frontend/src/app/dashboard/users/new/page.tsx` (168 lines)
  - `frontend/src/app/dashboard/users/[id]/edit/page.tsx` (180 lines)
  - `frontend/src/app/dashboard/assets/[id]/edit/page.tsx` (217 lines)
  - `frontend/src/app/dashboard/racks/new/page.tsx` (177 lines)
  - `frontend/src/app/dashboard/racks/[id]/edit/page.tsx` (197 lines)
  - `frontend/src/app/dashboard/tasks/new/page.tsx` (232 lines)
  - `frontend/src/app/dashboard/tasks/[id]/edit/page.tsx` (244 lines)
  - `frontend/src/components/ui/textarea.tsx` (27 lines)

**Total:** 12 fichiers modifiés/créés, 2583 insertions, 13 deletions

---

## 📦 PACKAGES DÉPLOIEMENT

### 1. Frontend Updates
**Fichier:** `session10-frontend-updates.tar.gz`

**Contenu:**
```
frontend/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       ├── layout.tsx (MODIFIÉ - Bug #7 responsive)
│   │       ├── users/
│   │       │   ├── new/page.tsx (CRÉÉ)
│   │       │   └── [id]/edit/page.tsx (CRÉÉ)
│   │       ├── assets/
│   │       │   └── [id]/edit/page.tsx (CRÉÉ)
│   │       ├── racks/
│   │       │   ├── new/page.tsx (CRÉÉ)
│   │       │   └── [id]/edit/page.tsx (CRÉÉ)
│   │       └── tasks/
│   │           ├── new/page.tsx (CRÉÉ)
│   │           └── [id]/edit/page.tsx (CRÉÉ)
│   └── components/
│       └── ui/
│           └── textarea.tsx (CRÉÉ)
```

### 2. Backend Updates
**Fichier:** `session10-backend-updates.tar.gz`

**Contenu:**
```
backend/
└── src/
    └── modules/
        └── racks/
            └── racks.service.ts (MODIFIÉ - Bugs #1 + #5)
```

---

## 🚀 PROCÉDURE DÉPLOIEMENT

### Prérequis
```bash
ssh root@192.168.0.13
cd /root/xch-deploy
```

### Étape 1: Upload packages
```bash
# Depuis machine locale (Windows)
scp session10-frontend-updates.tar.gz root@192.168.0.13:/root/xch-deploy/
scp session10-backend-updates.tar.gz root@192.168.0.13:/root/xch-deploy/
scp DEPLOY_SESSION_10.md root@192.168.0.13:/root/xch-deploy/
```

### Étape 2: Backup containers actuels
```bash
# Sur serveur
cd /root/xch-deploy

# Stop containers
docker-compose stop xch-backend xch-frontend

# Backup volumes
docker run --rm -v xch-deploy_backend_node_modules:/source -v $(pwd):/backup alpine tar czf /backup/backup-backend-$(date +%Y%m%d-%H%M%S).tar.gz -C /source .
docker run --rm -v xch-deploy_frontend_node_modules:/source -v $(pwd):/backup alpine tar czf /backup/backup-frontend-$(date +%Y%m%d-%H%M%S).tar.gz -C /source .

# Backup images
docker commit xch-backend xch-backend:backup-$(date +%Y%m%d-%H%M%S)
docker commit xch-frontend xch-frontend:backup-$(date +%Y%m%d-%H%M%S)
```

### Étape 3: Extraire updates backend
```bash
# Extraire dans dossier temporaire
mkdir -p /tmp/session10-backend
tar -xzf session10-backend-updates.tar.gz -C /tmp/session10-backend

# Copier vers backend container
docker cp /tmp/session10-backend/src/modules/racks/racks.service.ts xch-backend:/app/src/modules/racks/

# Rebuild backend
docker exec -it xch-backend npm run build

# Vérifier build
docker exec -it xch-backend ls -lh dist/
```

### Étape 4: Extraire updates frontend
```bash
# Extraire dans dossier temporaire
mkdir -p /tmp/session10-frontend
tar -xzf session10-frontend-updates.tar.gz -C /tmp/session10-frontend

# Copier vers frontend container
docker cp /tmp/session10-frontend/src/app/dashboard/layout.tsx xch-frontend:/app/src/app/dashboard/
docker cp /tmp/session10-frontend/src/app/dashboard/users xch-frontend:/app/src/app/dashboard/
docker cp /tmp/session10-frontend/src/app/dashboard/assets/[id] xch-frontend:/app/src/app/dashboard/assets/
docker cp /tmp/session10-frontend/src/app/dashboard/racks xch-frontend:/app/src/app/dashboard/
docker cp /tmp/session10-frontend/src/app/dashboard/tasks xch-frontend:/app/src/app/dashboard/
docker cp /tmp/session10-frontend/src/components/ui/textarea.tsx xch-frontend:/app/src/components/ui/

# Rebuild frontend
docker exec -it xch-frontend npm run build

# Vérifier build
docker exec -it xch-frontend ls -lh .next/
```

### Étape 5: Restart containers
```bash
# Restart backend
docker-compose restart xch-backend

# Wait 10 seconds
sleep 10

# Restart frontend
docker-compose restart xch-frontend

# Wait 10 seconds
sleep 10

# Vérifier status
docker-compose ps
docker-compose logs --tail=50 xch-backend
docker-compose logs --tail=50 xch-frontend
```

### Étape 6: Tests validation
```bash
# Test backend health
curl http://192.168.0.13:3000/api/health

# Test backend racks endpoint
curl -H "Authorization: Bearer <token>" http://192.168.0.13:3000/api/racks

# Test frontend (depuis navigateur)
# http://192.168.0.13:3001
# 1. Login ADMIN
# 2. Tester sidebar hamburger menu (mobile view)
# 3. Naviguer vers Users → Nouveau utilisateur
# 4. Naviguer vers Racks → Sélectionner rack → Vérifier vue 2D Konva
# 5. Naviguer vers Dashboard → Vérifier occupation racks (devrait afficher %)
```

---

## ✅ TESTS VALIDATION REQUIS

### 1. Backend Tests

**Test Bug #1 - Rack Viewer:**
```bash
# API doit retourner rack avec assets correctement
curl -X GET http://192.168.0.13:3000/api/racks/<rack-id> \
  -H "Authorization: Bearer <token>"

# Vérifier response contient:
# - rack.assets[] avec brand, model, rackPositionU, rackHeightU
# - Pas d'erreur 500
```

**Test Bug #5 - Rack Occupation:**
```bash
# API doit retourner occupation calculée
curl -X GET http://192.168.0.13:3000/api/racks \
  -H "Authorization: Bearer <token>"

# Vérifier response contient:
# - rack.occupation.totalU
# - rack.occupation.usedU
# - rack.occupation.freeU
# - rack.occupation.percent
# - Valeurs != 0 si rack contient équipements
```

### 2. Frontend Tests

**Test Bug #7 - Mobile Responsive:**
1. Ouvrir DevTools (F12)
2. Passer en mode mobile (375x667 iPhone SE)
3. Vérifier:
   - ✅ Sidebar cachée par défaut
   - ✅ Hamburger menu visible en haut gauche
   - ✅ Clic hamburger → sidebar slide in
   - ✅ Overlay noir semi-transparent visible
   - ✅ Clic overlay → sidebar slide out

**Test CRUD Users:**
1. Naviguer vers `/dashboard/users`
2. Clic "Nouveau" → Vérifier formulaire création
3. Créer utilisateur test
4. Retour liste → Clic "Modifier" sur utilisateur créé
5. Vérifier formulaire pré-rempli
6. Modifier champs, sauvegarder
7. Vérifier modifications appliquées

**Test CRUD Assets:**
1. Naviguer vers `/dashboard/assets`
2. Clic "Modifier" sur asset existant
3. Vérifier formulaire édition avec 11 types équipements
4. Modifier champs, sauvegarder
5. Vérifier modifications appliquées

**Test CRUD Racks:**
1. Naviguer vers `/dashboard/racks`
2. Clic "Nouveau" → Vérifier formulaire création
3. Créer rack test (4U-42U)
4. Retour liste → Clic "Modifier" sur rack créé
5. Vérifier formulaire pré-rempli
6. Modifier champs, sauvegarder

**Test CRUD Tasks:**
1. Naviguer vers `/dashboard/tasks`
2. Clic "Nouveau" → Vérifier formulaire création
3. Créer tâche test avec ticketLink
4. Retour liste → Clic "Modifier" sur tâche créée
5. Vérifier formulaire pré-rempli
6. Modifier statut, priorité, sauvegarder

**Test Rack Viewer (Bug #1):**
1. Naviguer vers `/dashboard/racks`
2. Clic sur rack avec équipements montés
3. Vérifier:
   - ✅ Pas d'erreur "Une erreur est survenue"
   - ✅ Vue 2D Konva s'affiche correctement
   - ✅ Équipements visibles sur rack avec brand/model
   - ✅ Console browser: 0 erreur JavaScript

---

## 🔄 ROLLBACK PROCÉDURE

Si problème critique détecté après déploiement:

### Option 1: Rollback containers
```bash
# Stop containers actuels
docker-compose stop xch-backend xch-frontend

# Restaurer images backup
docker tag xch-backend:backup-20260112-HHMMSS xch-backend:latest
docker tag xch-frontend:backup-20260112-HHMMSS xch-frontend:latest

# Restart
docker-compose up -d xch-backend xch-frontend
```

### Option 2: Rollback fichiers individuels
```bash
# Backend
docker cp xch-backend:/app/src/modules/racks/racks.service.ts.bak xch-backend:/app/src/modules/racks/racks.service.ts
docker exec -it xch-backend npm run build
docker-compose restart xch-backend

# Frontend
docker cp xch-frontend:/app/src/app/dashboard/layout.tsx.bak xch-frontend:/app/src/app/dashboard/layout.tsx
docker exec -it xch-frontend npm run build
docker-compose restart xch-frontend
```

### Option 3: Rollback complet (Git)
```bash
# Sur machine locale
git revert a45021f
git push

# Sur serveur: re-pull et rebuild
cd /root/xch-deploy
git pull
docker-compose down
docker-compose up -d --build
```

---

## 📊 MÉTRIQUES SUCCÈS

Déploiement considéré réussi si:

1. **Backend:**
   - ✅ Container xch-backend: Up et Healthy
   - ✅ API `/api/health` retourne 200
   - ✅ API `/api/racks` retourne racks avec occupation calculée
   - ✅ API `/api/racks/:id` retourne rack avec assets complets
   - ✅ Logs backend: 0 erreur critique

2. **Frontend:**
   - ✅ Container xch-frontend: Up et Healthy
   - ✅ Application accessible sur http://192.168.0.13:3001
   - ✅ Login ADMIN fonctionne
   - ✅ Sidebar hamburger menu fonctionne (mobile)
   - ✅ Pages CRUD Users/Assets/Racks/Tasks accessibles
   - ✅ Rack Viewer affiche vue 2D sans crash
   - ✅ Console browser: 0 erreur JavaScript critique

3. **Performance:**
   - ✅ Temps chargement pages < 3s
   - ✅ Actions utilisateur < 1s
   - ✅ Pas de régression performance vs Session 9

4. **RBAC:**
   - ✅ Manager peut accéder nouvelles pages CRUD
   - ✅ Technicien peut accéder pages assets/racks/tasks
   - ✅ Viewer ne peut pas accéder pages new/edit (read-only)

---

## 📝 POST-DÉPLOIEMENT

### Actions immédiates
1. Monitorer logs 30 minutes post-déploiement
2. Tester tous endpoints API critiques
3. Tester interface utilisateur (ADMIN + MANAGER)
4. Vérifier métriques performance

### Documentation
1. Mettre à jour `PROJECT_STATUS.md`:
   - Status bugs #1, #5, #7 → RÉSOLU + DÉPLOYÉ
   - Status CRUD pages → CRÉÉ + DÉPLOYÉ
   - Conformité modules: Racks 65% → 100%, Users 80% → 100%

2. Créer rapport validation:
   - Tests réussis/échoués
   - Métriques performance
   - Feedback utilisateurs

### Prochaines actions
1. Session 11: Monitoring et alerting (Grafana + Prometheus)
2. Tests automatisés E2E (Playwright)
3. Optimisations performance (lazy loading, pagination)
4. UI/UX improvements (dark mode, notifications)

---

## 🆘 SUPPORT

**En cas de problème:**
1. Consulter logs: `docker-compose logs -f xch-backend xch-frontend`
2. Vérifier status DB: `docker exec -it xch-postgres psql -U xch_user -d xch_dev -c "\dt"`
3. Tester connexion backend-DB: `docker exec -it xch-backend npm run prisma:studio`
4. Contacter: Équipe XCH

**Logs critiques à surveiller:**
- Backend: Erreurs Prisma, Casbin RBAC, JWT auth
- Frontend: React hydration errors, API fetch errors
- PostgreSQL: Connection pool exhausted, slow queries

---

**Date création:** 2026-01-12
**Version:** Session 10
**Mainteneur:** Claude Sonnet 4.5 + Équipe XCH
**Status:** ✅ PRÊT POUR DÉPLOIEMENT
