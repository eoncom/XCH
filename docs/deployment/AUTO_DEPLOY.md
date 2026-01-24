# Système de Déploiement Automatisé XCH

**Dernière mise à jour:** 2026-01-24

Ce document explique comment utiliser le système de déploiement automatisé pour XCH.

## 📋 Vue d'Ensemble

Le système de déploiement automatisé permet de déployer les mises à jour du code en **une seule commande**, en gérant automatiquement:

- ✅ Pull du code depuis GitHub
- ✅ Installation des dépendances (npm)
- ✅ Régénération du Prisma Client
- ✅ Synchronisation de la base de données
- ✅ Build du frontend
- ✅ Redémarrage des services

## 🚀 Installation Initiale

### Étape 1: Créer un Personal Access Token GitHub

1. Aller sur https://github.com/settings/tokens/new
2. Nom du token: `XCH Deploy Server`
3. Permissions requises:
   - `repo` (accès complet aux dépôts)
4. Générer le token et le copier (commence par `ghp_`)

### Étape 2: Configurer Git sur le Serveur

```bash
# Depuis votre machine locale
ssh xch-deploy

# Sur le serveur, définir le token GitHub
export GITHUB_TOKEN='ghp_votre_token_ici'

# Exécuter le script de configuration
cd /opt/xch-dev/XCH
bash scripts/setup-git-credentials.sh
```

Ce script va:
- Configurer l'utilisateur Git
- Activer le credential helper
- Sauvegarder le token de manière sécurisée
- Tester l'accès au dépôt

**✅ Installation terminée !** Vous n'aurez plus besoin de rentrer vos credentials Git.

## 🔄 Déploiements

### Déploiement Standard (Recommandé)

```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
bash scripts/deploy-auto.sh
```

Le script vous demandera quelle action effectuer sur la base de données:
1. **db push** - Rapide, synchronise le schema (développement)
2. **migrate deploy** - Safe, applique les migrations (production)
3. **reset + seed** - Complet mais **DESTRUCTIF** (efface toutes les données)
4. **skip** - Garde la DB actuelle

### Déploiement Automatique Complet

Pour un déploiement entièrement automatisé sans interaction:

```bash
# Mode automatique avec db push
export AUTO_DEPLOY_DB_ACTION="push"
bash scripts/deploy-auto.sh

# Mode automatique avec reset (ATTENTION: destructif)
export AUTO_DEPLOY_DB_ACTION="reset"
export AUTO_DEPLOY_CONFIRM_RESET="yes"
bash scripts/deploy-auto.sh
```

### Déploiement depuis Machine Locale

```bash
# Depuis Windows/Mac/Linux local
ssh xch-deploy "cd /opt/xch-dev/XCH && bash scripts/deploy-auto.sh"
```

## 📊 Options de Synchronisation Database

### Option 1: `db push` (Développement)

**Utilisation:** Développement, mises à jour rapides du schema

**Avantages:**
- Rapide
- Pas besoin de créer des migrations

**Inconvénients:**
- Peut causer des pertes de données si modification destructive
- Pas de rollback possible

**Commande:**
```bash
cd backend
npx prisma db push
```

### Option 2: `migrate deploy` (Production)

**Utilisation:** Production, déploiements contrôlés

**Avantages:**
- Safe, versionné
- Rollback possible
- Historique des migrations

**Inconvénients:**
- Nécessite de créer les migrations en dev d'abord
- Plus lent

**Commande:**
```bash
cd backend
npx prisma migrate deploy
```

### Option 3: `reset + seed` (Reset Complet)

**⚠️ ATTENTION: Efface TOUTES les données !**

**Utilisation:** Reset complet, tests, développement

**Avantages:**
- Base propre avec données de démo
- Synchronise tout

**Inconvénients:**
- **Perte de TOUTES les données**
- Downtime

**Commande:**
```bash
cd backend
npx prisma migrate reset --force
```

### Option 4: `skip` (Aucune action)

**Utilisation:** Déploiement code uniquement, sans toucher la DB

**Avantages:**
- Pas de downtime DB
- Safe

**Inconvénients:**
- Schema peut être désynchronisé

## 🔧 Cas d'Usage Courants

### Cas 1: Correction de Bug Frontend

**Situation:** Fix d'un bug CSS ou logique React, pas de changement DB

```bash
export AUTO_DEPLOY_DB_ACTION="skip"
bash scripts/deploy-auto.sh
```

### Cas 2: Nouveau Champ Database

**Situation:** Ajout d'un champ `latitude` et `longitude` à `Site`

**En développement local:**
```bash
cd backend
npx prisma migrate dev --name add_gps_to_sites
git add prisma/migrations
git commit -m "feat: Add GPS coordinates to sites"
git push
```

**Sur le serveur:**
```bash
export AUTO_DEPLOY_DB_ACTION="migrate"
bash scripts/deploy-auto.sh
```

### Cas 3: Mise à Jour Données de Démo

**Situation:** Modification du seed (ex: ajout GPS aux sites)

```bash
export AUTO_DEPLOY_DB_ACTION="reset"
export AUTO_DEPLOY_CONFIRM_RESET="yes"
bash scripts/deploy-auto.sh
```

**⚠️ ATTENTION:** Efface toutes les données existantes

### Cas 4: Déploiement Nouvelle Feature Complète

**Situation:** Backend + Frontend + Database

```bash
# Mode interactif (recommandé)
bash scripts/deploy-auto.sh
# Choisir option 2 (migrate deploy)
```

## 📁 Structure des Scripts

```
scripts/
├── setup-git-credentials.sh   # Configuration initiale Git
├── deploy-auto.sh              # Déploiement automatique
└── deploy-bugfix-24012026.sh   # Script spécifique (exemple)
```

## 🔐 Sécurité

### Token GitHub

- Stocké dans `~/.git-credentials` (permissions 600)
- Jamais commité dans Git
- Régénérer si compromis

### Bonnes Pratiques

1. **Token dédié** - Créer un token spécifique pour le déploiement
2. **Permissions minimales** - Uniquement `repo` access
3. **Rotation régulière** - Régénérer tous les 6 mois
4. **Surveillance** - Monitorer l'utilisation sur GitHub

## 🐛 Troubleshooting

### Problème: Git pull échoue avec "Authentication failed"

**Solution:**
```bash
# Re-configurer les credentials
export GITHUB_TOKEN='ghp_nouveau_token'
bash scripts/setup-git-credentials.sh
```

### Problème: Prisma Client désynchronisé

**Symptôme:** Erreurs "Unknown argument" ou "Column does not exist"

**Solution:**
```bash
cd /opt/xch-dev/XCH/backend
npx prisma generate  # Regénérer le client
npx prisma db push   # Synchroniser le schema
```

### Problème: Services ne redémarrent pas

**Solution:**
```bash
# Vérifier Docker
docker compose ps
docker compose restart backend frontend

# Ou PM2
pm2 status
pm2 restart all
```

### Problème: Build frontend échoue

**Symptôme:** "Module not found" ou erreurs TypeScript

**Solution:**
```bash
cd /opt/xch-dev/XCH/frontend
rm -rf node_modules .next
npm install
npm run build
```

## 📝 Logs

Chaque déploiement génère un fichier de log:

```bash
# Log du dernier déploiement
ls -lt /tmp/xch-deploy-*.log | head -1

# Voir les logs
tail -f /tmp/xch-deploy-YYYYMMDD-HHMMSS.log

# Logs Docker
docker compose logs -f backend frontend
```

## 🔄 Rollback

Si un déploiement échoue:

```bash
# 1. Revenir au commit précédent
git log -5  # Identifier le bon commit
git reset --hard <commit-hash>

# 2. Redéployer
export AUTO_DEPLOY_DB_ACTION="skip"
bash scripts/deploy-auto.sh

# 3. Si DB corrompue
export AUTO_DEPLOY_DB_ACTION="migrate"
bash scripts/deploy-auto.sh
```

## 📚 Références

- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Docker Compose](https://docs.docker.com/compose/)
- [PM2 Deployment](https://pm2.keymetrics.io/docs/usage/deployment/)

---

**Questions ?** Consulter `BUG_FIX_REPORT_24012026.md` pour un exemple complet de déploiement.
