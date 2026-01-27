# Credentials et Token GitHub - TEMPLATE

**⚠️ IMPORTANT : Ce fichier est un TEMPLATE.**

**Pour l'utiliser :**
```bash
# Copier le template
cp CREDENTIALS_ET_TOKEN.template.md CREDENTIALS_ET_TOKEN.md

# Éditer et remplir avec tes vraies valeurs
nano CREDENTIALS_ET_TOKEN.md
```

**Ce fichier `.template.md` est safe à commiter (pas de secrets).**
**Le fichier `CREDENTIALS_ET_TOKEN.md` est automatiquement ignoré par Git.**

---

## 🔑 Credentials Application

### Admin Account
```
Email:    admin@xch.demo
Password: [À DÉFINIR - ex: admin123 pour dev, mot de passe fort pour prod]
Role:     ADMIN
Name:     Sophie Administrateur
```

**✅ Statut:** [À vérifier après création]

**Test de connexion:**
```bash
curl -X POST https://xchapi.eoncom.io/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@xch.demo","password":"TON_MOT_DE_PASSE"}'
```

---

## 🔐 GitHub Personal Access Token

### Token Actuel
```
[COLLER TON TOKEN ICI - Format: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx]
```

**Type:** Personal Access Token (Classic)
**Owner:** eoncom
**Repository:** eoncom/XCH
**Permissions:** Full repo access
**Statut:** [À valider]

**Validation:**
```bash
# Test API
curl -H "Authorization: Bearer TON_TOKEN_ICI" \
  https://api.github.com/user

# Devrait retourner: {"login": "eoncom", ...}
```

---

## 🚀 Configuration Git sur Serveur

### URL Remote Configurée
```
https://TON_TOKEN_ICI:x-oauth-basic@github.com/eoncom/XCH.git
```

**Configuration sur le serveur:**
```bash
# Remplacer TON_TOKEN_ICI par ton vrai token
ssh xch-deploy "cd /opt/xch-dev/XCH && \
  git remote set-url origin https://TON_TOKEN_ICI:x-oauth-basic@github.com/eoncom/XCH.git"
```

**Test Git Pull:**
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git pull origin main"
```

**Gestion des conflits locaux:**
```bash
# Option 1: Forcer écrasement (ATTENTION: perd les changements locaux)
ssh xch-deploy "cd /opt/xch-dev/XCH && git fetch origin && git reset --hard origin/main"

# Option 2: Stash les changements locaux
ssh xch-deploy "cd /opt/xch-dev/XCH && git stash && git pull origin main && git stash pop"
```

---

## 📝 Prochains Utilisateurs à Créer

Pour créer des utilisateurs additionnels (manager, technicien, viewer), exécuter:

```bash
# Générer hash mot de passe
ssh xch-deploy "docker exec xch-backend node -e \"
const bcrypt = require('bcrypt');
bcrypt.hash('MOT_DE_PASSE', 10, (err, hash) => console.log(hash));
\""

# Puis insérer dans la base
ssh xch-deploy "docker compose -f /opt/xch-dev/XCH/docker-compose.yml exec postgres psql -U xch_user -d xch_dev -c \"
INSERT INTO users (id, tenantId, email, passwordHash, name, role, active, createdAt, updatedAt)
VALUES (gen_random_uuid(), 'tenant_default', 'EMAIL', 'HASH_GENERE', 'NOM', 'ROLE', true, NOW(), NOW());
\""
```

**Rôles disponibles:**
- `ADMIN` - Accès complet
- `MANAGER` - Gestion projets et équipes
- `TECHNICIEN` - Exécution tâches techniques
- `VIEWER` - Lecture seule

---

## 🔄 Rotation Token GitHub

**Recommandation:** Renouveler le token tous les 90 jours

**Étapes:**
1. Créer nouveau token sur https://github.com/settings/tokens
   - Permissions minimales : `repo` (contents: read/write)
   - Expiration : 90 jours
2. Copier le nouveau token
3. Mettre à jour sur le serveur:
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && \
  git remote set-url origin https://NOUVEAU_TOKEN:x-oauth-basic@github.com/eoncom/XCH.git"
```
4. Tester:
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git fetch origin"
```
5. Révoquer l'ancien token sur GitHub

---

## ⚠️ Sécurité

**RÈGLES ABSOLUES :**

### ❌ Ne JAMAIS :
- Commiter le fichier `CREDENTIALS_ET_TOKEN.md` dans Git (seulement `.template.md`)
- Partager le token publiquement (Slack, email, Discord, etc.)
- Utiliser le même token en dev et prod
- Donner des permissions trop larges au token (seulement ce qui est nécessaire)
- Hardcoder des secrets dans le code source

### ✅ TOUJOURS :
- Stocker le token dans un gestionnaire de mots de passe (1Password, Bitwarden, etc.)
- Révoquer immédiatement si compromis
- Utiliser des tokens avec expiration (90 jours max)
- Vérifier les permissions avant de créer un token
- Garder `CREDENTIALS_ET_TOKEN.md` en local uniquement

**En cas de compromission:**
1. ⚠️ **Révoquer le token immédiatement** : https://github.com/settings/tokens
2. 🔄 **Créer un nouveau token** avec permissions minimales
3. 🔧 **Mettre à jour la configuration Git** sur le serveur
4. 🔍 **Auditer les commits récents** pour activité suspecte
5. 📧 **Notifier l'équipe** si applicable

---

## 📚 Ressources

- [GitHub Token Best Practices](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Secrets Management Guide](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- Documentation projet : `docs/installation/`

---

**Dernière mise à jour:** 2026-01-27
**Version:** 1.0.0
