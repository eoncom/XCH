# Serveur Prêt pour Tests

**Date:** 2026-01-24 17:45
**Statut:** ✅ Tous les services sont démarrés

---

## ✅ Services Actifs

### Infrastructure
- ✅ PostgreSQL (port 5433) - Healthy
- ✅ Redis (port 6380) - Healthy
- ✅ MinIO (ports 9000-9001) - Healthy

### Application
- ✅ Backend NestJS (port 3002) - Running
- ✅ Frontend Next.js (port 3001) - Running

---

## 🌐 URLs de Test

### Frontend Public
```
https://xch.eoncom.io
```

### Backend API
```
https://xchapi.eoncom.io
```

### Swagger Documentation (si activée)
```
https://xchapi.eoncom.io/api/docs
```

---

## 🧪 Tests à Effectuer

### 1. Test Login
URL: https://xch.eoncom.io

**✅ Credentials Admin:**
- Email: `admin@xch.demo`
- Password: `admin123`

**Actions:**
1. Ouvrir https://xch.eoncom.io
2. Entrer les credentials
3. Cliquer "Se connecter"

**Résultat attendu:** Redirection vers `/dashboard`

**✅ Login vérifié fonctionnel** (testé via API le 2026-01-24 17:50)

---

### 2. Test Création Site (Bug #1 - Formulaire)

URL: https://xch.eoncom.io/dashboard/sites/new

**Actions:**
1. Aller sur "Chantiers" → "Nouveau chantier"
2. Remplir:
   - Code: `TEST-001`
   - Nom: `Test Formulaire GPS Optionnel`
   - Statut: `ACTIVE`
   - **GPS: LAISSER VIDES** (pour tester le fix)
3. Cliquer "Créer"

**Résultat attendu:**
- ✅ Aucune erreur de validation
- ✅ Redirection vers liste des sites
- ✅ Nouveau site visible immédiatement

**Bug corrigé:** Le formulaire accepte maintenant les champs GPS vides (transformation Zod `NaN` → `undefined`)

---

### 3. Test Carte GPS (Bug #5 - Coordonnées)

URL: https://xch.eoncom.io/dashboard

**Actions:**
1. Aller sur le Dashboard
2. Vérifier la carte interactive

**Résultat attendu:**
- ✅ **5 marqueurs visibles** sur la carte:
  - Paris La Défense (48.8919, 2.2372)
  - Lyon Part-Dieu (45.7602, 4.8594)
  - Marseille Vieux-Port (43.2954, 5.3730)
  - Bordeaux Mérignac (44.8364, -0.6874)
  - Toulouse Aerospace (43.6108, 1.4397)
- ✅ Cliquer sur un marqueur affiche le nom du site

**Bug corrigé:** Seed data contient maintenant les coordonnées GPS réelles

---

### 4. Test QR Code (Bug #2 - Endpoint)

URL: https://xch.eoncom.io/dashboard/assets

**Actions:**
1. Aller sur "Équipements"
2. Cliquer sur un asset existant
3. Onglet "QR Code"
4. Cliquer "Générer un QR Code"

**Résultat attendu:**
- ✅ QR Code s'affiche immédiatement
- ✅ Aucune erreur 404 dans la console
- ✅ Bouton "Télécharger" fonctionnel

**Bug corrigé:** Backend expose `POST /api/assets/:id/qr-code` (au lieu de GET /qrcode)

---

### 5. Test Checklist (Bugs #3 & #4)

URL: https://xch.eoncom.io/dashboard/tasks

**Actions:**
1. Aller sur "Tâches"
2. Cliquer sur une tâche avec checklist (ex: installation réseau)
3. Vérifier que les items ont du texte
4. Cocher/décocher un item

**Résultat attendu:**
- ✅ Texte des items visible (ex: "Créer VLAN 10", "Configurer switch")
- ✅ Checkbox se coche visuellement
- ✅ Compteur s'incrémente (ex: 2/6 → 3/6)
- ✅ État persiste après rafraîchissement

**Bug corrigé:** Seed data contient des checklist items valides avec texte

---

## 📊 Vérifications Base de Données

### GPS Coordinates
Pour vérifier que les GPS sont bien en base:

```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose -f docker-compose.yml exec postgres psql -U xch_user -d xch_dev -c 'SELECT code, name, latitude, longitude FROM sites ORDER BY code;'"
```

**Résultat attendu:**
```
  code   |             name              | latitude | longitude
---------+-------------------------------+----------+-----------
 BDX-004 | Datacenter Bordeaux Mérignac  |  44.8364 |   -0.6874
 LYN-002 | Chantier Lyon Part-Dieu       |  45.7602 |    4.8594
 MRS-003 | Chantier Marseille Vieux-Port |  43.2954 |     5.373
 PAR-001 | Chantier Paris La Défense     |  48.8919 |    2.2372
 TLS-005 | Bureau Toulouse Aerospace     |  43.6108 |    1.4397
```

---

## 🔄 Commandes Utiles

### Voir les logs en temps réel
```bash
# Backend
ssh xch-deploy "docker logs -f xch-backend"

# Frontend
ssh xch-deploy "docker logs -f xch-frontend"

# Tous les services
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose -f docker-compose-run.yml logs -f"
```

### Status des containers
```bash
ssh xch-deploy "docker ps --filter 'name=xch-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

### Redémarrer un service
```bash
# Backend
ssh xch-deploy "docker restart xch-backend"

# Frontend
ssh xch-deploy "docker restart xch-frontend"

# Tous les services
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose -f docker-compose-run.yml restart"
```

### Arrêter tous les services
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose -f docker-compose-run.yml down"
```

### Redémarrer tous les services
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose down && docker compose -f docker-compose-run.yml up -d"
```

---

## 📝 Bugs Corrigés dans ce Déploiement

| Bug | Statut | Description | Fichier Corrigé |
|-----|--------|-------------|-----------------|
| #1 🔴 CRITIQUE | ✅ Corrigé | Formulaires non fonctionnels (GPS optionnel) | `frontend/src/app/dashboard/sites/new/page.tsx` |
| #2 🔴 CRITIQUE | ✅ Corrigé | QR Code non fonctionnel (endpoint mismatch) | `backend/src/modules/assets/assets.controller.ts` |
| #3 🟠 MAJEUR | ✅ Corrigé | Checklist items sans labels | `backend/prisma/seed.ts` |
| #4 🟠 MAJEUR | ✅ Corrigé | Checkbox toggle ne fonctionne pas | `backend/prisma/seed.ts` |
| #5 🟠 MAJEUR | ✅ Corrigé | Sites sans coordonnées GPS | `backend/prisma/seed.ts` |
| BONUS | ✅ Corrigé | Button asChild prop | `frontend/src/components/ui/button.tsx` |

---

## 🎯 Prochaines Étapes

Après validation des tests ci-dessus:

1. ✅ **Confirmer que tous les bugs sont résolus**
2. 📝 **Reporter tout nouveau bug découvert**
3. 🔄 **Configurer le système de déploiement automatisé** (nécessite token GitHub avec permissions write)
4. 🚀 **Déploiement en production validé**

---

## 🆘 En Cas de Problème

### Service ne répond pas
```bash
# Vérifier les logs
ssh xch-deploy "docker logs xch-backend --tail 50"

# Redémarrer le service
ssh xch-deploy "docker restart xch-backend"
```

### Erreur 502 Bad Gateway
```bash
# Vérifier que nginx-proxy-manager redirige correctement
# Vérifier les logs nginx
ssh xch-deploy "docker logs nginx-proxy-manager-app-1 --tail 50"
```

### Changements code non visibles
```bash
# Les fichiers sont montés en volume read-only
# Pour appliquer des changements, il faut:
# 1. Copier les nouveaux fichiers via SCP
# 2. Redémarrer le container
ssh xch-deploy "docker restart xch-backend xch-frontend"
```

---

**✅ Serveur prêt - Tu peux commencer les tests !**

Accède à https://xch.eoncom.io et teste les 5 bugs corrigés.
