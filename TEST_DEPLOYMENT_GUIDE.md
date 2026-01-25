# Guide de Test - Système de Déploiement Automatisé

**Date:** 2026-01-24
**Objectif:** Tester et valider le système de déploiement automatisé complet

## 🎯 Préparation (5 minutes)

### 1. Créer le Token GitHub

Ouvre https://github.com/settings/tokens/new et configure:

```
Note: XCH Deploy Server
Expiration: 90 days
Repository access: Only select repositories → eoncom/XCH
Permissions:
  ✅ Contents: Read and write
  ✅ Metadata: Read-only
```

**Copier le token** (commence par `ghp_`)

### 2. Variables à Préparer

Avoir sous la main:
- ✅ Token GitHub: `ghp_...`
- ✅ Serveur SSH: `ssh xch-deploy`
- ✅ Projet path: `/opt/xch-dev/XCH`

## 🧪 Tests à Exécuter

### Test 1: Configuration Git Credentials (2 minutes)

**Objectif:** Configurer l'authentification GitHub automatique

```bash
# Connexion au serveur
ssh xch-deploy

# Définir le token (REMPLACER par ton token réel)
export GITHUB_TOKEN='ghp_VOTRE_TOKEN_GITHUB_ICI'

# Vérifier que le token est bien défini
echo $GITHUB_TOKEN

# Exécuter le script de configuration
cd /opt/xch-dev/XCH
bash scripts/setup-git-credentials.sh
```

**✅ Résultat attendu:**
```
🔐 Configuration Git Credentials pour XCH
========================================

✅ Token GitHub détecté
📝 Configuration utilisateur Git...
✅ Utilisateur Git configuré
🔑 Configuration credential helper...
✅ Credential helper activé
📡 Repository actuel: https://github.com/eoncom/XCH.git
📦 Repository: eoncom/XCH
💾 Sauvegarde des credentials...
✅ Credentials sauvegardés dans /home/claude-deploy/.git-credentials
🧪 Test de l'accès Git...
✅ Accès Git fonctionnel !
🔄 Test git pull...
✅ Fetch réussi !

================================================
✅ Configuration Git terminée avec succès !
================================================
```

**❌ En cas d'erreur:**
- Vérifier que le token est valide
- Vérifier les permissions du token (Contents: Read and write)
- Vérifier l'accès réseau du serveur à GitHub

---

### Test 2: Git Pull Manuel (1 minute)

**Objectif:** Vérifier que git pull fonctionne sans demander de credentials

```bash
cd /opt/xch-dev/XCH
git pull origin main
```

**✅ Résultat attendu:**
```
Already up to date.
```
OU
```
Updating abc1234..def5678
Fast-forward
 fichier.ts | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)
```

**Pas de demande de username/password !**

---

### Test 3: Déploiement Automatique Test (Mode Skip DB) (3 minutes)

**Objectif:** Tester le déploiement sans toucher à la base de données

```bash
cd /opt/xch-dev/XCH

# Mode automatique avec skip database
export AUTO_DEPLOY_DB_ACTION="skip"
bash scripts/deploy-auto.sh
```

**✅ Résultat attendu:**

```
🚀 Déploiement Automatique XCH
================================

📝 Log file: /tmp/xch-deploy-YYYYMMDD-HHMMSS.log

🔍 Vérification des prérequis...
✅ Tous les prérequis sont installés

📥 Step 1/6 - Git Pull
----------------------------------------
   Branche actuelle: main
   Pull de origin/main...
✅ Git pull réussi
   Derniers commits:
   73a7352 feat(deployment): Add automated deployment system
   079f36c fix(frontend): Résolution bugs critiques
   ...

📦 Step 2/6 - Backend Dependencies
----------------------------------------
✅ Dependencies backend installées

🔄 Step 3/6 - Prisma Client
----------------------------------------
✅ Prisma Client regénéré

🗄️  Step 4/6 - Database Sync
----------------------------------------
⏭️  Synchronisation DB ignorée

🌐 Step 5/6 - Frontend Build
----------------------------------------
✅ Frontend buildé

🔄 Step 6/6 - Services Restart
----------------------------------------
✅ Services Docker redémarrés

================================================
✅ Déploiement terminé avec succès !
================================================

🏥 Health Check
----------------------------------------
✅ Backend: OK
✅ Frontend: OK
```

---

### Test 4: Déploiement avec Reset Database (5 minutes)

**⚠️ ATTENTION:** Ce test va **EFFACER** toutes les données et recharger le seed avec GPS !

```bash
cd /opt/xch-dev/XCH

# Mode automatique avec reset complet
export AUTO_DEPLOY_DB_ACTION="reset"
export AUTO_DEPLOY_CONFIRM_RESET="yes"
bash scripts/deploy-auto.sh
```

**✅ Résultat attendu:**

Même output que Test 3, mais avec:

```
🗄️  Step 4/6 - Database Sync
----------------------------------------
   ⚠️  ATTENTION: Reset va SUPPRIMER toutes les données
   Exécution: prisma migrate reset...
✅ Database reset + seed complété
```

---

### Test 5: Vérification Coordonnées GPS (2 minutes)

**Objectif:** Confirmer que les sites ont maintenant les coordonnées GPS

```bash
# Se connecter à la base de données
cd /opt/xch-dev/XCH/backend
docker compose exec postgres psql -U xch_user -d xch_dev -c \
"SELECT code, name, latitude, longitude FROM sites ORDER BY code;"
```

**✅ Résultat attendu:**

```
  code   |             name              | latitude | longitude
---------+-------------------------------+----------+-----------
 BDX-004 | Datacenter Bordeaux Mérignac  |  44.8364 |   -0.6874
 LYN-002 | Chantier Lyon Part-Dieu       |  45.7602 |    4.8594
 MRS-003 | Chantier Marseille Vieux-Port |  43.2954 |     5.373
 PAR-001 | Chantier Paris La Défense     |  48.8919 |    2.2372
 TLS-005 | Bureau Toulouse Aerospace     |  43.6108 |    1.4397
(5 rows)
```

**✅ Tous les sites doivent avoir latitude ET longitude !**

---

### Test 6: Validation Frontend (5 minutes)

**Objectif:** Tester toutes les corrections de bugs

#### 6.1 Test Formulaire Création Site

1. Ouvrir: http://votre-domaine/dashboard/sites
2. Cliquer "Nouveau chantier"
3. Remplir:
   - Code: `TEST-001`
   - Nom: `Test Déploiement Auto`
   - Statut: `ACTIVE`
   - **Laisser GPS vides**
4. Cliquer "Créer"

**✅ Résultat attendu:**
- Redirection vers liste des sites
- Nouveau site visible immédiatement
- Aucune erreur de validation

#### 6.2 Test Carte GPS

1. Aller sur: http://votre-domaine/dashboard
2. Vérifier la carte

**✅ Résultat attendu:**
- 5 marqueurs visibles sur la carte (Paris, Lyon, Marseille, Bordeaux, Toulouse)
- Cliquer sur marqueur affiche le nom du site

#### 6.3 Test QR Code

1. Aller sur: http://votre-domaine/dashboard/assets
2. Cliquer sur un asset
3. Onglet "QR Code"
4. Cliquer "Générer un QR Code"

**✅ Résultat attendu:**
- QR Code s'affiche
- Pas d'erreur dans la console
- Bouton "Télécharger" fonctionnel

#### 6.4 Test Checklist Tâches

1. Aller sur: http://votre-domaine/dashboard/tasks
2. Cliquer sur une tâche avec checklist
3. Vérifier que les items ont du texte
4. Cocher un item

**✅ Résultat attendu:**
- Texte des items visible ("Créer VLAN 10", etc.)
- Checkbox se coche visuellement
- Compteur s'incrémente (ex: 2/6 → 3/6)

---

## 📊 Checklist de Validation Finale

Cocher après chaque test réussi:

- [ ] Test 1: Git credentials configurés
- [ ] Test 2: Git pull sans mot de passe
- [ ] Test 3: Déploiement automatique (skip DB)
- [ ] Test 4: Déploiement avec reset DB
- [ ] Test 5: GPS dans la base de données
- [ ] Test 6.1: Formulaire création site
- [ ] Test 6.2: Carte avec 5 marqueurs
- [ ] Test 6.3: Génération QR Code
- [ ] Test 6.4: Checklist fonctionnelle

## 🎉 Succès !

Si tous les tests passent:

✅ **Système de déploiement automatisé opérationnel**
✅ **Tous les bugs critiques corrigés**
✅ **Application production-ready**

## 📝 Logs et Debugging

En cas de problème:

```bash
# Voir le log du dernier déploiement
ls -lt /tmp/xch-deploy-*.log | head -1 | xargs cat

# Logs Docker
cd /opt/xch-dev/XCH
docker compose logs -f backend

# Status services
docker compose ps
```

## 🔄 Prochains Déploiements

Pour les futures mises à jour:

```bash
# Simple: Code seulement, pas de changement DB
ssh xch-deploy "cd /opt/xch-dev/XCH && AUTO_DEPLOY_DB_ACTION=skip bash scripts/deploy-auto.sh"

# Complet: Avec migrations DB
ssh xch-deploy "cd /opt/xch-dev/XCH && AUTO_DEPLOY_DB_ACTION=migrate bash scripts/deploy-auto.sh"

# Reset: Recharger seed (DEV uniquement)
ssh xch-deploy "cd /opt/xch-dev/XCH && AUTO_DEPLOY_DB_ACTION=reset AUTO_DEPLOY_CONFIRM_RESET=yes bash scripts/deploy-auto.sh"
```

---

**Temps total estimé:** 25 minutes
**Dernière mise à jour:** 2026-01-24
