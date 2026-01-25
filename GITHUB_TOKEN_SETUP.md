# Configuration Token GitHub pour Déploiement

## Étape 1: Créer le Token sur GitHub

1. Aller sur: https://github.com/settings/tokens/new
2. Configuration:
   - **Note:** `XCH Deploy Server`
   - **Expiration:** 90 days (ou No expiration pour usage permanent)
   - **Scopes:**
     - ✅ `repo` (Full control of private repositories)

3. Cliquer sur "Generate token"
4. **IMPORTANT:** Copier le token immédiatement (commence par `ghp_`)

## Étape 2: Configurer sur le Serveur

```bash
# Se connecter au serveur
ssh xch-deploy

# Définir le token (remplacer par votre token réel)
export GITHUB_TOKEN='ghp_VOTRE_TOKEN_ICI'

# Exécuter le script de configuration
cd /opt/xch-dev/XCH
bash scripts/setup-git-credentials.sh
```

## Étape 3: Tester

```bash
# Test git pull
git pull origin main

# Si succès, lancer un déploiement de test
export AUTO_DEPLOY_DB_ACTION="skip"
bash scripts/deploy-auto.sh
```

## Sécurité

- Le token est stocké dans `~/.git-credentials` (permissions 600)
- Jamais commité dans le dépôt
- Accessible uniquement par l'utilisateur `claude-deploy` sur le serveur

## Révocation

Si le token est compromis:
1. Aller sur https://github.com/settings/tokens
2. Révoquer l'ancien token
3. Créer un nouveau token
4. Re-exécuter `setup-git-credentials.sh` avec le nouveau token
