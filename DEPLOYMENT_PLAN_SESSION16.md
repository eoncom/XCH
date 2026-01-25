# Plan de Déploiement - Session 16

**Date :** 2026-01-21
**Objectif :** Déployer upgrade React 19.2.3 sur production
**Serveur :** xch-deploy (192.168.0.13)

---

## 📋 MODIFICATIONS À DÉPLOYER

### Frontend uniquement

**package.json :**
```diff
- "react": "^19.0.0",
- "react-dom": "^19.0.0",
+ "react": "^19.2.3",
+ "react-dom": "^19.2.3",
```

**Raison :** Patch sécurité React (CVE-2025-55182 CVSS 10.0 affecte 19.0-19.2.0)

**Validation locale :**
- ✅ Serveur dev démarré (port 3001)
- ✅ React 19.2.3 + react-konva 18.2.14 compatible
- ✅ Aucune erreur compilation
- ✅ Build Next.js : Ready in 4.3s

---

## 🚀 ÉTAPES DÉPLOIEMENT

### Pré-déploiement (Local)

**1. Commit modifications**
```bash
git add frontend/package.json
git commit -m "chore(frontend): Upgrade React 19.0.0 → 19.2.3 (security patch CVE-2025-55182)"
```

**2. Push GitHub**
```bash
git push origin main
```

**3. Tag version**
```bash
git tag v1.0.3-security-patch
git push origin v1.0.3-security-patch
```

---

### Déploiement Serveur

**4. Connexion SSH**
```bash
ssh xch-deploy
cd /opt/xch-dev/XCH
```

**5. Backup avant mise à jour**
```bash
# Backup code actuel
sudo tar -czf /opt/backups/xch-frontend-$(date +%Y%m%d-%H%M%S).tar.gz frontend/

# Backup DB (par précaution)
docker exec xch-postgres pg_dump -U xch_user xch_dev > /opt/backups/xch-db-$(date +%Y%m%d-%H%M%S).sql
```

**6. Pull dernières modifications**
```bash
git fetch origin
git pull origin main
```

**7. Vérifier changements**
```bash
git log -1 --stat
git diff HEAD~1 frontend/package.json
```

**8. Rebuild frontend**
```bash
cd /opt/xch-dev/XCH
docker-compose down frontend
docker-compose build --no-cache frontend
```

**9. Démarrer frontend**
```bash
docker-compose up -d frontend
```

**10. Vérifier logs**
```bash
docker logs -f xch-frontend --tail 50
```

**Attendre :**
```
✓ Ready in X.Xs
- Local:        http://localhost:3001
```

---

### Validation Production

**11. Health check frontend**
```bash
curl -I http://192.168.0.13:3001
# Expected: HTTP/1.1 200 OK

curl http://192.168.0.13:3001 | grep -i "react"
```

**12. Tests manuels (navigateur)**

Ouvrir : https://xch.eoncom.io

**Tests critiques :**
- [ ] Login fonctionnel (admin@xch.demo / admin123)
- [ ] Dashboard affiche stats
- [ ] Navigation Sites → Liste OK
- [ ] **Baies (react-konva) :** Viewer charge sans erreur
- [ ] **FloorPlans (react-konva) :** Viewer charge sans erreur
- [ ] Logout fonctionnel

**13. Vérifier console DevTools**
```
Aucune erreur :
- react-konva
- canvas
- useImage
```

**14. Vérifier versions déployées**
```bash
# Sur serveur
docker exec xch-frontend cat package.json | grep '"react"'
# Expected: "react": "^19.2.3"

# Dans navigateur DevTools Console
window.React.version
// Expected: undefined (pas exposé en production)
```

---

## ⚠️ ROLLBACK (si problème)

**Si erreur critique détectée :**

```bash
# Arrêter frontend
docker-compose down frontend

# Restaurer backup code
cd /opt/xch-dev
sudo rm -rf XCH/frontend
sudo tar -xzf /opt/backups/xch-frontend-YYYYMMDD-HHMMSS.tar.gz -C XCH/

# Rebuild avec ancienne version
cd XCH
docker-compose build --no-cache frontend
docker-compose up -d frontend

# Rollback Git
git reset --hard HEAD~1
```

**Vérifier application fonctionnelle après rollback**

---

## 📊 CHECKLIST FINALE

**Pré-déploiement :**
- [ ] Commit Git créé
- [ ] Push GitHub OK
- [ ] Tag version créé

**Déploiement :**
- [ ] Backup code frontend
- [ ] Backup DB PostgreSQL
- [ ] Git pull serveur
- [ ] Docker rebuild frontend
- [ ] Container démarré

**Validation :**
- [ ] Health check HTTP 200
- [ ] Login fonctionnel
- [ ] Baies (react-konva) OK
- [ ] FloorPlans (react-konva) OK
- [ ] Console DevTools : 0 erreurs
- [ ] Versions vérifiées (package.json)

**Documentation :**
- [ ] DEVELOPMENT_LOG.md mis à jour
- [ ] PROJECT_STATUS.md mis à jour (version 1.0.3)
- [ ] Ce plan archivé dans docs/deployment/

---

## 📝 NOTES

**Durée estimée :** 30 minutes

**Risque :** 🟢 Faible
- Upgrade React patch sécurité (19.0 → 19.2.3)
- Pas de breaking changes API
- react-konva compatible (peer deps ^19.2.0)
- Validation locale OK

**Impact :** Frontend uniquement
- Backend : Aucune modification
- Base de données : Aucune migration
- Configuration : Aucun changement

**Downtime :** ~2 minutes
- Rebuild image Docker : ~1-2 min
- Restart container : ~30s

---

**Prêt pour exécution !**
