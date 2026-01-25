# Credentials et Token GitHub

**Date:** 2026-01-24 17:51

---

## 🔑 Credentials Application

### Admin Account
```
Email:    admin@xch.demo
Password: admin123
Role:     ADMIN
Name:     Sophie Administrateur
```

**✅ Statut:** Compte créé et vérifié fonctionnel

**Test de connexion:**
```bash
curl -X POST https://xchapi.eoncom.io/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@xch.demo","password":"admin123"}'
```

---

## 🔐 GitHub Personal Access Token

### Token Actuel
```
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
```

**Type:** Personal Access Token (Classic)
**Owner:** eoncom
**Repository:** eoncom/XCH
**Permissions:** Full repo access
**Statut:** ✅ Validé et fonctionnel

**Validation:**
```bash
# Test API
curl -H "Authorization: Bearer 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" \
  https://api.github.com/user

# Résultat: login: "eoncom", public_repos: 102
```

---

## 🚀 Configuration Git sur Serveur

### URL Remote Configurée
```
https://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:x-oauth-basic@github.com/eoncom/XCH.git
```

**Test Git Pull:**
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git pull origin main"
```

**Statut:** ✅ Token fonctionne, fetch réussi

**Note:** Il y a des fichiers modifiés localement qui empêchent le merge automatique. Pour les futurs déploiements, utiliser:
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
ssh xch-deploy "docker exec xch-backend node -e \"const bcrypt = require('bcrypt'); bcrypt.hash('MOT_DE_PASSE', 10, (err, hash) => console.log(hash));\""

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
2. Copier le nouveau token
3. Mettre à jour sur le serveur:
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git remote set-url origin https://NOUVEAU_TOKEN:x-oauth-basic@github.com/eoncom/XCH.git"
```
4. Tester:
```bash
ssh xch-deploy "cd /opt/xch-dev/XCH && git fetch origin"
```

---

## ⚠️ Sécurité

**IMPORTANT:**
- ❌ Ne jamais commiter ce fichier dans Git
- ❌ Ne jamais partager le token publiquement
- ✅ Stocker le token dans un gestionnaire de mots de passe
- ✅ Révoquer immédiatement si compromis
- ✅ Utiliser des tokens avec permissions minimales nécessaires

**En cas de compromission:**
1. Révoquer le token immédiatement: https://github.com/settings/tokens
2. Créer un nouveau token
3. Mettre à jour la configuration Git sur le serveur
4. Auditer les commits récents pour activité suspecte

---

**Dernière mise à jour:** 2026-01-24 17:51
