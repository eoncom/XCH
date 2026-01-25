# Commandes Exactes à Exécuter

## Configuration Git Credentials (1x seulement)

```bash
# Connexion au serveur
ssh xch-deploy

# Définir le token (REMPLACER ghp_xxx par ton vrai token)
export GITHUB_TOKEN='ghp_REMPLACER_PAR_TON_TOKEN'

# Configuration automatique
cd /opt/xch-dev/XCH
bash scripts/setup-git-credentials.sh
```

## Test Git Pull

```bash
git pull origin main
# Doit réussir SANS demander username/password
```

## Déploiement Complet avec GPS

```bash
# Option 1: Mode automatique complet (RECOMMANDÉ)
export AUTO_DEPLOY_DB_ACTION="reset"
export AUTO_DEPLOY_CONFIRM_RESET="yes"
bash scripts/deploy-auto.sh

# Option 2: Mode interactif
bash scripts/deploy-auto.sh
# Puis choisir option 3 (reset + seed)
```

## Validation GPS en Base

```bash
cd backend
docker compose exec postgres psql -U xch_user -d xch_dev -c \
"SELECT code, name, latitude, longitude FROM sites ORDER BY code;"
```

Résultat attendu:
```
  code   |             name              | latitude | longitude
---------+-------------------------------+----------+-----------
 BDX-004 | Datacenter Bordeaux Mérignac  |  44.8364 |   -0.6874
 LYN-002 | Chantier Lyon Part-Dieu       |  45.7602 |    4.8594
 MRS-003 | Chantier Marseille Vieux-Port |  43.2954 |     5.373
 PAR-001 | Chantier Paris La Défense     |  48.8919 |    2.2372
 TLS-005 | Bureau Toulouse Aerospace     |  43.6108 |    1.4397
```

## Tests Frontend

### 1. Formulaire Site
```
URL: http://votre-domaine/dashboard/sites/new
Actions:
  1. Remplir: Code=TEST-001, Nom=Test Auto, Statut=ACTIVE
  2. Laisser GPS vides
  3. Cliquer "Créer"
Résultat: Redirection + site créé sans erreur
```

### 2. Carte GPS
```
URL: http://votre-domaine/dashboard
Résultat: 5 marqueurs visibles sur la carte
```

### 3. QR Code
```
URL: http://votre-domaine/dashboard/assets → cliquer asset → QR Code
Actions: Cliquer "Générer un QR Code"
Résultat: QR Code affiché
```

### 4. Checklist
```
URL: http://votre-domaine/dashboard/tasks → cliquer tâche
Résultat: Items de checklist avec texte visible + toggle fonctionnel
```

## Futurs Déploiements (Simple)

Depuis ta machine locale Windows:

```bash
# Simple (code seulement)
bash quick-deploy.sh skip

# Avec database push
bash quick-deploy.sh push

# Avec migrations
bash quick-deploy.sh migrate

# Reset complet (DEV uniquement)
bash quick-deploy.sh reset
```

OU directement en SSH:

```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && AUTO_DEPLOY_DB_ACTION=push bash scripts/deploy-auto.sh"
```

## En Cas de Problème

```bash
# Voir les logs du dernier déploiement
ssh xch-deploy "ls -lt /tmp/xch-deploy-*.log | head -1 | xargs cat"

# Logs Docker en temps réel
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose logs -f backend"

# Status des services
ssh xch-deploy "cd /opt/xch-dev/XCH && docker compose ps"

# Re-configuration Git si token change
ssh xch-deploy
export GITHUB_TOKEN='ghp_nouveau_token'
cd /opt/xch-dev/XCH
bash scripts/setup-git-credentials.sh
```
